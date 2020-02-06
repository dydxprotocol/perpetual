require('dotenv-flow').config();

import { address, Provider } from '../../src/lib/types';
import { Perpetual } from '../../src/Perpetual';
import _provider from './Provider';

const provider = _provider as unknown as Provider;

let defaultAccountSet = false;
let accounts: address[];

export const perpetual = new Perpetual(
  provider as any,
  Number(process.env.NETWORK_ID),
);

export async function getPerpetual(
): Promise<{
  perpetual: Perpetual,
  accounts: address[],
}> {
  perpetual.testing.evm.setProvider(provider);

  if (!defaultAccountSet) {
    accounts = await perpetual.web3.eth.getAccounts();
    perpetual.setDefaultAccount(accounts[1]);
    defaultAccountSet = true;
  }
  return {
    perpetual,
    accounts,
  };
}
