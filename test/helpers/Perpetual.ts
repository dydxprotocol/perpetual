require('dotenv-flow').config();

import Web3 from 'web3';

import { PerpetualMarket, address } from '../../src/lib/types';
import { TestPerpetual } from '../modules/TestPerpetual';
import provider from './Provider';

let accounts: address[];

const perpetuals: { [market: string]: TestPerpetual } = {};

export async function getPerpetual(
  market: PerpetualMarket,
): Promise<{
  perpetual: TestPerpetual,
  accounts: address[],
}> {
  if (!(market in perpetuals)) {
    const networkId = await new Web3(provider).eth.net.getId();
    const perpetual = new TestPerpetual(
      provider,
      market,
      networkId,
      { sendOptions: { gas: 4000000 } },
    );
    perpetuals[market] = perpetual;

    if (!accounts) {
      accounts = await perpetual.web3.eth.getAccounts();
    }
    perpetual.setDefaultAccount(accounts[1]);
  }
  return {
    accounts,
    perpetual: perpetuals[market],
  };
}
