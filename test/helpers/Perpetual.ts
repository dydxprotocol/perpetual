import { Provider, address } from '../../src/lib/types';
import { Perpetual } from '../../src/Perpetual';
import web3 from '../web3';

let initialized = false;
let perpetual: Perpetual;
let accounts: address[];

/**
 * Returns the Perpetual singleton object for use in tests.
 */
export async function getPerpetual(): Promise<Perpetual> {
  if (!initialized) {
    initialized = true;
    perpetual = new Perpetual(
      web3.currentProvider as Provider,
      await web3.eth.net.getId(),
    );
    accounts = await web3.eth.getAccounts();
    perpetual.setDefaultAccount(accounts[1]);
  }
  return perpetual;
}
