import BigNumber from 'bignumber.js';

import { expect, expectBN, expectThrow } from './helpers/Expect';
import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
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

const defaultOrder: Order = {
  isBuy: true,
  isDecreaseOnly: false,
  amount: new BigNumber('1e18'),
  limitPrice: new Price('987.654320'),
  triggerPrice: PRICES.NONE,
  limitFee: Fee.fromBips(20),
  maker: ADDRESSES.ZERO,
  taker: ADDRESSES.ZERO,
  expiration: INTEGERS.ONE_YEAR_IN_SECONDS.times(100),
  salt: new BigNumber('425'),
};
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
  await initializeWithTestContracts(ctx);

  defaultOrder.maker = fullFlagOrder.maker = ctx.accounts[5];
  defaultOrder.taker = fullFlagOrder.taker = ctx.accounts[1];
  admin = ctx.accounts[0];
  otherUser = ctx.accounts[8];

  defaultSignedOrder = await ctx.perpetual.orders.getSignedOrder(defaultOrder, SigningMethod.Hash);
  fullFlagSignedOrder = await ctx.perpetual.orders.getSignedOrder(
    fullFlagOrder,
    SigningMethod.Hash,
  );
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
      await ctx.perpetual.orders.approveOrder(fullFlagOrder, { from: fullFlagOrder.maker });
      await expectStatus(fullFlagOrder, OrderStatus.Approved);
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
      await ctx.perpetual.orders.cancelOrder(fullFlagOrder, { from: fullFlagOrder.maker });
      await expectStatus(fullFlagOrder, OrderStatus.Canceled);
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

  describe('Error Cases', () => {
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

    it('fails for sender not equal to taker', async () => {
      await expectThrow(
        fillOrder(defaultSignedOrder, { sender: otherUser }),
        'Sender must equal taker',
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

    it('fails to buy if the fill price is below the limit price', async () => {
      const sellOrder = await getModifiedOrder({ isBuy: false });
      await expectThrow(
        fillOrder(sellOrder, { price: sellOrder.limitPrice.minus(1) }),
        'Fill price is invalid',
      );
    });

    it('fails to sell if the fill price is above the limit price', async () => {
      await expectThrow(
        fillOrder(defaultSignedOrder, { price: defaultOrder.limitPrice.plus(1) }),
        'Fill price is invalid',
      );
    });

    it('fails if fee is greater than limit fee, for a positive limit fee', async () => {
      await expectThrow(
        fillOrder(defaultSignedOrder, { fee: defaultOrder.limitFee.plus(1) }),
        'Fill fee is invalid',
      );
    });

    it('fails if fee is greater than limit fee, for a negative limit fee', async () => {
      await expectThrow(
        fillOrder(fullFlagSignedOrder, { fee: fullFlagOrder.limitFee.plus(1) }),
        'Fill fee is invalid',
      );
    });

    it('fails to buy if the trigger price is above the oracle price', async () => {
      const triggerPrice = defaultOrder.limitPrice.minus(25);
      await ctx.perpetual.testing.oracle.setPrice(triggerPrice.minus(1));
      const order = await getModifiedOrder({ triggerPrice });
      await expectThrow(
        fillOrder(order),
        'Trigger price has not been reached',
      );
    });

    it('fails to sell if the trigger price is below the oracle price', async () => {
      const triggerPrice = defaultOrder.limitPrice.plus(25);
      await ctx.perpetual.testing.oracle.setPrice(triggerPrice.plus(1));
      const sellOrder = await getModifiedOrder({ triggerPrice, isBuy: false });
      await expectThrow(
        fillOrder(sellOrder),
        'Trigger price has not been reached',
      );
    });

    // TODO
    // it('decrease-only order fails to buy if maker position is positive', async () => {
    //   const sellOrder = await getModifiedOrder({ isBuy: false, isDecreaseOnly: true });
    //   await expectThrow(
    //     fillOrder(sellOrder),
    //     'Trigger price has not been reached',
    //   );
    // });

    // it('decrease-only order fails to sell if maker position is negative', async () => {
    //   const buyOrder = await getModifiedOrder({ isDecreaseOnly: true });
    //   await expectThrow(
    //     fillOrder(buyOrder),
    //     'Trigger price has not been reached',
    //   );
    // });

    // it('decrease-only order fails to buy if maker position would become positive', async () => {
    //   const sellOrder = await getModifiedOrder({ isBuy: false, isDecreaseOnly: true });
    //   await expectThrow(
    //     fillOrder(sellOrder),
    //     'Trigger price has not been reached',
    //   );
    // });

    // it('decrease-only order fails to sell if maker position would become negative', async () => {
    //   const buyOrder = await getModifiedOrder({ isDecreaseOnly: true });
    //   await expectThrow(
    //     fillOrder(buyOrder),
    //     'Trigger price has not been reached',
    //   );
    // });

    it('fails to overfill order', async () => {
      await expectThrow(
        fillOrder(defaultSignedOrder, { amount: defaultSignedOrder.amount.plus(1) }),
        'Cannot overfill order',
      );
    });

    // TODO
    xit('fails to overfill partially filled order', async () => {
      const halfAmount = defaultOrder.amount.div(2);
      await fillOrder(defaultSignedOrder, { amount: halfAmount });
      await expectThrow(
        fillOrder(defaultSignedOrder, { amount: halfAmount.plus(1) }),
        'Cannot overfill order',
      );
    });
  });

  describe('Fill.price', () => {
    // TODO
  });

  describe('Fill.fees', () => {
    // TODO
  });

  describe('isDecreaseOnly', () => {
    it('fails if not decreasing position for decrease-only order', async () => {
      // TODO
    });

    // TODO
  });

  describe('triggerPrice', () => {
    // TODO
  });

  describe('Trade', () => {
    it('Succeeds for simple case', async () => {
      // TODO: change to success
      await expectThrow(
        fillOrder(defaultSignedOrder),
        'account is undercollateralized',
      );
    });

    it('TODO', async () => {
      // TODO
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
  ): Promise<TxResult> {
    return ctx.perpetual.trade
      .initiate()
      .fillSignedOrder(
        order,
        args.amount || order.amount,
        args.price || order.limitPrice,
        args.fee || order.limitFee,
      )
      .commit({ from: args.sender || order.taker });
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
