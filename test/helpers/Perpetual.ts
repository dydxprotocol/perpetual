require('dotenv-flow').config();

import { address } from '../../src/lib/types';
import { Perpetual } from '../../src/Perpetual';
import { provider } from './Provider';

let defaultAccountSet = false;
let accounts: address[];

export const perpetual = new Perpetual(
  provider,
  Number(process.env.NETWORK_ID),
);

export async function getPerpetual(
): Promise<{
  perpetual: Perpetual,
  accounts: address[],
}> {
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
