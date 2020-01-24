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

import BigNumber from 'bignumber.js';
import { Contracts } from './Contracts';
import {
  address,
  Balance,
  CallOptions,
  Index,
} from '../lib/types';
import { Contract } from 'web3-eth-contract';

export class Getters {
  private contracts: Contracts;
  private perpetual: Contract;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
    this.perpetual = this.contracts.perpetualV1;
  }

  // ============ Account Getters ============

  public async getAccountBalance(
    account: address,
    options?: CallOptions,
  ): Promise<Balance> {
    const result = await this.contracts.call(
      this.perpetual.methods.getAccountBalance(
        account,
      ),
      options,
    );
    return {
      margin: new BigNumber(result[0]),
      position: new BigNumber(result[1]),
    };
  }

  public async getAccountIndex(
    account: address,
    options?: CallOptions,
  ): Promise<Index> {
    const result = await this.contracts.call(
      this.perpetual.methods.getAccountIndex(
        account,
      ),
      options,
    );
    return {
      positive: new BigNumber(result[0]),
      negative: new BigNumber(result[1]),
      timestamp: new BigNumber(result[2]),
    };
  }

  // ============ Global Getters ============

  public async getIsOperator(
    operator: address,
    options?: CallOptions,
  ): Promise<boolean> {
    return this.contracts.call(
      this.perpetual.methods.getIsOperator(
        operator,
      ),
      options,
    );
  }

  public async getOracleContract(
    options?: CallOptions,
  ): Promise<address> {
    return this.contracts.call(
      this.perpetual.methods.getOracleContract(),
      options,
    );
  }

  public async getFunderContract(
    options?: CallOptions,
  ): Promise<address> {
    return this.contracts.call(
      this.perpetual.methods.getFunderContract(),
      options,
    );
  }

  public async getVaultContract(
    options?: CallOptions,
  ): Promise<address> {
    return this.contracts.call(
      this.perpetual.methods.getVaultContract(),
      options,
    );
  }

  public async getGlobalIndex(
    options?: CallOptions,
  ): Promise<Index> {
    const result = await this.contracts.call(
      this.perpetual.methods.getGlobalIndex(),
      options,
    );
    return {
      positive: new BigNumber(result[0]),
      negative: new BigNumber(result[1]),
      timestamp: new BigNumber(result[2]),
    };
  }

  public async getOpenInterest(
    options?: CallOptions,
  ): Promise<BigNumber> {
    const result = await this.contracts.call(
      this.perpetual.methods.getOpenInterest(),
      options,
    );
    return new BigNumber(result);
  }
}
