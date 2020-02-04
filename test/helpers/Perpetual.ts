require('dotenv-flow').config();

import Web3 from 'web3';
import { address } from '../../src/lib/types';
import { Perpetual } from '../../src/Perpetual';
import { providerEngine } from './Provider';

let defaultAccountSet = false;
let accounts: address[];

export const perpetual = new Perpetual(
  providerEngine as any,
  Number(process.env.NETWORK_ID),
);

export async function getPerpetual(
): Promise<{
  perpetual: Perpetual,
  accounts: address[],
}> {
  perpetual.testing.evm.setProvider(new Web3.providers.HttpProvider(process.env.RPC_NODE_URI));

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
