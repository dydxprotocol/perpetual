import { expectBN } from './helpers/Expect';
import { snapshot, resetEVM } from './helpers/EVM';
import { getPerpetual } from './helpers/Perpetual';
import { address } from '../src/lib/types';
import { Perpetual } from '../src/Perpetual';

let perpetual: Perpetual;
let accounts: address[];

describe('Perpetual', () => {
  let snapshotId: string;

  before(async () => {
    ({ perpetual, accounts } = await getPerpetual());
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
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
