import BigNumber from 'bignumber.js';
import _ from 'lodash';

import { mineAvgBlock } from './helpers/EVM';
import initializePerpetual from './helpers/initializePerpetual';
import { expectBalances, mintAndDeposit, expectPositions } from './helpers/balances';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { buy, sell } from './helpers/trade';
import { expect, expectBN, expectBaseValueEqual, expectThrow } from './helpers/Expect';
import { FEES, INTEGERS, PRICES } from '../src/lib/Constants';
import {
  BaseValue,
  BigNumberable,
  Order,
  Price,
  SigningMethod,
  address,
} from '../src/lib/types';

const initialPrice = new Price(100);
const longBorderlinePrice = new Price(55);
const longUndercollateralizedPrice = new Price('54.999999');
const longUnderwaterPrice = new Price('49.999999');
const shortBorderlinePrice = new Price('136.363636');
const shortUndercollateralizedPrice = new Price('136.363637');
const shortUnderwaterPrice = new Price('150.000001');
const positionSize = new BigNumber(10);

let admin: address;
let long: address;
let short: address;
let thirdParty: address;
let globalOperator: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializePerpetual(ctx);
  admin = ctx.accounts[0];
  long = ctx.accounts[1];
  short = ctx.accounts[2];
  thirdParty = ctx.accounts[3];
  globalOperator = ctx.accounts[4];

  // Set up initial balances:
  // +---------+--------+----------+-------------------+
  // | account | margin | position | collateralization |
  // |---------+--------+----------+-------------------|
  // | long    |   -500 |       10 |              200% |
  // | short   |   1500 |      -10 |              150% |
  // +---------+--------+----------+-------------------+
  await Promise.all([
    ctx.perpetual.testing.oracle.setPrice(initialPrice),
    ctx.perpetual.admin.setGlobalOperator(globalOperator, true, { from: admin }),
    mintAndDeposit(ctx, long, new BigNumber(500)),
    mintAndDeposit(ctx, short, new BigNumber(500)),
  ]);
  await buy(ctx, long, short, positionSize, new BigNumber(1000));
}

perpetualDescribe('P1Liquidation', init, (ctx: ITestContext) => {

  describe('trade()', () => {
    it('Fails if the caller is not the perpetual contract', async () => {
      await expectThrow(
        ctx.perpetual.liquidation.trade(
          long,
          short,
          long,
          shortUndercollateralizedPrice,
          positionSize,
          false,
        ),
        'msg.sender must be PerpetualV1',
      );
    });
  });

  describe('trade(), via PerpetualV1', () => {
    it('Succeeds partially liquidating a long position', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUndercollateralizedPrice);
      const liquidationAmount = positionSize.div(2);
      const txResult = await liquidate(long, short, liquidationAmount);
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [new BigNumber(-250), new BigNumber(1250)],
        [new BigNumber(5), new BigNumber(-5)],
      );

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      const filteredLogs = _.filter(logs, { name: 'LogLiquidated' });
      expect(filteredLogs.length).to.equal(1);
      const liquidatedLog = filteredLogs[0];
      expect(liquidatedLog.args.maker).to.equal(long);
      expect(liquidatedLog.args.taker).to.equal(short);
      expectBN(liquidatedLog.args.amount).to.equal(liquidationAmount);
      expect(liquidatedLog.args.isBuy).to.equal(true);
      expectBaseValueEqual(liquidatedLog.args.oraclePrice, longUndercollateralizedPrice);
    });

    it('Succeeds partially liquidating a short position', async () => {
      await ctx.perpetual.testing.oracle.setPrice(shortUndercollateralizedPrice);
      const liquidationAmount = positionSize.div(2);
      const txResult = await liquidate(short, long, liquidationAmount);
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [new BigNumber(250), new BigNumber(750)],
        [new BigNumber(5), new BigNumber(-5)],
      );

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      const filteredLogs = _.filter(logs, { name: 'LogLiquidated' });
      expect(filteredLogs.length).to.equal(1);
      const liquidatedLog = filteredLogs[0];
      expect(liquidatedLog.args.maker).to.equal(short);
      expect(liquidatedLog.args.taker).to.equal(long);
      expectBN(liquidatedLog.args.amount).to.equal(liquidationAmount);
      expect(liquidatedLog.args.isBuy).to.equal(false);
      expectBaseValueEqual(liquidatedLog.args.oraclePrice, shortUndercollateralizedPrice);
    });

    it('Succeeds fully liquidating an undercollateralized long position', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUndercollateralizedPrice);
      const txResult = await liquidate(long, short, positionSize);
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [new BigNumber(0), new BigNumber(1000)],
        [new BigNumber(0), new BigNumber(0)],
      );
    });

    it('Succeeds fully liquidating an undercollateralized short position', async () => {
      await ctx.perpetual.testing.oracle.setPrice(shortUndercollateralizedPrice);
      const txResult = await liquidate(short, long, positionSize);
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [new BigNumber(1000), new BigNumber(0)],
        [new BigNumber(0), new BigNumber(0)],
      );
    });

    it('Succeeds fully liquidating an underwater long position', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);
      const txResult = await liquidate(long, short, positionSize);
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [new BigNumber(0), new BigNumber(1000)],
        [new BigNumber(0), new BigNumber(0)],
      );
    });

    it('Succeeds fully liquidating an underwater short position', async () => {
      await ctx.perpetual.testing.oracle.setPrice(shortUnderwaterPrice);
      const txResult = await liquidate(short, long, positionSize);
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [new BigNumber(1000), new BigNumber(0)],
        [new BigNumber(0), new BigNumber(0)],
      );
    });

    it('Succeeds with all-or-nothing', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUndercollateralizedPrice);
      const txResult = await liquidate(long, short, positionSize, { allOrNothing: true });
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [new BigNumber(0), new BigNumber(1000)],
        [new BigNumber(0), new BigNumber(0)],
      );
    });

    it('Succeeds when the amount is zero and the maker is long', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUndercollateralizedPrice);
      const txResult = await liquidate(long, short, 0);
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [new BigNumber(-500), new BigNumber(1500)],
        [new BigNumber(10), new BigNumber(-10)],
      );
    });

    it('Succeeds when the amount is zero and the maker is short', async () => {
      await ctx.perpetual.testing.oracle.setPrice(shortUndercollateralizedPrice);
      const txResult = await liquidate(short, long, 0);
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [new BigNumber(-500), new BigNumber(1500)],
        [new BigNumber(10), new BigNumber(-10)],
      );
    });

    it('Succeeds even if amount is greater than the maker position', async () => {
      // Cover some of the short position.
      await mintAndDeposit(ctx, thirdParty, new BigNumber(10000));
      await buy(ctx, short, thirdParty, new BigNumber(1), new BigNumber(150));

      // New balances:
      // | account | margin | position |
      // |---------+--------+----------|
      // | long    |   -500 |       10 |
      // | short   |   1350 |       -9 |

      // Liquidate the short position.
      await ctx.perpetual.testing.oracle.setPrice(shortUndercollateralizedPrice);
      const txResult = await liquidate(short, long, positionSize);

      // The actual amount executed should be bounded by the maker position.
      await expectBalances(
        ctx,
        txResult,
        [long, short, thirdParty],
        [new BigNumber(850), new BigNumber(0), new BigNumber(10150)],
        [new BigNumber(1), new BigNumber(0), new BigNumber(-1)],
      );
    });

    it('Succeeds even if amount is greater than the taker position', async () => {
      // Sell off some of the long position.
      await mintAndDeposit(ctx, thirdParty, new BigNumber(10000));
      await sell(ctx, long, thirdParty, new BigNumber(1), new BigNumber(150));

      // New balances:
      // | account | margin | position |
      // |---------+--------+----------|
      // | long    |   -350 |        9 |
      // | short   |   1500 |      -10 |

      // Liquidate the short position.
      await ctx.perpetual.testing.oracle.setPrice(shortUndercollateralizedPrice);
      const txResult = await liquidate(short, long, positionSize);

      // Liquidiation amount should NOT be bounded by the taker position.
      await expectBalances(
        ctx,
        txResult,
        [long, short, thirdParty],
        [new BigNumber(1150), new BigNumber(0), new BigNumber(9850)],
        [new BigNumber(-1), new BigNumber(0), new BigNumber(1)],
      );
    });

    it('Cannot liquidate a long position that is not undercollateralized', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longBorderlinePrice);
      await expectThrow(
        liquidate(long, short, positionSize),
        'Cannot liquidate since maker is not undercollateralized',
      );
    });

    it('Cannot liquidate a short position that is not undercollateralized', async () => {
      await ctx.perpetual.testing.oracle.setPrice(shortBorderlinePrice);
      await expectThrow(
        liquidate(short, long, positionSize),
        'Cannot liquidate since maker is not undercollateralized',
      );
    });

    it('Cannot liquidate a long position if isBuy is false', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUndercollateralizedPrice);
      await expectThrow(
        liquidate(long, short, positionSize, { isBuy: false }),
        'liquidation must not increase maker\'s position size',
      );
    });

    it('Cannot liquidate a short position if isBuy is true', async () => {
      await ctx.perpetual.testing.oracle.setPrice(shortUndercollateralizedPrice);
      await expectThrow(
        liquidate(short, long, positionSize, { isBuy: true }),
        'liquidation must not increase maker\'s position size',
      );
    });

    it('With all-or-nothing, fails if amount is greater than the maker position', async () => {
      // Attempt to liquidate the short position.
      await ctx.perpetual.testing.oracle.setPrice(shortUndercollateralizedPrice);
      await expectThrow(
        liquidate(short, long, positionSize.plus(1), { allOrNothing: true }),
        'allOrNothing is set and maker position is less than amount',
      );
    });

    it('With all-or-nothing, succeeds even if amount is greater than taker position', async () => {
      // Sell off some of the long position.
      await mintAndDeposit(ctx, thirdParty, new BigNumber(10000));
      await sell(ctx, long, thirdParty, 1, 150);

      // Liquidate the short position.
      await ctx.perpetual.testing.oracle.setPrice(shortUndercollateralizedPrice);
      await liquidate(short, long, positionSize, { allOrNothing: true });
    });

    it('Succeeds liquidating a long against a long', async () => {
      // Turn the short into a long.
      await mintAndDeposit(ctx, thirdParty, new BigNumber(10000));
      const txResult = await buy(ctx, short, thirdParty, positionSize.times(2), new BigNumber(500));

      // Sanity check.
      await expectPositions(
        ctx,
        txResult,
        [long, short],
        [positionSize, positionSize],
        false, // positionsSumToZero
      );

      await ctx.perpetual.testing.oracle.setPrice(longUndercollateralizedPrice);
      await liquidate(long, short, positionSize);
    });

    it('Succeeds liquidating a short against a short', async () => {
      // Turn the long into a short.
      await mintAndDeposit(ctx, thirdParty, new BigNumber(10000));
      const txResult = await sell(ctx, long, thirdParty, positionSize.times(2), 2500);

      // Sanity check.
      await expectPositions(
        ctx,
        txResult,
        [long, short],
        [positionSize.negated(), positionSize.negated()],
        false, // positionsSumToZero
      );

      await ctx.perpetual.testing.oracle.setPrice(shortUndercollateralizedPrice);
      await liquidate(short, long, positionSize);
    });

    it('Succeeds liquidating after an order has executed in the same tx', async () => {
      await Promise.all([
        ctx.perpetual.testing.oracle.setPrice(longUndercollateralizedPrice),
        ctx.perpetual.admin.setGlobalOperator(short, true, { from: admin }),
      ]);

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

      // Fill the order and then liquidate the entire short position.
      await ctx.perpetual.trade.initiate()
        .fillSignedOrder(
          defaultSignedOrder,
          defaultSignedOrder.amount,
          defaultSignedOrder.limitPrice,
          defaultSignedOrder.limitFee,
        )
        .liquidate(long, short, positionSize.plus(new BigNumber(1)), true, false)
        .commit({ from: short });
    });

    it('Cannot liquidate if the sender is not a global operator', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUndercollateralizedPrice);
      const error = 'Sender is not a global operator';
      await expectThrow(
        liquidate(long, short, positionSize, { sender: thirdParty }),
        error,
      );
      await expectThrow(
        liquidate(long, short, positionSize, { sender: admin }),
        error,
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

      it('Cannot directly liquidate the account', async () => {
        await expectThrow(
          liquidate(short, long, positionSize),
          'Cannot liquidate when maker position and margin are both negative',
        );
      });

      it('Succeeds liquidating after bringing margin up to zero', async () => {
        // Avoid additional funding.
        await ctx.perpetual.testing.funder.setFunding(new BaseValue(0));

        // Deposit margin into the target account to bring it to zero margin.
        await ctx.perpetual.margin.withdraw(long, long, 500, { from: long });
        await ctx.perpetual.margin.deposit(short, 500, { from: long });

        // Liquidate the underwater account.
        const txResult = await liquidate(short, long, positionSize);

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

  async function liquidate(
    maker: address,
    taker: address,
    amount: BigNumberable,
    args: {
      allOrNothing?: boolean,
      isBuy?: boolean,
      sender?: address,
    } = {},
  ) {
    let { isBuy } = args;
    if (typeof isBuy !== 'boolean') {
      // By default, infer isBuy from the sign of the maker position.
      isBuy = (await ctx.perpetual.getters.getAccountBalance(maker)).position.isPositive();
    }
    return ctx.perpetual.trade
      .initiate()
      .liquidate(maker, taker, amount, isBuy, !!args.allOrNothing)
      .commit({ from: args.sender || globalOperator });
  }
});
