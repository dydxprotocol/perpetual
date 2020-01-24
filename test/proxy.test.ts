import { snapshot, resetEVM } from './helpers/EVM';
import { expectThrow } from './helpers/Expect';
import { getPerpetual } from './helpers/Perpetual';
import { address } from '../src/lib/types';
import { Perpetual } from '../src/Perpetual';

let perpetual: Perpetual;
let accounts: address[];

describe('Proxy', () => {
  let snapshotId: string;

  before(async () => {
    ({ perpetual, accounts } = await getPerpetual());
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  describe('initialize()', () => {
    it('succeeds', async () => {
      // TODO
    });

    it('fails to do a second time', async () => {
      await expectThrow(
        perpetual.proxy.initialize(
          perpetual.contracts.perpetualV1.options.address,
          accounts[0],
          '0x',
          { from: accounts[0] },
        ),
      );
    });
  });

  describe('changeAdmin()', () => {
    it('succeeds', async () => {
      await perpetual.proxy.changeAdmin(accounts[1], { from: accounts[0] });
    });

    it('succeeds twice', async () => {
      await perpetual.proxy.changeAdmin(accounts[1], { from: accounts[0] });
      await perpetual.proxy.changeAdmin(accounts[2], { from: accounts[1] });
    });

    it('fails to do a second time', async () => {
      await perpetual.proxy.changeAdmin(accounts[1], { from: accounts[0] });
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
