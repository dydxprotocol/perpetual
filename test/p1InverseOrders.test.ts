import _ from 'lodash';
import BigNumber from 'bignumber.js';

import {
  Balance,
  Fee,
  Order,
  Price,
  SignedOrder,
  SigningMethod,
  OrderStatus,
  address,
} from '../src/lib/types';
import {
  ADDRESSES,
  INTEGERS,
  PRICES,
} from '../src/lib/Constants';
import {
  boolToBytes32,
} from '../src/lib/BytesHelper';
import { expect, expectBN, expectThrow, expectBaseValueEqual } from './helpers/Expect';
import { expectBalances, mintAndDeposit } from './helpers/balances';
import initializePerpetual from './helpers/initializePerpetual';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { buy, sell } from './helpers/trade';

const orderAmount = new BigNumber('1e18');
const limitPrice = new Price('987.65432');
const defaultOrder: Order = {
  limitPrice,
  isBuy: true,
  isDecreaseOnly: false,
  amount: orderAmount,
  triggerPrice: PRICES.NONE,
  limitFee: Fee.fromBips(20),
  maker: ADDRESSES.ZERO,
  taker: ADDRESSES.ZERO,
  expiration: INTEGERS.ONE_YEAR_IN_SECONDS.times(100),
  salt: new BigNumber('425'),
};
const initialMargin = orderAmount.times(2);
const fullFlagOrder: Order = {
  ...defaultOrder,
  isDecreaseOnly: true,
  limitFee: new Fee(defaultOrder.limitFee.value.abs().negated()),
};

let defaultSignedOrder: SignedOrder;
let fullFlagSignedOrder: SignedOrder;
let admin: address;
let otherUser: address;

async function init(ctx: ITestContext) {
  // Use the inverted oracle price.
  await initializePerpetual(
    ctx,
    { oracle: ctx.perpetual.contracts.p1OracleInverter.options.address },
  );

  defaultOrder.maker = fullFlagOrder.maker = ctx.accounts[5];
  defaultOrder.taker = fullFlagOrder.taker = ctx.accounts[1];
  admin = ctx.accounts[0];
  otherUser = ctx.accounts[8];

  defaultSignedOrder = await ctx.perpetual.inverseOrders.getSignedOrder(
    defaultOrder,
    SigningMethod.Hash,
  );
  fullFlagSignedOrder = await ctx.perpetual.inverseOrders.getSignedOrder(
    fullFlagOrder,
    SigningMethod.Hash,
  );

  await Promise.all([
    mintAndDeposit(ctx, defaultOrder.maker, initialMargin),
    mintAndDeposit(ctx, defaultOrder.taker, initialMargin),
    setOraclePrice(ctx, limitPrice),
    ctx.perpetual.admin.setGlobalOperator(
      ctx.perpetual.inverseOrders.address,
      true,
      { from: admin },
    ),
  ]);
}

perpetualDescribe('P1InverseOrders', init, (ctx: ITestContext) => {
  describe('off-chain helpers', () => {
    it('Estimates collateralization after executing buys', async () => {
      // Buy 1e18 at price of 987.65432 with fee of 0.002.
      // base: 1e18 * 0.998 -> worth 1500e18 * 0.998 of quote currency at price of 1500
      // quote: -987.65432e18
      const oraclePrice = new Price(1500);
      const inversePrice = new Price(1).div(oraclePrice.value);
      const quoteAmount = orderAmount.times(limitPrice.value);
      const ratio = ctx.perpetual.inverseOrders.getAccountCollateralizationAfterMakingOrders(
        new Balance(0, 0),
        inversePrice,
        [defaultOrder, defaultOrder, defaultOrder],
        [quoteAmount.div(3), quoteAmount.div(2), quoteAmount.div(6)],
      );

      // Execute the trade on the smart contract.
      // First, withdraw maker margin so it has zero initial balance.
      const { maker } = defaultOrder;
      await Promise.all([
        ctx.perpetual.margin.withdraw(maker, maker, initialMargin, { from: maker }),
        setOraclePrice(ctx, oraclePrice),
      ]);
      await fillOrder();
      const balance = await ctx.perpetual.getters.getAccountBalance(maker);
      expectBN(ratio, 'simulated vs. on-chain').to.equal(
        balance.getCollateralization(inversePrice),
      );

      // Compare with the expected result.
      const expectedRatio = new BigNumber(1500 * 0.998).div(987.65432);
      expectBN(ratio.dp(30), 'simulated vs. expected').to.equal(expectedRatio.dp(30));
    });

    it('Estimates collateralization after executing sells', async () => {
      // Sell 1e18 at price of 987.65432 with fee of 0.002.
      // base: -1e18 * 1.002 -> worth -500e18 * 1.002 of quote currency at price of 500
      // quote: 987.65432e18
      const oraclePrice = new Price(500);
      const inversePrice = new Price(1).div(oraclePrice.value);
      const sellOrder = await getModifiedOrder({ isBuy: false });
      const ratio = ctx.perpetual.inverseOrders.getAccountCollateralizationAfterMakingOrders(
        new Balance(0, 0),
        inversePrice,
        [sellOrder, sellOrder, sellOrder],
        [orderAmount.div(3), orderAmount.div(2), orderAmount.div(6)],
      );

      // Execute the trade on the smart contract.
      // First, withdraw maker margin so it has zero initial balance.
      const { maker } = defaultOrder;
      await Promise.all([
        ctx.perpetual.margin.withdraw(maker, maker, initialMargin, { from: maker }),
        setOraclePrice(ctx, oraclePrice),
      ]);
      await fillOrder(sellOrder);
      const balance = await ctx.perpetual.getters.getAccountBalance(maker);
      expectBN(ratio, 'simulated vs. on-chain').to.equal(
        balance.getCollateralization(inversePrice),
      );

      // Compare with the expected result.
      const expectedRatio = new BigNumber(987.65432).div(500 * 1.002);
      expectBN(ratio, 'simulated vs. expected').to.equal(expectedRatio);
    });

    it('Estimates collateralization when positive balance is zero', async () => {
      // Inverse perpetual: The quote amount is the position amount.
      const defaultQuoteAmount = orderAmount.times(limitPrice.value);

      // Inverse perpetual: Sell the base currency to sell margin token and buy position.
      const order = await getModifiedOrder({ limitPrice: limitPrice.div(2), isBuy: false });

      const ratio = ctx.perpetual.inverseOrders.getAccountCollateralizationAfterMakingOrders(
        new Balance(initialMargin, defaultQuoteAmount.negated()),
        limitPrice,
        [order],
        [initialMargin],
      );
      expectBN(ratio).to.equal(0);
    });

    it('Estimates collateralization when negative balance is zero', () => {
      // Inverse perpetual: The quote amount is the position amount.
      const quoteAmount = orderAmount.times(limitPrice.value);

      const ratio = ctx.perpetual.inverseOrders.getAccountCollateralizationAfterMakingOrders(
        new Balance(initialMargin, quoteAmount),
        limitPrice,
        [defaultOrder],
        [quoteAmount.div(2)],
      );
      expectBN(ratio).to.equal(Infinity);
    });

    it('Estimates collateralization when balance is zero', async () => {
      const buyOrder = await getModifiedOrder({ limitFee: new Fee(0) });
      const sellOrder = await getModifiedOrder({ isBuy: false, limitFee: new Fee(0) });
      const quoteAmount = orderAmount.times(limitPrice.value);
      const ratio1 = ctx.perpetual.inverseOrders.getAccountCollateralizationAfterMakingOrders(
        new Balance(0, 0),
        limitPrice,
        [buyOrder, sellOrder],
        [quoteAmount, orderAmount],
      );
      expectBN(ratio1).to.equal(Infinity);
    });
  });

  describe('approveOrder()', () => {
    it('Succeeds', async () => {
      const txResult = await ctx.perpetual.inverseOrders.approveOrder(
        fullFlagOrder,
        { from: fullFlagOrder.maker },
      );
      await expectStatus(fullFlagOrder, OrderStatus.Approved);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogOrderApproved');
      expect(logs[0].args.orderHash).to.equal(
        ctx.perpetual.inverseOrders.getOrderHash(fullFlagOrder),
      );
      expect(logs[0].args.maker).to.equal(fullFlagOrder.maker);
    });

    it('Succeeds in double-approving order', async () => {
      await ctx.perpetual.inverseOrders.approveOrder(fullFlagOrder, { from: fullFlagOrder.maker });
      await ctx.perpetual.inverseOrders.approveOrder(fullFlagOrder, { from: fullFlagOrder.maker });
      await expectStatus(fullFlagOrder, OrderStatus.Approved);
    });

    it('Fails if caller is not the maker', async () => {
      await expectThrow(
        ctx.perpetual.inverseOrders.approveOrder(fullFlagOrder, { from: fullFlagOrder.taker }),
        'Order cannot be approved by non-maker',
      );
    });

    it('Fails to approve canceled order', async () => {
      await ctx.perpetual.inverseOrders.cancelOrder(fullFlagOrder, { from: fullFlagOrder.maker });
      await expectThrow(
        ctx.perpetual.inverseOrders.approveOrder(fullFlagOrder, { from: fullFlagOrder.maker }),
        'Canceled order cannot be approved',
      );
    });
  });

  describe('cancelOrder()', () => {
    it('Succeeds', async () => {
      const txResult = await ctx.perpetual.inverseOrders.cancelOrder(
        fullFlagOrder,
        { from: fullFlagOrder.maker },
      );
      await expectStatus(fullFlagOrder, OrderStatus.Canceled);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogOrderCanceled');
      expect(logs[0].args.orderHash).to.equal(
        ctx.perpetual.inverseOrders.getOrderHash(fullFlagOrder),
      );
      expect(logs[0].args.maker).to.equal(fullFlagOrder.maker);
    });

    it('Succeeds in double-canceling order', async () => {
      await ctx.perpetual.inverseOrders.cancelOrder(fullFlagOrder, { from: fullFlagOrder.maker });
      await ctx.perpetual.inverseOrders.cancelOrder(fullFlagOrder, { from: fullFlagOrder.maker });
      await expectStatus(fullFlagOrder, OrderStatus.Canceled);
    });

    it('Fails if caller is not the maker', async () => {
      await expectThrow(
        ctx.perpetual.inverseOrders.cancelOrder(fullFlagOrder, { from: fullFlagOrder.taker }),
        'Order cannot be canceled by non-maker',
      );
    });

    it('Succeeds in canceling approved order', async () => {
      await ctx.perpetual.inverseOrders.approveOrder(fullFlagOrder, { from: fullFlagOrder.maker });
      await ctx.perpetual.inverseOrders.cancelOrder(fullFlagOrder, { from: fullFlagOrder.maker });
      await expectStatus(fullFlagOrder, OrderStatus.Canceled);
    });
  });

  describe('trade()', () => {
    describe('basic success cases', () => {
      it('fills a bid at the limit price', async () => {
        await fillOrder();
      });

      it('fills an ask at the limit price', async () => {
        await fillOrder({ isBuy: false });
      });

      it('fills a bid below the limit price', async () => {
        await fillOrder(
          {},
          { price: defaultOrder.limitPrice.minus(25) },
        );
      });

      it('fills an ask above the limit price', async () => {
        await fillOrder(
          { isBuy: false },
          { price: defaultOrder.limitPrice.plus(25) },
        );
      });

      it('fills a bid with a fee less than the limit fee', async () => {
        await fillOrder(
          {},
          {
            fee: defaultOrder.limitFee.div(2),
            price: defaultOrder.limitPrice.minus(25),
          },
        );
      });

      it('fills an ask with a fee less than the limit fee', async () => {
        await fillOrder(
          { isBuy: false },
          {
            fee: defaultOrder.limitFee.div(2),
            price: defaultOrder.limitPrice.plus(25),
          },
        );
      });

      it('succeeds if sender is a local operator', async () => {
        await ctx.perpetual.operator.setLocalOperator(
          otherUser,
          true,
          { from: defaultOrder.taker },
        );
        await fillOrder({}, { sender: otherUser });
      });

      it('succeeds if sender is a global operator', async () => {
        await ctx.perpetual.admin.setGlobalOperator(
          otherUser,
          true,
          { from: admin },
        );
        await fillOrder({}, { sender: otherUser });
      });

      it('succeeds with an invalid signature for an order approved on-chain', async () => {
        await ctx.perpetual.inverseOrders.approveOrder(defaultOrder, { from: defaultOrder.maker });
        const order = {
          ...defaultSignedOrder,
          typedSignature: `0xff${defaultSignedOrder.typedSignature.substr(4)}`,
        };
        await fillOrder(order);
      });

      it('succeeds repeating an order (with a different salt)', async () => {
        await fillOrder();
        await fillOrder({ salt: defaultOrder.salt.plus(1) });
      });
    });

    describe('basic failure cases', () => {
      it('fails for calls not from the perpetual contract', async () => {
        await expectThrow(
          ctx.perpetual.contracts.send(
            ctx.perpetual.contracts.p1InverseOrders.methods.trade(
              admin,
              admin,
              admin,
              '0',
              '0x',
              boolToBytes32(false),
            ),
            { from: admin },
          ),
          'msg.sender must be PerpetualV1',
        );
      });

      it('fails if sender is not the taker or an authorized operator', async () => {
        await expectThrow(
          fillOrder(defaultSignedOrder, { sender: otherUser }),
          'Sender does not have permissions for the taker',
        );
      });

      it('fails for bad signature', async () => {
        const order = {
          ...defaultSignedOrder,
          typedSignature: `0xffff${defaultSignedOrder.typedSignature.substr(6)}`,
        };
        await expectThrow(
          fillOrder(order),
          'Order has an invalid signature',
        );
      });

      it('fails for canceled order', async () => {
        await ctx.perpetual.inverseOrders.cancelOrder(defaultOrder, { from: defaultOrder.maker });
        await expectThrow(
          fillOrder(),
          'Order was already canceled',
        );
      });

      it('fails for wrong maker', async () => {
        const tradeData = ctx.perpetual.inverseOrders.fillToTradeData(
          defaultSignedOrder,
          defaultOrder.amount,
          defaultOrder.limitPrice,
          defaultOrder.limitFee,
        );
        await expectThrow(
          ctx.perpetual.trade
            .initiate()
            .addTradeArg({
              maker: otherUser,
              taker: defaultOrder.taker,
              data: tradeData,
              trader: ctx.perpetual.inverseOrders.address,
            })
            .commit({ from: defaultOrder.taker }),
          'Order maker does not match maker',
        );
      });

      it('fails for wrong taker', async () => {
        const tradeData = ctx.perpetual.inverseOrders.fillToTradeData(
          defaultSignedOrder,
          defaultOrder.amount,
          defaultOrder.limitPrice,
          defaultOrder.limitFee,
        );
        await expectThrow(
          ctx.perpetual.trade
            .initiate()
            .addTradeArg({
              maker: defaultOrder.maker,
              taker: otherUser,
              data: tradeData,
              trader: ctx.perpetual.inverseOrders.address,
            })
            .commit({ from: otherUser }),
          'Order taker does not match taker',
        );
      });

      it('fails if the order has expired', async () => {
        await expectThrow(
          fillOrder({ expiration: new BigNumber(1) }),
          'Order has expired',
        );
      });

      it('fails to fill a bid at a price above the limit price', async () => {
        await expectThrow(
          fillOrder({}, { price: defaultOrder.limitPrice.plus(1) }),
          'Fill price is invalid',
        );
      });

      it('fails to fill an ask at a price below the limit price', async () => {
        await expectThrow(
          fillOrder({ isBuy: false }, { price: defaultOrder.limitPrice.minus(1) }),
          'Fill price is invalid',
        );
      });

      it('fails if fee is greater than limit fee', async () => {
        await expectThrow(
          fillOrder({}, { fee: defaultOrder.limitFee.plus(1) }),
          'Fill fee is invalid',
        );
      });

      it('fails to overfill order', async () => {
        await expectThrow(
          fillOrder({}, { amount: defaultOrder.amount.plus(1) }),
          'Cannot overfill order',
        );
      });

      it('fails to overfill partially filled order', async () => {
        const halfAmount = defaultOrder.amount.div(2);
        await fillOrder({}, { amount: halfAmount });
        await expectThrow(
          fillOrder({}, { amount: halfAmount.plus(1) }),
          'Cannot overfill order',
        );
      });

      it('fails for an order that was already filled', async () => {
        await fillOrder();
        await expectThrow(
          fillOrder(),
          'Cannot overfill order',
        );
      });
    });

    describe('with triggerPrice', () => {
      it('fills a bid with the oracle price at the trigger price', async () => {
        // limit bid |
        //        -5 | fill price
        //       -10 | trigger price, oracle price
        const triggerPrice = defaultOrder.limitPrice.minus(10);
        const fillPrice = defaultOrder.limitPrice.minus(5);
        const oraclePrice = defaultOrder.limitPrice.minus(10);
        await setOraclePrice(ctx, oraclePrice);
        await fillOrder({ triggerPrice }, { price: fillPrice });
      });

      it('fills an ask with the oracle price at the trigger price', async () => {
        //       +10 | trigger price, oracle price
        //        +5 | fill price
        // limit ask |

        // Due to the use of the oracle inverter, rounding errors may cause the oracle price to be
        // very slightly higher than expected. Adjust the trigger price to account for this.
        const triggerPrice = defaultOrder.limitPrice.plus(10).plus(1e-12);
        const fillPrice = defaultOrder.limitPrice.plus(5);
        const oraclePrice = defaultOrder.limitPrice.plus(10);
        await setOraclePrice(ctx, oraclePrice);
        await fillOrder({ triggerPrice, isBuy: false }, { price: fillPrice });
      });

      it('fills a bid with the oracle price above the trigger price', async () => {
        //       +10 | oracle price
        //           |
        // limit bid |
        //        -5 | fill price
        //       -10 | trigger price
        const triggerPrice = defaultOrder.limitPrice.minus(10);
        const fillPrice = defaultOrder.limitPrice.minus(5);
        const oraclePrice = defaultOrder.limitPrice.plus(10);
        await setOraclePrice(ctx, oraclePrice);
        await fillOrder({ triggerPrice }, { price: fillPrice });
      });

      it('fills an ask with the oracle price below the trigger price', async () => {
        //       +10 | trigger price, oracle price
        //        +5 | fill price
        // limit ask |
        //           |
        //       -10 | oracle price
        const triggerPrice = defaultOrder.limitPrice.plus(10);
        const fillPrice = defaultOrder.limitPrice.plus(5);
        const oraclePrice = defaultOrder.limitPrice.minus(10);
        await setOraclePrice(ctx, oraclePrice);
        await fillOrder({ triggerPrice, isBuy: false }, { price: fillPrice });
      });

      it('fails to fill a bid if the oracle price is below the trigger price', async () => {
        // limit bid |
        //       -10 | trigger price
        //       -11 | oracle price
        const triggerPrice = defaultOrder.limitPrice.minus(10);
        await setOraclePrice(ctx, triggerPrice.minus(1));
        await expectThrow(
          fillOrder({ triggerPrice }),
          'Trigger price has not been reached',
        );
      });

      it('fails to fill an ask if the oracle price is above the trigger price', async () => {
        //       +11 | oracle price
        //       +10 | trigger price
        // limit ask |
        const triggerPrice = defaultOrder.limitPrice.plus(10);
        await setOraclePrice(ctx, triggerPrice.plus(1));
        await expectThrow(
          fillOrder({ triggerPrice, isBuy: false }),
          'Trigger price has not been reached',
        );
      });
    });

    describe('in decrease-only mode', () => {
      it('fills a bid', async () => {
        // Give the maker a short position.
        const { limitFee, limitPrice, maker, taker } = defaultOrder;
        const marginAmount = orderAmount.times(limitFee.plus(1).value);
        const positionAmount = orderAmount.times(limitPrice.value);
        await sell(ctx, maker, taker, positionAmount, marginAmount);

        // Fill the order to decrease the short position to zero.
        await fillOrder({ isDecreaseOnly: true });
      });

      it('fills an ask', async () => {
        // Give the maker a long position.
        const { limitFee, limitPrice, maker, taker } = defaultOrder;
        const marginAmount = orderAmount.times(limitFee.plus(1).value);
        const positionAmount = orderAmount.times(limitPrice.value);
        await buy(ctx, maker, taker, positionAmount, marginAmount);

        // Fill the order to decrease the long position to zero.
        await fillOrder({ isBuy: false, isDecreaseOnly: true });
      });

      it('fails to fill a bid if maker position is positive', async () => {
        const { maker, taker } = defaultOrder;

        // Inverse perpetual: Selling position means buying the base currency.
        await sell(ctx, maker, taker, new BigNumber(1), 0);
        await expectThrow(
          fillOrder({ isDecreaseOnly: true }),
          'Fill does not decrease position',
        );
      });

      it('fails to fill an ask if maker position is negative', async () => {
        const { maker, taker } = defaultOrder;

        // Inverse perpetual: Buying position means selling the base currency.
        await buy(ctx, maker, taker, new BigNumber(1), 0);
        await expectThrow(
          fillOrder({ isBuy: false, isDecreaseOnly: true }),
          'Fill does not decrease position',
        );
      });

      it('fails to fill a bid if maker position would become positive', async () => {
        const { limitPrice, maker, taker } = defaultOrder;
        const cost = orderAmount.minus(1).dividedBy(limitPrice.value);

        // Inverse perpetual: Buying position means selling the base currency.
        await buy(ctx, maker, taker, orderAmount.minus(1), cost);
        await expectThrow(
          fillOrder({ isDecreaseOnly: true }),
          'Fill does not decrease position',
        );
      });

      it('fails to fill an ask if maker position would become negative', async () => {
        const { limitPrice, maker, taker } = defaultOrder;
        const cost = orderAmount.minus(1).dividedBy(limitPrice.value);

        // Inverse perpetual: Selling position means buying the base currency.
        await sell(ctx, maker, taker, orderAmount.minus(1), cost);
        await expectThrow(
          fillOrder({ isBuy: false, isDecreaseOnly: true }),
          'Fill does not decrease position',
        );
      });
    });

    describe('with negative limit fee', () => {
      it('fills a bid', async () => {
        const negativeFee = new Fee(defaultOrder.limitFee.value.abs().negated());
        await fillOrder({ limitFee: negativeFee });
      });

      it('fills an ask', async () => {
        const negativeFee = new Fee(defaultOrder.limitFee.value.abs().negated());
        await fillOrder({ isBuy: false, limitFee: negativeFee });
      });

      it('fails if fee is greater than limit fee', async () => {
        await expectThrow(
          fillOrder(fullFlagSignedOrder, { fee: fullFlagOrder.limitFee.plus(1) }),
          'Fill fee is invalid',
        );
      });
    });
  });

  // ============ Helper Functions ============

  async function getModifiedOrder(
    args: Partial<Order>,
  ): Promise<SignedOrder> {
    const newOrder: Order = {
      ...defaultOrder,
      ...args,
    };
    return ctx.perpetual.inverseOrders.getSignedOrder(newOrder, SigningMethod.Hash);
  }

  /**
   * Fill an order an check that the logs are as expected.
   */
  async function fillOrder(
    orderArgs: Partial<SignedOrder> = {},
    fillArgs: {
      amount?: BigNumber,
      price?: Price,
      fee?: Fee,
      sender?: address,
    } = {},
  ): Promise<void> {
    const order: SignedOrder = orderArgs.typedSignature
      ? orderArgs as SignedOrder
      : await getModifiedOrder(orderArgs);
    const fillAmount = fillArgs.amount || order.amount;
    const fillPrice = fillArgs.price || order.limitPrice;
    const fillFee = fillArgs.fee || order.limitFee;
    const sender = fillArgs.sender || order.taker;

    // Get initial balances.
    const [makerBalance, takerBalance] = await Promise.all([
      ctx.perpetual.getters.getAccountBalance(order.maker),
      ctx.perpetual.getters.getAccountBalance(order.taker),
    ]);
    const { margin: makerMargin, position: makerPosition } = makerBalance;
    const { margin: takerMargin, position: takerPosition } = takerBalance;

    const txResult = await ctx.perpetual.inverseTrade
      .initiate()
      .fillSignedOrder(
        order,
        fillAmount,
        fillPrice,
        fillFee,
      )
      .commit({ from: sender });

    // Check final balances.
    const {
      marginDelta,
      positionDelta,
    } = ctx.perpetual.inverseOrders.getBalanceUpdatesAfterFillingOrder(
      fillAmount,
      fillPrice,
      fillFee,
      order.isBuy,
    );
    await expectBalances(
      ctx,
      txResult,
      [order.maker, order.taker],
      [makerMargin.plus(marginDelta), takerMargin.minus(marginDelta)],
      [makerPosition.plus(positionDelta), takerPosition.minus(positionDelta)],
    );

    // Check logs.
    const logs = ctx.perpetual.logs.parseLogs(txResult);
    const filteredLogs = _.filter(logs, { name: 'LogOrderFilled' });
    expect(filteredLogs.length).to.equal(1);
    const [log] = filteredLogs;
    expect(log.args.orderHash, 'log hash').to.equal(
      ctx.perpetual.inverseOrders.getOrderHash(order),
    );
    expect(log.args.flags.isBuy, 'log isBuy').to.equal(order.isBuy);
    expect(log.args.flags.isDecreaseOnly, 'log isDecreaseOnly').to.equal(order.isDecreaseOnly);
    expect(log.args.flags.isNegativeLimitFee, 'log isNegativeLimitFee').to.equal(
      order.limitFee.isNegative(),
    );
    expectBaseValueEqual(log.args.triggerPrice, order.triggerPrice, 'log trigger price');
    expectBN(log.args.fill.amount, 'log fill amount').to.equal(fillAmount);
    expectBaseValueEqual(log.args.fill.price, fillPrice, 'log fill price');
    expectBaseValueEqual(log.args.fill.fee, fillFee.abs(), 'log fill fee');
    expect(log.args.fill.isNegativeFee, 'log fill isNegativeLimitFee').to.equal(
      order.limitFee.isNegative(),
    );
  }

  async function expectStatus(
    order: Order,
    status: OrderStatus,
    filledAmount?: BigNumber,
  ) {
    const statuses = await ctx.perpetual.inverseOrders.getOrdersStatus([order]);
    expect(statuses[0].status).to.equal(status);
    if (filledAmount) {
      expectBN(statuses[0].filledAmount).to.equal(filledAmount);
    }
  }
});

/**
 * Update the oracle price on the underlying oracle used by the oracle inverter.
 */
async function setOraclePrice(ctx: ITestContext, price: Price): Promise<void> {
  // Divide by 100 to account for the adjustment factor, set when deploying P1OracleInverter.
  await ctx.perpetual.testing.makerOracle.setPrice(price.div(100));
}
