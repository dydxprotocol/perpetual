import { snapshot, resetEVM } from './helpers/EVM';
import { expect, expectThrow } from './helpers/Expect';
import { getPerpetual } from './helpers/Perpetual';
import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import { address } from '../src/lib/types';
import { ADDRESSES, INTEGERS } from '../src/lib/Constants';
import { Perpetual } from '../src/Perpetual';

let perpetual: Perpetual;
let accounts: address[];

describe('Proxy', () => {
  let preInitSnapshotId: string;
  let postInitSnapshotId: string;

  before(async () => {
    ({ perpetual, accounts } = await getPerpetual());
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

  describe('initialize()', () => {
    it('succeeds', async () => {});

    it('fails to do a second time', async () => {
      await expectThrow(
        perpetual.proxy.initialize(
          ADDRESSES.ZERO,
          ADDRESSES.ZERO,
          ADDRESSES.ZERO,
          INTEGERS.ZERO,
          { from: accounts[0] },
        ),
      );
    });
  });

  describe('changeAdmin()', () => {
    it('starts on account 0', async () => {
      await expectAdmin(accounts[0]);
    });

    it('succeeds', async () => {
      await perpetual.proxy.changeAdmin(accounts[1], { from: accounts[0] });
      await expectAdmin(accounts[1]);
    });

    it('succeeds twice', async () => {
      await perpetual.proxy.changeAdmin(accounts[1], { from: accounts[0] });
      await expectAdmin(accounts[1]);
      await perpetual.proxy.changeAdmin(accounts[2], { from: accounts[1] });
      await expectAdmin(accounts[2]);
    });

    it('fails to do a second time', async () => {
      await perpetual.proxy.changeAdmin(accounts[1], { from: accounts[0] });
      await expectAdmin(accounts[1]);
      await expectThrow(
        perpetual.proxy.changeAdmin(accounts[2], { from: accounts[0] }),
      );
    });
  });

  describe('upgradeTo()', () => {
    // TODO
  });

  describe('upgradeToAndCall()', () => {
    // TODO
  });
});

async function expectAdmin(address: address) {
  const currentAdmin = await perpetual.proxy.admin({ from: address });
  expect(currentAdmin).to.equal(address);
}
