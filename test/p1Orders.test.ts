import BigNumber from 'bignumber.js';
import { expect, expectThrow } from './helpers/Expect';
import { snapshot, resetEVM } from './helpers/EVM';
import { getPerpetual } from './helpers/Perpetual';
import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import {
  address,
  Order,
  SignedOrder,
  SigningMethod,
} from '../src/lib/types';
import { ADDRESSES } from '../src/lib/Constants';
import { Perpetual } from '../src/Perpetual';

let perpetual: Perpetual;
let accounts: address[];

const defaultOrder: Order = {
  isBuy: true,
  amount: new BigNumber('1e18'),
  limitPrice: new BigNumber('987654320'),
  stopPrice: new BigNumber(0),
  fee: new BigNumber('330'),
  maker: ADDRESSES.ZERO,
  taker: ADDRESSES.ZERO,
  expiration: new BigNumber('888'),
  salt: new BigNumber('425'),
};
let defaultSignedOrder: SignedOrder;

describe('P1Orders', () => {
  let preInitSnapshotId: string;
  let postInitSnapshotId: string;

  before(async () => {
    ({ perpetual, accounts } = await getPerpetual());

    defaultOrder.maker = accounts[5];
    defaultOrder.taker = accounts[1];

    const typedSignature = await perpetual.orders.signOrder(defaultOrder, SigningMethod.Hash);
    defaultSignedOrder = {
      ...defaultOrder,
      typedSignature,
    };

    preInitSnapshotId = await snapshot();
    await initializeWithTestContracts(perpetual, accounts);
    postInitSnapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(postInitSnapshotId);
  });

  after(async () => {
    await resetEVM(preInitSnapshotId);
  });

  describe('Signing', () => {
    it('Signs correctly for hash', async () => {
      const typedSignature = await perpetual.orders.signOrder(
        defaultOrder,
        SigningMethod.Hash,
      );
      const validSignature = perpetual.orders.orderHasValidSignature({
        ...defaultOrder,
        typedSignature,
      });
      expect(validSignature).to.be.true;
    });

    it('Signs correctly for typed data', async () => {
      const typedSignature = await perpetual.orders.signOrder(
        defaultOrder,
        SigningMethod.TypedData,
      );
      const validSignature = perpetual.orders.orderHasValidSignature({
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

    it('TODO', async () => {
      // TODO
    });
  });

  describe('Trade', () => {
    it('Succeeds for simple case', async () => {
      // TODO: change to success
      await expectThrow(
        perpetual.trade.initiate().fillSignedOrder(
          defaultSignedOrder,
          defaultSignedOrder.amount.div(2),
          defaultSignedOrder.limitPrice.div(2),
          defaultSignedOrder.fee.div(2),
        ).commit({ from: defaultSignedOrder.taker }),
        'account is undercollateralized',
      );
    });

    it('TODO', async () => {
      // TODO
    });
  });
});
