import _ from 'lodash';
import BigNumber from 'bignumber.js';

import {
  Fee,
  Order,
  Price,
  SignedOrder,
  SigningMethod,
  OrderStatus,
  TxResult,
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
import { expect, expectBN, expectThrow } from './helpers/Expect';
import { expectBalances, mintAndDeposit } from './helpers/balances';
import initializePerpetual from './helpers/initializePerpetual';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { buy, sell } from './helpers/trade';

const orderAmount = new BigNumber('1e18');
const defaultOrder: Order = {
  isBuy: true,
  isDecreaseOnly: false,
  amount: orderAmount,
  limitPrice: new Price('987.654320'),
  triggerPrice: PRICES.NONE,
  limitFee: Fee.fromBips(20),
  maker: ADDRESSES.ZERO,
  taker: ADDRESSES.ZERO,
  expiration: INTEGERS.ONE_YEAR_IN_SECONDS.times(100),
  salt: new BigNumber('425'),
};
const initialMargin = orderAmount.times(defaultOrder.limitPrice.value).times(2);
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
  await initializePerpetual(ctx);

  defaultOrder.maker = fullFlagOrder.maker = ctx.accounts[5];
  defaultOrder.taker = fullFlagOrder.taker = ctx.accounts[1];
  admin = ctx.accounts[0];
  otherUser = ctx.accounts[8];

  defaultSignedOrder = await ctx.perpetual.orders.getSignedOrder(defaultOrder, SigningMethod.Hash);
  fullFlagSignedOrder = await ctx.perpetual.orders.getSignedOrder(
    fullFlagOrder,
    SigningMethod.Hash,
  );

  // Set up initial balances:
  await Promise.all([
    mintAndDeposit(ctx, defaultOrder.maker, initialMargin),
    mintAndDeposit(ctx, defaultOrder.taker, initialMargin),
  ]);
}

perpetualDescribe('P1Orders', init, (ctx: ITestContext) => {

  describe('Signing', () => {
    it('Signs correctly for hash', async () => {
      const typedSignature = await ctx.perpetual.orders.signOrder(
        defaultOrder,
        SigningMethod.Hash,
      );
      const validSignature = ctx.perpetual.orders.orderHasValidSignature({
        ...defaultOrder,
        typedSignature,
      });
      expect(validSignature).to.be.true;
    });

    it('Signs correctly for typed data', async () => {
      const typedSignature = await ctx.perpetual.orders.signOrder(
        defaultOrder,
        SigningMethod.TypedData,
      );
      const validSignature = ctx.perpetual.orders.orderHasValidSignature({
        ...defaultOrder,
        typedSignature,
      });
      expect(validSignature).to.be.true;
    });

    it('Recognizes invalid signatures', async () => {
      const badSignatures = [
        `0x${'00'.repeat(63)}00`,
        `0x${'ab'.repeat(63)}01`,
        `0x${'01'.repeat(70)}01`,
      ];
      badSignatures.map((sig) => {
        const validSignature = ctx.perpetual.orders.orderHasValidSignature({
          ...defaultOrder,
          typedSignature: sig,
        });
        expect(validSignature).to.be.false;
      });
    });
  });

  describe('approveOrder()', () => {
    it('Succeeds', async () => {
      const txResult = await ctx.perpetual.orders.approveOrder(
        fullFlagOrder,
        { from: fullFlagOrder.maker },
      );
      await expectStatus(fullFlagOrder, OrderStatus.Approved);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogOrderApproved');
      expect(logs[0].args.orderHash).to.equal(ctx.perpetual.orders.getOrderHash(fullFlagOrder));
      expect(logs[0].args.maker).to.equal(fullFlagOrder.maker);
    });

    it('Succeeds in double-approving order', async () => {
      await ctx.perpetual.orders.approveOrder(fullFlagOrder, { from: fullFlagOrder.maker });
      await ctx.perpetual.orders.approveOrder(fullFlagOrder, { from: fullFlagOrder.maker });
      await expectStatus(fullFlagOrder, OrderStatus.Approved);
    });

    it('Fails if caller is not the maker', async () => {
      await expectThrow(
        ctx.perpetual.orders.approveOrder(fullFlagOrder, { from: fullFlagOrder.taker }),
        'Order cannot be approved by non-maker',
      );
    });

    it('Fails to approve canceled order', async () => {
      await ctx.perpetual.orders.cancelOrder(fullFlagOrder, { from: fullFlagOrder.maker });
      await expectThrow(
        ctx.perpetual.orders.approveOrder(fullFlagOrder, { from: fullFlagOrder.maker }),
        'Canceled order cannot be approved',
      );
    });
  });

  describe('cancelOrder()', () => {
    it('Succeeds', async () => {
      const txResult = await ctx.perpetual.orders.cancelOrder(
        fullFlagOrder,
        { from: fullFlagOrder.maker },
      );
      await expectStatus(fullFlagOrder, OrderStatus.Canceled);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogOrderCanceled');
      expect(logs[0].args.orderHash).to.equal(ctx.perpetual.orders.getOrderHash(fullFlagOrder));
      expect(logs[0].args.maker).to.equal(fullFlagOrder.maker);
    });

    it('Succeeds in double-canceling order', async () => {
      await ctx.perpetual.orders.cancelOrder(fullFlagOrder, { from: fullFlagOrder.maker });
      await ctx.perpetual.orders.cancelOrder(fullFlagOrder, { from: fullFlagOrder.maker });
      await expectStatus(fullFlagOrder, OrderStatus.Canceled);
    });

    it('Fails if caller is not the maker', async () => {
      await expectThrow(
        ctx.perpetual.orders.cancelOrder(fullFlagOrder, { from: fullFlagOrder.taker }),
        'Order cannot be canceled by non-maker',
      );
    });

    it('Succeeds in canceling approved order', async () => {
      await ctx.perpetual.orders.approveOrder(fullFlagOrder, { from: fullFlagOrder.maker });
      await ctx.perpetual.orders.cancelOrder(fullFlagOrder, { from: fullFlagOrder.maker });
      await expectStatus(fullFlagOrder, OrderStatus.Canceled);
    });
  });

  describe('trade()', () => {
    describe('basic success cases', () => {
      it('fills a bid at the limit price', async () => {
        const { expectedMarginAmount, txResult } = await fillOrder(defaultSignedOrder);
        await expectBalances(
          ctx,
          txResult,
          [defaultOrder.maker, defaultOrder.taker],
          [initialMargin.minus(expectedMarginAmount), initialMargin.plus(expectedMarginAmount)],
          [orderAmount, orderAmount.negated()],
        );

        // Check logs.
        const logs = ctx.perpetual.logs.parseLogs(txResult);
        const filteredLogs = _.filter(logs, { name: 'LogOrderFilled' });
        expect(filteredLogs.length).to.equal(1);
        expect(filteredLogs[0].args.orderHash).to.equal(
          ctx.perpetual.orders.getOrderHash(defaultOrder),
        );
        expect(filteredLogs[0].args.flags.isBuy).to.equal(true);
        expect(filteredLogs[0].args.flags.isDecreaseOnly).to.equal(false);
        expect(filteredLogs[0].args.flags.isNegativeLimitFee).to.equal(false);
        expectBN(filteredLogs[0].args.fill.amount).to.equal(defaultOrder.amount);
        expect(filteredLogs[0].args.fill.price.toString()).to.equal(
          defaultOrder.limitPrice.toSolidity(),
        );
        expect(filteredLogs[0].args.fill.fee.toString()).to.equal(
          defaultOrder.limitFee.toSolidity(),
        );
        expect(filteredLogs[0].args.fill.isNegativeFee).to.equal(false);
      });

      it('fills an ask at the limit price', async () => {
        const sellOrder = await getModifiedOrder({ isBuy: false });
        const { expectedMarginAmount, txResult } = await fillOrder(sellOrder);
        await expectBalances(
          ctx,
          txResult,
          [defaultOrder.maker, defaultOrder.taker],
          [initialMargin.plus(expectedMarginAmount), initialMargin.minus(expectedMarginAmount)],
          [orderAmount.negated(), orderAmount],
        );

        // Check logs.
        const logs = ctx.perpetual.logs.parseLogs(txResult);
        const filteredLogs = _.filter(logs, { name: 'LogOrderFilled' });
        expect(filteredLogs.length).to.equal(1);
        expect(filteredLogs[0].args.orderHash).to.equal(
          ctx.perpetual.orders.getOrderHash(sellOrder),
        );
        expect(filteredLogs[0].args.flags.isBuy).to.equal(false);
        expect(filteredLogs[0].args.flags.isDecreaseOnly).to.equal(false);
        expect(filteredLogs[0].args.flags.isNegativeLimitFee).to.equal(false);
        expectBN(filteredLogs[0].args.fill.amount).to.equal(defaultOrder.amount);
        expect(filteredLogs[0].args.fill.price.toString()).to.equal(
          defaultOrder.limitPrice.toSolidity(),
        );
        expect(filteredLogs[0].args.fill.fee.toString()).to.equal(
          defaultOrder.limitFee.toSolidity(),
        );
        expect(filteredLogs[0].args.fill.isNegativeFee).to.equal(false);
      });

      it('fills a bid below the limit price', async () => {
        const fillPrice = defaultOrder.limitPrice.minus(25);
        const { expectedMarginAmount, txResult } =
          await fillOrder(defaultSignedOrder, { price: fillPrice });
        await expectBalances(
          ctx,
          txResult,
          [defaultOrder.maker, defaultOrder.taker],
          [initialMargin.minus(expectedMarginAmount), initialMargin.plus(expectedMarginAmount)],
          [orderAmount, orderAmount.negated()],
        );
      });

      it('fills an ask above the limit price', async () => {
        const sellOrder = await getModifiedOrder({ isBuy: false });
        const fillPrice = defaultOrder.limitPrice.plus(25);
        const { expectedMarginAmount, txResult } =
          await fillOrder(sellOrder, { price: fillPrice });
        await expectBalances(
          ctx,
          txResult,
          [defaultOrder.maker, defaultOrder.taker],
          [initialMargin.plus(expectedMarginAmount), initialMargin.minus(expectedMarginAmount)],
          [orderAmount.negated(), orderAmount],
        );
      });

      it('fills a bid with a fee less than the limit fee', async () => {
        const { expectedMarginAmount, txResult } = await fillOrder(
          defaultSignedOrder,
          {
            fee: defaultOrder.limitFee.div(2),
            price: defaultOrder.limitPrice.minus(25),
          },
        );
        await expectBalances(
          ctx,
          txResult,
          [defaultOrder.maker, defaultOrder.taker],
          [initialMargin.minus(expectedMarginAmount), initialMargin.plus(expectedMarginAmount)],
          [orderAmount, orderAmount.negated()],
        );
      });

      it('fills an ask with a fee less than the limit fee', async () => {
        const sellOrder = await getModifiedOrder({ isBuy: false });
        const fillPrice = defaultOrder.limitPrice.plus(25);
        const fillFee = defaultOrder.limitFee.div(2);
        const { expectedMarginAmount, txResult } = await fillOrder(
          sellOrder,
          {
            fee: fillFee,
            price: fillPrice,
          },
        );
        await expectBalances(
          ctx,
          txResult,
          [defaultOrder.maker, defaultOrder.taker],
          [initialMargin.plus(expectedMarginAmount), initialMargin.minus(expectedMarginAmount)],
          [orderAmount.negated(), orderAmount],
        );
      });

      it('succeeds if sender is a local operator', async () => {
        await ctx.perpetual.operator.setLocalOperator(
          otherUser,
          true,
          { from: defaultOrder.taker },
        );
        const { expectedMarginAmount, txResult } =
          await fillOrder(defaultSignedOrder, { sender: otherUser });
        await expectBalances(
          ctx,
          txResult,
          [defaultOrder.maker, defaultOrder.taker],
          [initialMargin.minus(expectedMarginAmount), initialMargin.plus(expectedMarginAmount)],
          [orderAmount, orderAmount.negated()],
        );
      });

      it('succeeds if sender is a global operator', async () => {
        await ctx.perpetual.admin.setGlobalOperator(
          otherUser,
          true,
          { from: admin },
        );
        const { expectedMarginAmount, txResult } =
          await fillOrder(defaultSignedOrder, { sender: otherUser });
        await expectBalances(
          ctx,
          txResult,
          [defaultOrder.maker, defaultOrder.taker],
          [initialMargin.minus(expectedMarginAmount), initialMargin.plus(expectedMarginAmount)],
          [orderAmount, orderAmount.negated()],
        );
      });

      it('succeeds with an invalid signature for an order approved on-chain', async () => {
        await ctx.perpetual.orders.approveOrder(defaultOrder, { from: defaultOrder.maker });
        const order = {
          ...defaultSignedOrder,
          typedSignature: `0xff${defaultSignedOrder.typedSignature.substr(4)}`,
        };
        const { expectedMarginAmount, txResult } = await fillOrder(order);

        await expectBalances(
          ctx,
          txResult,
          [defaultOrder.maker, defaultOrder.taker],
          [initialMargin.minus(expectedMarginAmount), initialMargin.plus(expectedMarginAmount)],
          [orderAmount, orderAmount.negated()],
        );
      });
    });

    describe('basic failure cases', () => {
      it('fails for calls not from the perpetual contract', async () => {
        await expectThrow(
          ctx.perpetual.contracts.send(
            ctx.perpetual.contracts.p1Orders.methods.trade(
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
          typedSignature: `0xff${defaultSignedOrder.typedSignature.substr(4)}`,
        };
        await expectThrow(
          fillOrder(order),
          'Order has an invalid signature',
        );
      });

      it('fails for canceled order', async () => {
        await ctx.perpetual.orders.cancelOrder(defaultOrder, { from: defaultOrder.maker });
        await expectThrow(
          fillOrder(defaultSignedOrder),
          'Order was already canceled',
        );
      });

      it('fails for wrong maker', async () => {
        const tradeData = ctx.perpetual.orders.fillToTradeData(
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
              trader: ctx.perpetual.contracts.p1Orders.options.address,
            })
            .commit({ from: defaultOrder.taker }),
          'Order maker does not match maker',
        );
      });

      it('fails for wrong taker', async () => {
        const tradeData = ctx.perpetual.orders.fillToTradeData(
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
              trader: ctx.perpetual.contracts.p1Orders.options.address,
            })
            .commit({ from: otherUser }),
          'Order taker does not match taker',
        );
      });

      it('fails if the order has expired', async () => {
        const order = await getModifiedOrder({ expiration: new BigNumber(1) });
        await expectThrow(
          fillOrder(order),
          'Order has expired',
        );
      });

      it('fails to fill a bid at a price above the limit price', async () => {
        await expectThrow(
          fillOrder(defaultSignedOrder, { price: defaultOrder.limitPrice.plus(1) }),
          'Fill price is invalid',
        );
      });

      it('fails to fill an ask at a price below the limit price', async () => {
        const sellOrder = await getModifiedOrder({ isBuy: false });
        await expectThrow(
          fillOrder(sellOrder, { price: sellOrder.limitPrice.minus(1) }),
          'Fill price is invalid',
        );
      });

      it('fails if fee is greater than limit fee', async () => {
        await expectThrow(
          fillOrder(defaultSignedOrder, { fee: defaultOrder.limitFee.plus(1) }),
          'Fill fee is invalid',
        );
      });

      it('fails to overfill order', async () => {
        await expectThrow(
          fillOrder(defaultSignedOrder, { amount: defaultSignedOrder.amount.plus(1) }),
          'Cannot overfill order',
        );
      });

      it('fails to overfill partially filled order', async () => {
        const halfAmount = defaultOrder.amount.div(2);
        await fillOrder(defaultSignedOrder, { amount: halfAmount });
        await expectThrow(
          fillOrder(defaultSignedOrder, { amount: halfAmount.plus(1) }),
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
        const order = await getModifiedOrder({ triggerPrice });
        await ctx.perpetual.testing.oracle.setPrice(triggerPrice);
        await fillOrder(order, { price: fillPrice });
      });

      it('fills an ask with the oracle price at the trigger price', async () => {
        //       +10 | trigger price, oracle price
        //        +5 | fill price
        // limit ask |
        const triggerPrice = defaultOrder.limitPrice.plus(10);
        const fillPrice = defaultOrder.limitPrice.plus(5);
        const sellOrder = await getModifiedOrder({ triggerPrice, isBuy: false });
        await ctx.perpetual.testing.oracle.setPrice(triggerPrice);
        await fillOrder(sellOrder, { price: fillPrice });
      });

      it('fills a bid with the oracle price above the trigger price', async () => {
        //       +10 | oracle price
        //           |
        // limit bid |
        //        -5 | fill price
        //       -10 | trigger price
        const triggerPrice = defaultOrder.limitPrice.minus(10);
        const fillPrice = defaultOrder.limitPrice.minus(5);
        const order = await getModifiedOrder({ triggerPrice });
        await ctx.perpetual.testing.oracle.setPrice(triggerPrice.plus(20));
        await fillOrder(order, { price: fillPrice });
      });

      it('fills an ask with the oracle price below the trigger price', async () => {
        //       +10 | trigger price, oracle price
        //        +5 | fill price
        // limit ask |
        //           |
        //       -10 | oracle price
        const triggerPrice = defaultOrder.limitPrice.plus(10);
        const fillPrice = defaultOrder.limitPrice.plus(5);
        const sellOrder = await getModifiedOrder({ triggerPrice, isBuy: false });
        await ctx.perpetual.testing.oracle.setPrice(triggerPrice.minus(20));
        await fillOrder(sellOrder, { price: fillPrice });
      });

      it('fails to fill a bid if the oracle price is below the trigger price', async () => {
        // limit bid |
        //       -10 | trigger price
        //       -11 | oracle price
        const triggerPrice = defaultOrder.limitPrice.minus(10);
        await ctx.perpetual.testing.oracle.setPrice(triggerPrice.minus(1));
        const order = await getModifiedOrder({ triggerPrice });
        await expectThrow(
          fillOrder(order),
          'Trigger price has not been reached',
        );
      });

      it('fails to fill an ask if the oracle price is above the trigger price', async () => {
        //       +11 | oracle price
        //       +10 | trigger price
        // limit ask |
        const triggerPrice = defaultOrder.limitPrice.plus(10);
        await ctx.perpetual.testing.oracle.setPrice(triggerPrice.plus(1));
        const sellOrder = await getModifiedOrder({ triggerPrice, isBuy: false });
        await expectThrow(
          fillOrder(sellOrder),
          'Trigger price has not been reached',
        );
      });
    });

    describe('in decrease-only mode', () => {
      it('fills a bid', async () => {
        // Give the maker a short position.
        const { limitFee, limitPrice, maker, taker } = defaultOrder;
        const fee = limitFee.value.times(limitPrice.value);
        const cost = limitPrice.value.plus(fee).times(orderAmount);
        await sell(ctx, maker, taker, orderAmount, cost);

        // Fill the order to decrease the short position to zero.
        const buyOrder = await getModifiedOrder({ isDecreaseOnly: true });
        const { txResult } = await fillOrder(buyOrder);

        // Check balances.
        await expectBalances(
          ctx,
          txResult,
          [maker, taker],
          [initialMargin, initialMargin],
          [INTEGERS.ZERO, INTEGERS.ZERO],
        );
      });

      it('fills an ask', async () => {
        // Give the maker a long position.
        const { limitFee, limitPrice, maker, taker } = defaultOrder;
        const fee = limitFee.value.times(limitPrice.value).negated();
        const cost = limitPrice.value.plus(fee).times(orderAmount);
        await buy(ctx, maker, taker, orderAmount, cost);

        // Fill the order to decrease the long position to zero.
        const sellOrder = await getModifiedOrder({ isBuy: false, isDecreaseOnly: true });
        const { txResult } = await fillOrder(sellOrder);

        // Check balances.
        await expectBalances(
          ctx,
          txResult,
          [maker, taker],
          [initialMargin, initialMargin],
          [INTEGERS.ZERO, INTEGERS.ZERO],
        );
      });

      it('fails to fill a bid if maker position is positive', async () => {
        const { maker, taker } = defaultOrder;
        await buy(ctx, maker, taker, new BigNumber(1), defaultOrder.limitPrice.value);
        const buyOrder = await getModifiedOrder({ isDecreaseOnly: true });
        await expectThrow(
          fillOrder(buyOrder),
          'Fill does not decrease position',
        );
      });

      it('fails to fill an ask if maker position is negative', async () => {
        const { maker, taker } = defaultOrder;
        await sell(ctx, maker, taker, new BigNumber(1), defaultOrder.limitPrice.value);
        const sellOrder = await getModifiedOrder({ isBuy: false, isDecreaseOnly: true });
        await expectThrow(
          fillOrder(sellOrder),
          'Fill does not decrease position',
        );
      });

      it('fails to fill a bid if maker position would become positive', async () => {
        const { maker, taker } = defaultOrder;
        const cost = defaultOrder.limitPrice.value.times(orderAmount.minus(1));
        await sell(ctx, maker, taker, orderAmount.minus(1), cost);
        const buyOrder = await getModifiedOrder({ isDecreaseOnly: true });
        await expectThrow(
          fillOrder(buyOrder),
          'Fill does not decrease position',
        );
      });

      it('fails to fill an ask if maker position would become negative', async () => {
        const { maker, taker } = defaultOrder;
        const cost = defaultOrder.limitPrice.value.times(orderAmount.minus(1));
        await buy(ctx, maker, taker, orderAmount.minus(1), cost);
        const sellOrder = await getModifiedOrder({ isBuy: false, isDecreaseOnly: true });
        await expectThrow(
          fillOrder(sellOrder),
          'Fill does not decrease position',
        );
      });
    });

    describe('with negative limit fee', () => {
      it('fills a bid', async () => {
        const negativeFee = new Fee(defaultOrder.limitFee.value.abs().negated());
        const order = await getModifiedOrder({ limitFee: negativeFee });
        const { expectedMarginAmount, txResult } = await fillOrder(order);
        await expectBalances(
          ctx,
          txResult,
          [defaultOrder.maker, defaultOrder.taker],
          [initialMargin.minus(expectedMarginAmount), initialMargin.plus(expectedMarginAmount)],
          [orderAmount, orderAmount.negated()],
        );
      });

      it('fills an ask', async () => {
        const negativeFee = new Fee(defaultOrder.limitFee.value.abs().negated());
        const sellOrder = await getModifiedOrder({ isBuy: false, limitFee: negativeFee });
        const { expectedMarginAmount, txResult } = await fillOrder(sellOrder);
        await expectBalances(
          ctx,
          txResult,
          [defaultOrder.maker, defaultOrder.taker],
          [initialMargin.plus(expectedMarginAmount), initialMargin.minus(expectedMarginAmount)],
          [orderAmount.negated(), orderAmount],
        );
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
    return ctx.perpetual.orders.getSignedOrder(newOrder, SigningMethod.Hash);
  }

  async function fillOrder(
    order: SignedOrder,
    args: {
      amount?: BigNumber,
      price?: Price,
      fee?: Fee,
      sender?: address,
    } = {},
  ): Promise<{
    expectedMarginAmount: BigNumber,
    txResult: TxResult,
  }> {
    const fillAmount = args.amount || order.amount;
    const fillPrice = args.price || order.limitPrice;
    const fillFee = args.fee || order.limitFee;

    // Order fee is denoted as a percentage of execution price.
    const feeAmount = fillFee.value.times(fillPrice.value);
    const effectivePrice = order.isBuy
      ? fillPrice.plus(feeAmount)
      : fillPrice.minus(feeAmount);
    const expectedMarginAmount = fillAmount.times(effectivePrice.value).dp(0);

    const txResult = await ctx.perpetual.trade
      .initiate()
      .fillSignedOrder(
        order,
        fillAmount,
        fillPrice,
        fillFee,
      )
      .commit({ from: args.sender || order.taker });
    return {
      expectedMarginAmount,
      txResult,
    };
  }

  async function expectStatus(
    order: Order,
    status: OrderStatus,
    filledAmount?: BigNumber,
  ) {
    const statuses = await ctx.perpetual.orders.getOrdersStatus([order]);
    expect(statuses[0].status).to.equal(status);
    if (filledAmount) {
      expectBN(statuses[0].filledAmount).to.equal(filledAmount);
    }
  }
});
