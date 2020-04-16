/*

    Copyright 2020 dYdX Trading Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

require('dotenv-flow').config();

import { address } from '../../src/lib/types';
import { TestPerpetual } from '../modules/TestPerpetual';
import provider from './Provider';

let defaultAccountSet = false;
let accounts: address[];

export const perpetual = new TestPerpetual(
  provider,
  Number(process.env.NETWORK_ID),
  { sendOptions: { gas: 4000000 } },
);

export async function getPerpetual(
): Promise<{
  perpetual: TestPerpetual,
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
