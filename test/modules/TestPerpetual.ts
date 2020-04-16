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

import {
  Networks,
  PerpetualOptions,
  Provider,
  SendOptions,
} from '../../src/lib/types';
import { Contracts } from '../../src/modules/Contracts';
import { Perpetual } from '../../src/Perpetual';
import { TestContracts } from './TestContracts';
import { Testing } from './Testing';

export class TestPerpetual extends Perpetual {
  public contracts: TestContracts;
  public testing: Testing;

  constructor(
    provider: Provider,
    networkId: number,
    options: PerpetualOptions = {},
  ) {
    super(provider, networkId, options);
    this.testing = new Testing(provider, this.contracts);
  }

  public setProvider(
    provider: Provider,
    networkId: number = Networks.MAINNET,
  ): void {
    super.setProvider(provider, networkId);
    this.testing.setProvider(provider);
  }

  protected getContracts(
    provider: Provider,
    networkId: number,
    sendOptions?: SendOptions,
  ): Contracts {
    return new TestContracts(
      provider,
      networkId,
      this.web3,
      sendOptions,
    );
  }
}
