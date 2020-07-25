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

import { Contract } from 'web3-eth-contract';
import { Contracts } from '../modules/Contracts';
import {
  address,
  BaseValue,
  Price,
  CallOptions,
  SendOptions,
  TxResult,
} from '../lib/types';

export class PriceOracle {
  private contracts: Contracts;
  private oracles: {[address: string]: Contract};

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
    this.oracles = {};
  }

  // ============ Getter Functions ============

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
    const oracle = await this.getCurrentOracleContract(options);
    const price = await this.contracts.call(
      oracle.methods.getPrice(),
      combinedOptions,
    );
    return Price.fromSolidity(price);
  }

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

  // ============ Helper Functions ============

  private async getCurrentOracleContract(
    options: CallOptions = {},
  ): Promise<Contract> {
    const oracleAddress = await this.contracts.call(
      this.contracts.perpetualV1.methods.getOracleContract(),
      options,
    );
    return this.getOracle(oracleAddress);
  }

  private getOracle(
    oracleAddress: string,
  ): Contract {
    if (this.oracles[oracleAddress]) {
      return this.oracles[oracleAddress];
    }

    const contract: Contract = this.contracts.p1MakerOracle.clone();
    contract.options.address = oracleAddress;
    this.oracles[oracleAddress] = contract;
    return contract;
  }
}
