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
  Price,
  TxResult,
  SendOptions,
} from '../../src/lib/types';
import { TestContracts } from './TestContracts';

export class TestMakerOracle {
  private contracts: TestContracts;

  constructor(
    contracts: TestContracts,
  ) {
    this.contracts = contracts;
  }

  public get address(): string {
    return this.contracts.testMakerOracle.options.address;
  }

  public async setPrice(
    newPrice: Price,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.testMakerOracle.methods.setPrice(
        newPrice.toSolidity(),
      ),
      options,
    );
  }

  public async setValidity(
    valid: boolean,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.testMakerOracle.methods.setValidity(valid),
      options,
    );
  }
}
