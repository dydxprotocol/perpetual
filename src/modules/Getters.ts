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
    const [
      marginIsPositive,
      positionIsPositive,
      margin,
      position,
    ] = await this.contracts.call(
      this.perpetual.methods.getAccountBalance(
        account,
      ),
      options,
    );
    const marginBN = new BigNumber(margin);
    const positionBN = new BigNumber(position);
    return {
      margin: marginIsPositive ? marginBN : marginBN.negated(),
      position: positionIsPositive ? positionBN : positionBN.negated(),
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
    return this.solidityIndexToIndex(result);
  }

  public async getIsLocalOperator(
    account: address,
    operator: address,
    options?: CallOptions,
  ): Promise<boolean> {
    return this.contracts.call(
      this.perpetual.methods.getIsLocalOperator(
        account,
        operator,
      ),
      options,
    );
  }

  public async hasAccountPermissions(
    account: address,
    operator: address,
    options?: CallOptions,
  ): Promise<boolean> {
    return this.contracts.call(
      this.perpetual.methods.hasAccountPermissions(
        account,
        operator,
      ),
      options,
    );
  }

  // ============ Global Getters ============

  public async getAdmin(
    options?: CallOptions,
  ): Promise<address> {
    return this.contracts.call(
      this.perpetual.methods.owner(),
      options,
    );
  }

  public async getIsGlobalOperator(
    operator: address,
    options?: CallOptions,
  ): Promise<boolean> {
    return this.contracts.call(
      this.perpetual.methods.getIsGlobalOperator(
        operator,
      ),
      options,
    );
  }

  public async getTokenContract(
    options?: CallOptions,
  ): Promise<address> {
    return this.contracts.call(
      this.perpetual.methods.getTokenContract(),
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

  public async getGlobalIndex(
    options?: CallOptions,
  ): Promise<Index> {
    const result = await this.contracts.call(
      this.perpetual.methods.getGlobalIndex(),
      options,
    );
    return this.solidityIndexToIndex(result);
  }

  public async getMinCollateral(
    options?: CallOptions,
  ): Promise<BigNumber> {
    const result = await this.contracts.call(
      this.perpetual.methods.getMinCollateral(),
      options,
    );
    return new BigNumber(result);
  }

  // ============ Helper Functions ============

  private solidityIndexToIndex(
    solidityIndex: any[],
  ): Index {
    const [
      timestamp,
      isPositive,
      value,
    ] = solidityIndex;
    const valueBN = new BigNumber(value);
    return {
      timestamp: new BigNumber(timestamp),
      value: isPositive ? valueBN : valueBN.negated(),
    };
  }
}
