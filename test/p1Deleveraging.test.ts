import BigNumber from 'bignumber.js';
import _ from 'lodash';

import { fastForward, mineAvgBlock } from './helpers/EVM';
import initializePerpetual from './helpers/initializePerpetual';
import { expectBalances, mintAndDeposit } from './helpers/balances';
import { ITestContext, perpetualDescribe } from './helpers/perpetualDescribe';
import { buy, sell } from './helpers/trade';
import { expect, expectBN, expectBaseValueEqual, expectThrow, expectAddressesEqual } from './helpers/Expect';
import { address } from '../src';
import { FEES, INTEGERS, PRICES } from '../src/lib/Constants';
import {
  BaseValue,
  BigNumberable,
  Order,
  Price,
  SigningMethod,
  TxResult,
} from '../src/lib/types';

const initialPrice = new Price(100);
const longBorderlinePrice = new Price(50);
const longUnderwaterPrice = new Price('49.999999');
const shortBorderlinePrice = new Price(150);
const shortUnderwaterPrice = new Price('150.000001');
const positionSize = new BigNumber(10);

let admin: address;
let long: address;
let short: address;
let rando: address;
let deleveragingOperator: address;
let deleveragingTimelockSeconds: number;

async function init(ctx: ITestContext): Promise<void> {
  await initializePerpetual(ctx);
  admin = ctx.accounts[0];
  long = ctx.accounts[1];
  short = ctx.accounts[2];
  rando = ctx.accounts[3];
  deleveragingOperator = ctx.accounts[4];
  deleveragingTimelockSeconds = await ctx.perpetual.deleveraging.getDeleveragingTimelockSeconds();

  // Set up initial balances:
  // +---------+--------+----------+-------------------+
  // | account | margin | position | collateralization |
  // |---------+--------+----------+-------------------|
  // | long    |   -500 |       10 |              200% |
  // | short   |   1500 |      -10 |              150% |
  // +---------+--------+----------+-------------------+
  await Promise.all([
    ctx.perpetual.testing.oracle.setPrice(initialPrice),
    ctx.perpetual.deleveraging.setDeleveragingOperator(deleveragingOperator, { from: admin }),
    mintAndDeposit(ctx, long, new BigNumber(500)),
    mintAndDeposit(ctx, short, new BigNumber(500)),
  ]);
  await buy(ctx, long, short, positionSize, new BigNumber(1000));
}

perpetualDescribe('P1Deleveraging', init, (ctx: ITestContext) => {

  describe('setDeleveragingOperator()', () => {
    it('sets the privileged deleveraging operator', async () => {
      // Make the long account deleverageable.
      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);

      // Check that the operator-to-be can't deleverage without marking.
      await expectThrow(
        deleverage(long, short, positionSize, { sender: rando }),
        'Cannot deleverage since account is not marked',
      );

      // Set the operator.
      const txResult = await ctx.perpetual.deleveraging.setDeleveragingOperator(
        rando,
        { from: admin },
      );

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      const log = logs[0];
      expect(log.name).to.equal('LogDeleveragingOperatorSet');
      expectAddressesEqual(log.args.deleveragingOperator, rando);

      // Check getter.
      const operatorAfter = await ctx.perpetual.deleveraging.getDeleveragingOperator();
      expectAddressesEqual(operatorAfter, rando);

      // Check that the old operator can't deleverage without marking.
      await expectThrow(
        deleverage(long, short, positionSize, { sender: deleveragingOperator }),
        'Cannot deleverage since account is not marked',
      );

      // Check that the new operator can deleverage without marking.
      await deleverage(long, short, positionSize, { sender: rando });
    });

    it('fails if the caller is not the admin', async () => {
      // Call from a random address.
      await expectThrow(
        ctx.perpetual.deleveraging.setDeleveragingOperator(deleveragingOperator, { from: rando }),
        'Ownable: caller is not the owner',
      );

      // Call from the operator address.
      await expectThrow(
        ctx.perpetual.deleveraging.setDeleveragingOperator(
          deleveragingOperator,
          { from: deleveragingOperator },
        ),
        'Ownable: caller is not the owner',
      );
    });
  });

  describe('trade()', () => {
    it('Fails if the caller is not the perpetual contract', async () => {
      await expectThrow(
        ctx.perpetual.deleveraging.trade(
          short,
          long,
          shortUnderwaterPrice,
          positionSize,
          false,
        ),
        'msg.sender must be PerpetualV1',
      );
    });
  });

  describe('trade(), via PerpetualV1, as the deleveraging admin', () => {
    it('Succeeds partially deleveraging a long position', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);
      const deleverageAmount = positionSize.div(2);
      const txResult = await deleverage(long, short, deleverageAmount);
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [new BigNumber(-250), new BigNumber(1250)],
        [new BigNumber(5), new BigNumber(-5)],
      );

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      const filteredLogs = _.filter(logs, { name: 'LogDeleveraged' });
      expect(filteredLogs.length).to.equal(1);
      const deleveragedLog = filteredLogs[0];
      expect(deleveragedLog.args.maker).to.equal(long);
      expect(deleveragedLog.args.taker).to.equal(short);
      expectBN(deleveragedLog.args.amount).to.equal(deleverageAmount);
      expect(deleveragedLog.args.isBuy).to.equal(true);
      expectBaseValueEqual(deleveragedLog.args.oraclePrice, longUnderwaterPrice);
    });

    it('Succeeds partially deleveraging a short position', async () => {
      await ctx.perpetual.testing.oracle.setPrice(shortUnderwaterPrice);
      const deleverageAmount = positionSize.div(2);
      const txResult = await deleverage(short, long, deleverageAmount);
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [new BigNumber(250), new BigNumber(750)],
        [new BigNumber(5), new BigNumber(-5)],
      );

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      const filteredLogs = _.filter(logs, { name: 'LogDeleveraged' });
      expect(filteredLogs.length).to.equal(1);
      const deleveragedLog = filteredLogs[0];
      expect(deleveragedLog.args.maker).to.equal(short);
      expect(deleveragedLog.args.taker).to.equal(long);
      expectBN(deleveragedLog.args.amount).to.equal(deleverageAmount);
      expect(deleveragedLog.args.isBuy).to.equal(false);
      expectBaseValueEqual(deleveragedLog.args.oraclePrice, shortUnderwaterPrice);
    });

    it('Succeeds fully deleveraging a long position', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);
      const txResult = await deleverage(long, short, positionSize);
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [new BigNumber(0), new BigNumber(1000)],
        [new BigNumber(0), new BigNumber(0)],
      );
    });

    it('Succeeds fully deleveraging a short position', async () => {
      await ctx.perpetual.testing.oracle.setPrice(shortUnderwaterPrice);
      const txResult = await deleverage(short, long, positionSize);
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [new BigNumber(1000), new BigNumber(0)],
        [new BigNumber(0), new BigNumber(0)],
      );
    });

    it('Succeeds with all-or-nothing', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);
      const txResult = await deleverage(long, short, positionSize, { allOrNothing: true });
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [new BigNumber(0), new BigNumber(1000)],
        [new BigNumber(0), new BigNumber(0)],
      );
    });

    it('Succeeds when the amount is zero and the maker is long', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);
      const txResult = await deleverage(long, short, 0);
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [new BigNumber(-500), new BigNumber(1500)],
        [new BigNumber(10), new BigNumber(-10)],
      );
    });

    it('Succeeds when the amount is zero and the maker is short', async () => {
      await ctx.perpetual.testing.oracle.setPrice(shortUnderwaterPrice);
      const txResult = await deleverage(short, long, 0);
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [new BigNumber(-500), new BigNumber(1500)],
        [new BigNumber(10), new BigNumber(-10)],
      );
    });

    it('Succeeds even if amount is greater than the maker position', async() => {
      // Cover some of the short position.
      await mintAndDeposit(ctx, rando, new BigNumber(10000));
      await buy(ctx, short, rando, new BigNumber(1), new BigNumber(150));

      // New balances:
      // | account | margin | position |
      // |---------+--------+----------|
      // | long    |   -500 |       10 |
      // | short   |   1350 |       -9 |

      // Deleverage the short position.
      await ctx.perpetual.testing.oracle.setPrice(new Price(150.2));
      const txResult = await deleverage(short, long, positionSize);

      // The actual amount executed should be bounded by the maker position.
      await expectBalances(
        ctx,
        txResult,
        [long, short, rando],
        [new BigNumber(850), new BigNumber(0), new BigNumber(10150)],
        [new BigNumber(1), new BigNumber(0), new BigNumber(-1)],
      );
    });

    it('Succeeds even if amount is greater than the taker position', async() => {
      // Sell off some of the long position.
      await mintAndDeposit(ctx, rando, new BigNumber(10000));
      await sell(ctx, long, rando, new BigNumber(1), new BigNumber(150));

      // New balances:
      // | account | margin | position |
      // |---------+--------+----------|
      // | long    |   -350 |        9 |
      // | short   |   1500 |      -10 |

      // Deleverage the short position.
      await ctx.perpetual.testing.oracle.setPrice(shortUnderwaterPrice);
      const txResult = await deleverage(short, long, positionSize);

      // The actual amount executed should be bounded by the taker position.
      await expectBalances(
        ctx,
        txResult,
        [long, short, rando],
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

    it('Cannot deleverage a long position if isBuy is false', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);
      await expectThrow(
        deleverage(long, short, positionSize, { isBuy: false }),
        'deleveraging must not increase maker\'s position size',
      );
    });

    it('Cannot deleverage a short position if isBuy is true', async () => {
      await ctx.perpetual.testing.oracle.setPrice(shortUnderwaterPrice);
      await expectThrow(
        deleverage(short, long, positionSize, { isBuy: true }),
        'deleveraging must not increase maker\'s position size',
      );
    });

    it('With all-or-nothing, fails if amount is greater than the maker position', async () => {
      // Attempt to deleverage the short position.
      await ctx.perpetual.testing.oracle.setPrice(shortUnderwaterPrice);
      await expectThrow(
        deleverage(short, long, positionSize.plus(1), { allOrNothing: true }),
        'allOrNothing is set and maker position is less than amount',
      );
    });

    it('With all-or-nothing, fails if amount is greater than the taker position', async () => {
      // Sell off some of the long position.
      await mintAndDeposit(ctx, rando, new BigNumber(10000));
      await sell(ctx, long, rando, new BigNumber(1), new BigNumber(100));

      // Attempt to deleverage the short position.
      await ctx.perpetual.testing.oracle.setPrice(shortUnderwaterPrice);
      await expectThrow(
        deleverage(short, long, positionSize, { allOrNothing: true }),
        'allOrNothing is set and taker position is less than amount',
      );
    });

    it('Cannot deleverage a long against a long', async () => {
      // Turn the short into a long.
      await mintAndDeposit(ctx, rando, new BigNumber(10000));
      await buy(ctx, short, rando, new BigNumber(20), new BigNumber(500));

      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);
      await expectThrow(
        deleverage(long, short, positionSize),
        'Taker position has wrong sign to deleverage this maker',
      );
    });

    it('Cannot deleverage a short against a short', async () => {
      // Turn the long into a short.
      await mintAndDeposit(ctx, rando, new BigNumber(10000));
      await sell(ctx, long, rando, new BigNumber(20), new BigNumber(2500));

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
        triggerPrice: PRICES.NONE,
        limitFee: FEES.ZERO,
        maker: long,
        taker: short,
        expiration: INTEGERS.ZERO,
        salt: new BigNumber(444),
      };
      const defaultSignedOrder = await ctx.perpetual.orders.getSignedOrder(
        defaultOrder,
        SigningMethod.Hash,
      );

      await expectThrow(
        ctx.perpetual.trade.initiate()
          .fillSignedOrder(
            defaultSignedOrder,
            defaultSignedOrder.amount,
            defaultSignedOrder.limitPrice,
            defaultSignedOrder.limitFee,
          )
          .deleverage(long, short, positionSize, true, false)
          .commit({ from: short }),
        'cannot deleverage after other trade operations, in the same tx',
      );
    });

    it('Cannot deleverage twice in the same tx', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);
      await expectThrow(
        ctx.perpetual.trade.initiate()
          .deleverage(long, short, 1, true, false)
          .deleverage(long, short, positionSize.minus(1), true, false)
          .commit({ from: deleveragingOperator }),
        'cannot deleverage after other trade operations, in the same tx',
      );
    });

    describe('when an account has no positive value', async () => {
      beforeEach(async () => {
        // Short begins with -10 position, 1500 margin.
        // Set a negative funding rate and accumulate 2000 margin worth of interest.
        await ctx.perpetual.testing.funder.setFunding(new BaseValue(-2));
        await mineAvgBlock();
        await ctx.perpetual.margin.deposit(short, 0);
        const balance = await ctx.perpetual.getters.getAccountBalance(short);
        expectBN(balance.position).to.equal(-10);
        expectBN(balance.margin).to.equal(-500);
      });

      it('Cannot directly deleverage the account', async () => {
        await expectThrow(
          deleverage(short, long, positionSize),
          'Cannot liquidate when maker position and margin are both negative',
        );
      });

      it('Succeeds deleveraging after bringing margin up to zero', async () => {
        // Avoid additional funding.
        await ctx.perpetual.testing.funder.setFunding(new BaseValue(0));

        // Deposit margin into the target account to bring it to zero margin.
        await ctx.perpetual.margin.withdraw(long, long, 500, { from: long });
        await ctx.perpetual.margin.deposit(short, 500, { from: long });

        // Deleverage the underwater account.
        const txResult = await deleverage(short, long, positionSize);

        // Check balances.
        await expectBalances(
          ctx,
          txResult,
          [long, short],
          [new BigNumber(1000), new BigNumber(0)],
          [new BigNumber(0), new BigNumber(0)],
        );
      });
    });
  });

  describe('trade(), via PerpetualV1, as a non-admin', () => {
    beforeEach(async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);
      ctx.perpetual.contracts.resetGasUsed();
    });

    it('Can mark an account and deleverage it after waiting the timelock period', async () => {
      await ctx.perpetual.deleveraging.mark(long, { from: rando });
      await fastForward(deleveragingTimelockSeconds);
      const txResult = await deleverage(long, short, positionSize, { sender: rando });

      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [new BigNumber(0), new BigNumber(1000)],
        [new BigNumber(0), new BigNumber(0)],
      );
    });

    it('Cannot deleverage an unmarked account', async () => {
      await expectThrow(
        deleverage(long, short, positionSize, { sender: rando }),
        'Cannot deleverage since account is not marked',
      );
    });

    it('Cannot deleverage an account that was not marked for the timelock period', async () => {
      await ctx.perpetual.deleveraging.mark(long, { from: rando });
      await fastForward(deleveragingTimelockSeconds - 5);
      await expectThrow(
        deleverage(long, short, positionSize, { sender: rando }),
        'Cannot deleverage since account has not been marked for the timelock period',
      );
    });

    it('Can deleverage partially, and then fully, after waiting one timelock period', async () => {
      await ctx.perpetual.deleveraging.mark(long, { from: rando });
      await fastForward(deleveragingTimelockSeconds);
      await deleverage(long, short, positionSize.div(2), { sender: rando });
      await deleverage(long, short, positionSize.div(2), { sender: rando });
    });

    it('Cannot deleverage fully, and then deleverage again, after waiting only once', async () => {
      await ctx.perpetual.deleveraging.mark(long, { from: rando });
      await fastForward(deleveragingTimelockSeconds);
      const txResult = await deleverage(long, short, positionSize, { sender: rando });

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      const filteredLogs = _.filter(logs, { name: 'LogUnmarkedForDeleveraging' });
      expect(filteredLogs.length).to.equal(1);
      expect(filteredLogs[0].args.account).to.equal(long);

      // Set up a new underwater position.
      await ctx.perpetual.testing.oracle.setPrice(initialPrice);
      await mintAndDeposit(ctx, long, new BigNumber(500));
      await mintAndDeposit(ctx, rando, new BigNumber(10000));
      await buy(ctx, long, rando, positionSize, new BigNumber(1000));
      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);

      // Try to deleverage the same account again.
      await expectThrow(
        deleverage(long, short, positionSize, { sender: rando }),
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
      expect(logs[0].name).to.equal('LogMarkedForDeleveraging');
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
      ctx.perpetual.contracts.resetGasUsed();
    });

    it('Can unmark an account which is not underwater', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longBorderlinePrice);
      const txResult = await ctx.perpetual.deleveraging.unmark(long);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogUnmarkedForDeleveraging');
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
    amount: BigNumberable,
    args: {
      allOrNothing?: boolean,
      isBuy?: boolean,
      sender?: address,
    } = {},
  ): Promise<TxResult> {
    let { isBuy } = args;
    if (typeof isBuy !== 'boolean') {
      // By default, infer isBuy from the sign of the maker position.
      isBuy = (await ctx.perpetual.getters.getAccountBalance(maker)).position.isPositive();
    }
    return ctx.perpetual.trade
      .initiate()
      .deleverage(maker, taker, amount, isBuy, !!args.allOrNothing)
      .commit({ from: args.sender || deleveragingOperator });
  }
});
