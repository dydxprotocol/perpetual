import BigNumber from 'bignumber.js';
import _ from 'lodash';

import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import { expectBalances, mintAndDeposit } from './helpers/balances';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { buy, sell } from './helpers/trade';
import { fastForward } from './helpers/EVM';
import { expectThrow, expect } from './helpers/Expect';
import { address } from '../src';
import { INTEGERS } from '../src/lib/Constants';
import {
  Order,
  SendOptions,
  SignedOrder,
  SigningMethod,
  TxResult,
} from '../src/lib/types';

const DELEVERAGING_TIMELOCK_S = 1800;

const initialPrice = new BigNumber(100).shiftedBy(18);
const longBorderlinePrice = new BigNumber(50).shiftedBy(18);
const longUnderwaterPrice = new BigNumber(49.9).shiftedBy(18);
const shortBorderlinePrice = new BigNumber(150).shiftedBy(18);
const shortUnderwaterPrice = new BigNumber(150.1).shiftedBy(18);
const positionSize = new BigNumber(10);

let admin: address;
let long: address;
let short: address;
let thirdParty: address;
async function init(ctx: ITestContext): Promise<void> {
  await initializeWithTestContracts(ctx);
  admin = ctx.accounts[0];
  long = ctx.accounts[1];
  short = ctx.accounts[2];
  thirdParty = ctx.accounts[3];
}

perpetualDescribe('P1Deleveraging', init, (ctx: ITestContext) => {
  beforeEach(async () => {
    await ctx.perpetual.testing.oracle.setPrice(initialPrice);
    await mintAndDeposit(ctx, long, new BigNumber(500));
    await mintAndDeposit(ctx, short, new BigNumber(500));
    await buy(ctx, long, short, positionSize, new BigNumber(1000));
    // Starting balances:
    // | account | margin | position | collateralization |
    // |---------+--------+----------+-------------------|
    // | long    |   -500 |       10 |              200% |
    // | short   |   1500 |      -10 |              150% |
  });

  describe('trade()', () => {
    it('Fails if the caller is not the perpetual contract', async () => {
      await expectThrow(
        ctx.perpetual.deleveraging.trade(
          short,
          long,
          shortUnderwaterPrice,
          positionSize,
        ),
      );
    });
  });

  describe('trade(), via PerpetualV1, as the deleveraging admin', () => {
    it('Succeeds fully deleveraging a long position', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);
      await deleverage(long, short, positionSize);
      await expectBalances(
        ctx,
        [long, short],
        [new BigNumber(0), new BigNumber(1000)],
        [new BigNumber(0), new BigNumber(0)],
      );
    });

    it('Succeeds fully deleveraging a short position', async () => {
      await ctx.perpetual.testing.oracle.setPrice(shortUnderwaterPrice);
      await deleverage(short, long, positionSize);
      await expectBalances(
        ctx,
        [long, short],
        [new BigNumber(1000), new BigNumber(0)],
        [new BigNumber(0), new BigNumber(0)],
      );
    });

    it('Succeeds with all-or-nothing', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);
      await deleverage(long, short, positionSize, true);
      await expectBalances(
        ctx,
        [long, short],
        [new BigNumber(0), new BigNumber(1000)],
        [new BigNumber(0), new BigNumber(0)],
      );
    });

    it('Succeeds even if amount is greater than the maker position', async() => {
      // Cover some of the short position.
      await mintAndDeposit(ctx, thirdParty, new BigNumber(10000));
      await buy(ctx, short, thirdParty, new BigNumber(1), new BigNumber(150));

      // New balances:
      // | account | margin | position |
      // |---------+--------+----------|
      // | long    |   -500 |       10 |
      // | short   |   1350 |       -9 |

      // Deleverage the short position.
      await ctx.perpetual.testing.oracle.setPrice(new BigNumber(150.2).shiftedBy(18));
      await deleverage(short, long, positionSize);

      // The actual amount executed should be bounded by the maker position.
      await expectBalances(
        ctx,
        [long, short, thirdParty],
        [new BigNumber(850), new BigNumber(0), new BigNumber(10150)],
        [new BigNumber(1), new BigNumber(0), new BigNumber(-1)],
      );
    });

    // TODO: Enable after we've updated the collateralization check to allow partial deleveraging.
    xit('Succeeds even if amount is greater than the taker position', async() => {
      // Sell off some of the long position.
      await mintAndDeposit(ctx, thirdParty, new BigNumber(10000));
      await sell(ctx, long, thirdParty, new BigNumber(1), new BigNumber(150));

      // New balances:
      // | account | margin | position |
      // |---------+--------+----------|
      // | long    |   -350 |        9 |
      // | short   |   1500 |      -10 |

      // Deleverage the short position.
      await ctx.perpetual.testing.oracle.setPrice(shortUnderwaterPrice);
      await deleverage(short, long, positionSize);

      // The actual amount executed should be bounded by the taker position.
      await expectBalances(
        ctx,
        [long, short, thirdParty],
        [new BigNumber(1000), new BigNumber(150), new BigNumber(9850)],
        [new BigNumber(0), new BigNumber(-1), new BigNumber(1)],
      );
    });

    it('Cannot deleverage a long position that is not underwater', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longBorderlinePrice);
      await expectThrow(
        deleverage(long, short, positionSize),
        'Cannot deleverage since maker is not underwater',
      );
    });

    it('Cannot deleverage a short position that is not underwater', async () => {
      await ctx.perpetual.testing.oracle.setPrice(shortBorderlinePrice);
      await expectThrow(
        deleverage(short, long, positionSize),
        'Cannot deleverage since maker is not underwater',
      );
    });

    it('With all-or-nothing, fails if amount is greater than the maker position', async () => {
      // Attempt to liquidate the short position.
      await ctx.perpetual.testing.oracle.setPrice(shortUnderwaterPrice);
      await expectThrow(
        deleverage(short, long, positionSize.plus(1), true),
        'allOrNothing is set and maker position is less than amount',
      );
    });

    it('With all-or-nothing, fails if amount is greater than the taker position', async () => {
      // Sell off some of the long position.
      await mintAndDeposit(ctx, thirdParty, new BigNumber(10000));
      await sell(ctx, long, thirdParty, new BigNumber(1), new BigNumber(100));

      // Attempt to liquidate the short position.
      await ctx.perpetual.testing.oracle.setPrice(shortUnderwaterPrice);
      await expectThrow(
        deleverage(short, long, positionSize, true),
        'allOrNothing is set and taker position is less than amount',
      );
    });

    it('Cannot deleverage a long against a long', async () => {
      // Turn the short into a long.
      await mintAndDeposit(ctx, thirdParty, new BigNumber(10000));
      await buy(ctx, short, thirdParty, new BigNumber(20), new BigNumber(500));

      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);
      await expectThrow(
        deleverage(long, short, positionSize),
        'Taker position has wrong sign to deleverage this maker',
      );
    });

    it('Cannot deleverage a short against a short', async () => {
      // Turn the long into a short.
      await mintAndDeposit(ctx, thirdParty, new BigNumber(10000));
      await sell(ctx, long, thirdParty, new BigNumber(20), new BigNumber(2500));

      await ctx.perpetual.testing.oracle.setPrice(shortUnderwaterPrice);
      await expectThrow(
        deleverage(short, long, positionSize),
        'Taker position has wrong sign to deleverage this maker',
      );
    });

    it('Cannot deleverage after an order has executed in the same tx', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);

      const defaultOrder: Order = {
        isBuy: true,
        isDecreaseOnly: false,
        amount: new BigNumber(1),
        limitPrice: initialPrice,
        stopPrice: INTEGERS.ZERO,
        limitFee: INTEGERS.ZERO,
        maker: long,
        taker: short,
        expiration: new BigNumber(888),
        salt: new BigNumber(444),
      };
      const typedSignature = await ctx.perpetual.orders.signOrder(defaultOrder, SigningMethod.Hash);
      const defaultSignedOrder: SignedOrder = {
        ...defaultOrder,
        typedSignature,
      };
      await expectThrow(
        ctx.perpetual.trade.initiate()
          .fillSignedOrder(
            defaultSignedOrder,
            defaultSignedOrder.amount,
            defaultSignedOrder.limitPrice,
            defaultSignedOrder.limitFee,
          )
          .deleverage(long, short, positionSize)
          .commit({ from: short }),
        'cannot deleverage after execution of an order, in the same tx',
      );
    });
  });

  describe('trade(), via PerpetualV1, as a non-admin', () => {
    beforeEach(async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);
    });

    it('Can mark an account and deleverage it after waiting the timelock period', async () => {
      await ctx.perpetual.deleveraging.mark(long, { from: thirdParty });
      await fastForward(DELEVERAGING_TIMELOCK_S);
      await deleverage(long, short, positionSize, false, { from: thirdParty });

      await expectBalances(
        ctx,
        [long, short],
        [new BigNumber(0), new BigNumber(1000)],
        [new BigNumber(0), new BigNumber(0)],
      );
    });

    it('Cannot deleverage an unmarked account', async () => {
      await expectThrow(
        deleverage(long, short, positionSize, false, { from: thirdParty }),
        'Cannot deleverage since account is not marked',
      );
    });

    it('Cannot deleverage an account that was not marked for the timelock period', async () => {
      await ctx.perpetual.deleveraging.mark(long, { from: thirdParty });
      await fastForward(DELEVERAGING_TIMELOCK_S - 1);
      await expectThrow(
        deleverage(long, short, positionSize, false, { from: thirdParty }),
        'Cannot deleverage since account has not been marked for the timelock period',
      );
    });

    // TODO: Enable after we've updated the collateralization check to allow partial deleveraging.
    xit('Can deleverage partially, and then fully, after waiting one timelock period', async () => {
      await ctx.perpetual.deleveraging.mark(long, { from: thirdParty });
      await fastForward(DELEVERAGING_TIMELOCK_S);
      await deleverage(long, short, positionSize.div(2), false, { from: thirdParty });
      await deleverage(long, short, positionSize.div(2), false, { from: thirdParty });
    });

    it('Cannot deleverage fully, and then deleverage again, after waiting only once', async () => {
      await ctx.perpetual.deleveraging.mark(long, { from: thirdParty });
      await fastForward(DELEVERAGING_TIMELOCK_S);
      const txResult = await deleverage(long, short, positionSize, false, { from: thirdParty });

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      const filteredLogs = _.filter(logs, { name: 'LogUnmarked' });
      expect(filteredLogs.length).to.equal(1);
      expect(filteredLogs[0].args.account).to.equal(long);

      // Set up a new underwater position.
      await ctx.perpetual.testing.oracle.setPrice(initialPrice);
      await mintAndDeposit(ctx, long, new BigNumber(500));
      await mintAndDeposit(ctx, thirdParty, new BigNumber(10000));
      await buy(ctx, long, thirdParty, positionSize, new BigNumber(1000));
      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);

      // Try to deleverage the same account again.
      await expectThrow(
        deleverage(long, short, positionSize, false, { from: thirdParty }),
        'Cannot deleverage since account is not marked',
      );
    });
  });

  describe('mark()', () => {
    it('Can mark an account which is underwater', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);
      const txResult = await ctx.perpetual.deleveraging.mark(long);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogMarked');
      expect(logs[0].args.account).to.equal(long);
    });

    it('Cannot mark an account which is not underwater', async () => {
      await expectThrow(
        ctx.perpetual.deleveraging.mark(long),
        'Cannot mark since account is not underwater',
      );
    });
  });

  describe('unmark()', () => {
    beforeEach(async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);
      await ctx.perpetual.deleveraging.mark(long);
    });

    it('Can unmark an account which is not underwater', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longBorderlinePrice);
      const txResult = await ctx.perpetual.deleveraging.unmark(long);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogUnmarked');
      expect(logs[0].args.account).to.equal(long);
    });

    it('Cannot unmark an account which is underwater', async () => {
      await expectThrow(
        ctx.perpetual.deleveraging.unmark(long),
        'Cannot unmark since account is underwater',
      );
    });
  });

  async function deleverage(
    maker: address,
    taker: address,
    amount: BigNumber,
    allOrNothing: boolean = false,
    options: SendOptions = { from: admin },
  ): Promise<TxResult> {
    return ctx.perpetual.trade
      .initiate()
      .deleverage(maker, taker, amount, allOrNothing)
      .commit(options);
  }
});
