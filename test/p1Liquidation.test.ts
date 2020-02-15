import BigNumber from 'bignumber.js';

import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import { expectBalances, mintAndDeposit, expectPositions } from './helpers/balances';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { buy, sell } from './helpers/trade';
import { expectThrow } from './helpers/Expect';
import { address } from '../src';
import { INTEGERS } from '../src/lib/Constants';
import {
  Order,
  SignedOrder,
  SigningMethod,
} from '../src/lib/types';

const initialPrice = new BigNumber(100).shiftedBy(18);
const longBorderlinePrice = new BigNumber(55).shiftedBy(18);
const longUndercollateralizedPrice = new BigNumber(54.9).shiftedBy(18);
const longUnderwaterPrice = new BigNumber(49.9).shiftedBy(18);
const shortBorderlinePrice = new BigNumber(136.37).shiftedBy(18);
const shortUndercollateralizedPrice = new BigNumber(136.5).shiftedBy(18);
const shortUnderwaterPrice = new BigNumber(150.1).shiftedBy(18);
const positionSize = new BigNumber(10);

let long: address;
let short: address;
let thirdParty: address;
async function init(ctx: ITestContext): Promise<void> {
  await initializeWithTestContracts(ctx);
  long = ctx.accounts[1];
  short = ctx.accounts[2];
  thirdParty = ctx.accounts[3];
}

perpetualDescribe('P1Liquidation', init, (ctx: ITestContext) => {
  beforeEach(async () => {
    await Promise.all([
      ctx.perpetual.testing.oracle.setPrice(initialPrice),
      mintAndDeposit(ctx, long, new BigNumber(500)),
      mintAndDeposit(ctx, short, new BigNumber(500)),
    ]);
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
        ctx.perpetual.liquidation.trade(
          long,
          short,
          long,
          shortUndercollateralizedPrice,
          positionSize,
        ),
      );
    });
  });

  describe('trade(), via PerpetualV1', () => {
    it('Succeeds fully liquidating an undercollateralized long position', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUndercollateralizedPrice);
      await liquidate(long, short, positionSize);
      await expectBalances(
        ctx,
        [long, short],
        [new BigNumber(0), new BigNumber(1000)],
        [new BigNumber(0), new BigNumber(0)],
      );
    });

    it('Succeeds fully liquidating an undercollateralized short position', async () => {
      await ctx.perpetual.testing.oracle.setPrice(shortUndercollateralizedPrice);
      await liquidate(short, long, positionSize);
      await expectBalances(
        ctx,
        [long, short],
        [new BigNumber(1000), new BigNumber(0)],
        [new BigNumber(0), new BigNumber(0)],
      );
    });

    it('Succeeds fully liquidating an underwater long position', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);
      await liquidate(long, short, positionSize);
      await expectBalances(
        ctx,
        [long, short],
        [new BigNumber(0), new BigNumber(1000)],
        [new BigNumber(0), new BigNumber(0)],
      );
    });

    it('Succeeds fully liquidating an underwater short position', async () => {
      await ctx.perpetual.testing.oracle.setPrice(shortUnderwaterPrice);
      await liquidate(short, long, positionSize);
      await expectBalances(
        ctx,
        [long, short],
        [new BigNumber(1000), new BigNumber(0)],
        [new BigNumber(0), new BigNumber(0)],
      );
    });

    it('Succeeds with all-or-nothing', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUndercollateralizedPrice);
      await liquidate(long, short, positionSize, true);
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

      // Liquidate the short position.
      await ctx.perpetual.testing.oracle.setPrice(shortUndercollateralizedPrice);
      await liquidate(short, long, positionSize);

      // The actual amount executed should be bounded by the maker position.
      await expectBalances(
        ctx,
        [long, short, thirdParty],
        [new BigNumber(850), new BigNumber(0), new BigNumber(10150)],
        [new BigNumber(1), new BigNumber(0), new BigNumber(-1)],
      );
    });

    it('Succeeds even if amount is greater than the taker position', async() => {
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
      await liquidate(short, long, positionSize);

      // Liquidiation amount should NOT be bounded by the taker position.
      await expectBalances(
        ctx,
        [long, short, thirdParty],
        [new BigNumber(1150), new BigNumber(0), new BigNumber(9850)],
        [new BigNumber(-1), new BigNumber(0), new BigNumber(1)],
      );
    });

    it('Cannot liquidate if the sender is not the taker', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longBorderlinePrice);
      await expectThrow(
        ctx.perpetual.trade
          .initiate()
          .liquidate(long, short, positionSize)
          .commit({ from: long }),
        'Cannot liquidate since the sender is not the taker (i.e. liquidator)',
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

    it('With all-or-nothing, fails if amount is greater than the maker position', async () => {
      // Attempt to liquidate the short position.
      await ctx.perpetual.testing.oracle.setPrice(shortUndercollateralizedPrice);
      await expectThrow(
        liquidate(short, long, positionSize.plus(1), true),
        'allOrNothing is set and maker position is less than amount',
      );
    });

    it('With all-or-nothing, succeeds even if amount is greater than taker position', async () => {
      // Sell off some of the long position.
      await mintAndDeposit(ctx, thirdParty, new BigNumber(10000));
      await sell(ctx, long, thirdParty, new BigNumber(1), new BigNumber(150));

      // Liquidate the short position.
      await ctx.perpetual.testing.oracle.setPrice(shortUndercollateralizedPrice);
      await liquidate(short, long, positionSize, true);
    });

    it('Succeeds liquidating a long against a long', async () => {
      // Turn the short into a long.
      await mintAndDeposit(ctx, thirdParty, new BigNumber(10000));
      await buy(ctx, short, thirdParty, positionSize.times(2), new BigNumber(500));

      // Sanity check.
      await expectPositions(
        ctx,
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
      await sell(ctx, long, thirdParty, positionSize.times(2), new BigNumber(2500));

      // Sanity check.
      await expectPositions(
        ctx,
        [long, short],
        [positionSize.negated(), positionSize.negated()],
        false, // positionsSumToZero
      );

      await ctx.perpetual.testing.oracle.setPrice(shortUndercollateralizedPrice);
      await liquidate(short, long, positionSize);
    });

    it('Succeeds liquidating after an order has executed in the same tx', async () => {
      await ctx.perpetual.testing.oracle.setPrice(longUndercollateralizedPrice);

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

      // Fill the order and then liquidate the entire short position.
      await ctx.perpetual.trade.initiate()
        .fillSignedOrder(
          defaultSignedOrder,
          defaultSignedOrder.amount,
          defaultSignedOrder.limitPrice,
          defaultSignedOrder.limitFee,
        )
        .liquidate(long, short, positionSize.plus(new BigNumber(1)))
        .commit({ from: short });
    });
  });

  async function liquidate(
    maker: address,
    taker: address,
    amount: BigNumber,
    allOrNothing: boolean = false,
  ) {
    return ctx.perpetual.trade
      .initiate()
      .liquidate(maker, taker, amount, allOrNothing)
      .commit({ from: taker });
  }
});
