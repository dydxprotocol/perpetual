import { expectBN } from './helpers/Expect';
import { snapshot, resetEVM } from './helpers/EVM';
import { getPerpetual } from './helpers/Perpetual';
import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import { address } from '../src/lib/types';
import { Perpetual } from '../src/Perpetual';

let perpetual: Perpetual;
let accounts: address[];

describe('Perpetual', () => {
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

  describe('initial state', () => {
    it('has proper index', async () => {
      const index = await perpetual.getters.getGlobalIndex();
      const { timestamp } = await perpetual.web3.eth.getBlock('latest');
      expectBN(index.longs).eq('1e18');
      expectBN(index.shorts).eq('1e18');
      expectBN(index.timestamp).lte(timestamp as any);
    });

    it('has empty balances', async () => {
      const balance = await perpetual.getters.getAccountBalance(accounts[0]);
      expectBN(balance.margin).eq(0);
      expectBN(balance.position).eq(0);
    });

    // TODO
  });

  // TODO
});
