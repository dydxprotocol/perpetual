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

import { EVM } from './EVM';
import { TestP1Funder } from './TestP1Funder';
import { TestP1Oracle } from './TestP1Oracle';
import { TestP1Trader } from './TestP1Trader';
import { TestToken } from './TestToken';
import { Provider } from '../lib/types';
import { Contracts } from '../modules/Contracts';

export class Testing {
  public evm: EVM;
  public funder: TestP1Funder;
  public oracle: TestP1Oracle;
  public trader: TestP1Trader;
  public token: TestToken;

  constructor(
    provider: Provider,
    contracts: Contracts,
  ) {
    this.evm = new EVM(provider);
    this.funder = new TestP1Funder(contracts);
    this.oracle = new TestP1Oracle(contracts);
    this.trader = new TestP1Trader(contracts);
    this.token = new TestToken(contracts);
  }
}
