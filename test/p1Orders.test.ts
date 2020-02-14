import BigNumber from 'bignumber.js';
import { expect, expectThrow } from './helpers/Expect';
import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import {
  Order,
  SignedOrder,
  SigningMethod,
} from '../src/lib/types';
import { ADDRESSES } from '../src/lib/Constants';

const defaultOrder: Order = {
  isBuy: true,
  isDecreaseOnly: false,
  amount: new BigNumber('1e18'),
  limitPrice: new BigNumber('987654320'),
  stopPrice: new BigNumber(0),
  limitFee: new BigNumber('330'),
  maker: ADDRESSES.ZERO,
  taker: ADDRESSES.ZERO,
  expiration: new BigNumber('888'),
  salt: new BigNumber('425'),
};
let defaultSignedOrder: SignedOrder;

async function init(ctx: ITestContext) {
  await initializeWithTestContracts(ctx);

  defaultOrder.maker = ctx.accounts[5];
  defaultOrder.taker = ctx.accounts[1];

  const typedSignature = await ctx.perpetual.orders.signOrder(defaultOrder, SigningMethod.Hash);
  defaultSignedOrder = {
    ...defaultOrder,
    typedSignature,
  };
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

    it('TODO', async () => {
      // TODO
    });
  });

  describe('Approve', () => {
    it('Succeeds', async () => {
      // TODO
    });

    it('Fails if caller is not the maker', async () => {
      // TODO
    });

    it('TODO', async () => {
      // TODO
    });
  });

  describe('Cancel', () => {
    it('Succeeds', async () => {
      // TODO
    });

    it('Fails if caller is not the maker', async () => {
      // TODO
    });

    it('TODO', async () => {
      // TODO
    });
  });

  describe('Error Cases', () => {
    it('fails for calls not from the perpetual', async () => {
      // TODO
    });

    it('fails for sender not equal to taker', async () => {
      // TODO
    });

    it('fails for expired orders', async () => {
      // TODO
    });

    it('fails for bad signature', async () => {
      // TODO
    });

    it('fails for overfilling order', async () => {
      // TODO
    });

    it('fails for bad price', async () => {
      // TODO
    });

    it('fails for bad fees', async () => {
      // TODO
    });

    it('fails for wrong taker', async () => {
      // TODO
    });

    it('fails for canceled order', async () => {
      // TODO
    });

    it('fails if not decreasing position for decrease-only order', async () => {
      // TODO
    });

    it('TODO', async () => {
      // TODO
    });
  });

  describe('Trade', () => {
    it('Succeeds for simple case', async () => {
      // TODO: change to success
      await expectThrow(
        ctx.perpetual.trade.initiate().fillSignedOrder(
          defaultSignedOrder,
          defaultSignedOrder.amount.div(2),
          defaultSignedOrder.limitPrice.div(2),
          defaultSignedOrder.limitFee.div(2),
        ).commit({ from: defaultSignedOrder.taker }),
        'account is undercollateralized',
      );
    });

    it('TODO', async () => {
      // TODO
    });
  });
});
