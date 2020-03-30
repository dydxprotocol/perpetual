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

import { Contracts } from '../modules/Contracts';
import {
  Price,
  CallOptions,
} from '../lib/types';

export class PriceOracle {
  private contracts: Contracts;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
  }

  public get address(): string {
    return this.contracts.p1MakerOracle.options.address;
  }

  public async getPrice(
    options: CallOptions = {},
  ): Promise<Price> {
    const combinedOptions: CallOptions = {
      from: this.contracts.perpetualProxy.options.address,
      ...options,
    };
    const price = await this.contracts.call(
      this.contracts.p1MakerOracle.methods.getPrice(),
      combinedOptions,
    );
    return Price.fromSolidity(price);
  }
}
