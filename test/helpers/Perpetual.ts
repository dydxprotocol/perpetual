require('dotenv-flow').config();

import { address } from '../../src/lib/types';
import { TestPerpetual } from '../modules/TestPerpetual';
import provider from './Provider';

let initialized = false;
let accounts: address[];

export const perpetual = new TestPerpetual(
  provider,
  0, // initialized in getPerpetual.
  { sendOptions: { gas: 4000000 } },
);

export async function getPerpetual(
): Promise<{
  perpetual: TestPerpetual,
  accounts: address[],
}> {
  if (!initialized) {
    accounts = await perpetual.web3.eth.getAccounts();
    perpetual.setDefaultAccount(accounts[1]);

    const networkId = await perpetual.web3.eth.net.getId();
    perpetual.setProvider(provider, networkId);

    initialized = true;
  }
  return {
    perpetual,
    accounts,
  };
}
