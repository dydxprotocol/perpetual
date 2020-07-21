require('dotenv-flow').config();

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
    const perpetual = new TestPerpetual(
      provider,
      market,
      0, // initialized below
      { sendOptions: { gas: 4000000 } },
    );

    if (!accounts) {
      accounts = await perpetual.web3.eth.getAccounts();
    }
    perpetual.setDefaultAccount(accounts[1]);

    const networkId = await perpetual.web3.eth.net.getId();
    perpetual.setProvider(provider, networkId);
    perpetuals[market] = perpetual;
  }
  return {
    accounts,
    perpetual: perpetuals[market],
  };
}
