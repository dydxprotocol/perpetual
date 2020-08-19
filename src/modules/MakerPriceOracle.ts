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
import { PriceOracle } from '../modules/PriceOracle';
import {
  address,
  BaseValue,
  CallOptions,
  SendOptions,
  TxResult,
} from '../lib/types';

/**
 * Used to read and update the P1MakerOracle contract, which itself acts as a proxy for reading
 * prices from one or more oracles implementing the Maker Oracle V2 interface.
 */
export class MakerPriceOracle extends PriceOracle {

  constructor(
    contracts: Contracts,
  ) {
    super(contracts);
  }

  // ============ Getter Functions ============

  public async getRoute(
    sender: address,
    options: CallOptions = {},
  ): Promise<address> {
    return this.contracts.call(
      this.contracts.p1MakerOracle.methods._ROUTER_(sender),
      options,
    );
  }

  public async getOracleAdjustment(
    oracleAddress: address,
    options: CallOptions = {},
  ): Promise<BaseValue> {
    const result = await this.contracts.call(
      this.contracts.p1MakerOracle.methods._ADJUSTMENTS_(oracleAddress),
      options,
    );
    return BaseValue.fromSolidity(result);
  }

  // ============ Admin Functions ============

  public async setRoute(
    sender: address,
    oracle: address,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.p1MakerOracle.methods.setRoute(sender, oracle),
      options,
    );
  }

  public async setAdjustment(
    oracle: address,
    adjustment: BaseValue,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.p1MakerOracle.methods.setAdjustment(oracle, adjustment.toSolidity()),
      options,
    );
  }
}
