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
  BaseValue,
  CallOptions,
  Index,
  Price,
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

  // ============ Helper Functions ============

  /**
   * Get the margin and position for an account, taking into account unsettled interest.
   */
  public async getNetAccountBalance(
    account: address,
    options?: CallOptions,
  ): Promise<Balance> {
    // Get the unsettled balance.
    const balance = await this.getAccountBalance(account, options);

    // Calculate the unsettled interest.
    const globalIndex: Index = await this.getGlobalIndex(options);
    const localIndex: Index = await this.getAccountIndex(account, options);
    const indexDiff: BaseValue = globalIndex.baseValue.minus(localIndex.baseValue.value);
    const interest: BigNumber = indexDiff.times(balance.position.negated()).value;

    // Follow P1Settlement rounding rules: round debits up and credits down.
    const roundedInterest: BigNumber = interest.integerValue(BigNumber.ROUND_FLOOR);

    // Return the current balance with interest applied.
    const netMargin = balance.margin.plus(roundedInterest);
    return new Balance(netMargin, balance.position);
  }

  public async getNetAccountCollateralization(
    account: address,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const [
      balance,
      price,
    ] = await Promise.all([
      this.getNetAccountBalance(account, options),
      this.getOraclePrice(options),
    ]);
    return balance.getCollateralization(price);
  }

  public async getNetAccountIsLiquidatable(
    account: address,
    options?: CallOptions,
  ): Promise<boolean> {
    const [
      collateralization,
      minCollateralization,
    ] = await Promise.all([
      this.getNetAccountCollateralization(account, options),
      this.getMinCollateral(options),
    ]);
    return collateralization.lt(minCollateralization.value);
  }

  // ============ Account Getters ============

  public async getAccountBalance(
    account: address,
    options?: CallOptions,
  ): Promise<Balance> {
    const balance = await this.contracts.call(
      this.perpetual.methods.getAccountBalance(
        account,
      ),
      options,
    );
    return Balance.fromSolidity(balance);
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
  ): Promise<BaseValue> {
    const result = await this.contracts.call(
      this.perpetual.methods.getMinCollateral(),
      options,
    );
    return BaseValue.fromSolidity(result);
  }

  public async getFinalSettlementEnabled(
    options?: CallOptions,
  ): Promise<boolean> {
    return await this.contracts.call(
      this.perpetual.methods.getFinalSettlementEnabled(),
      options,
    );
  }

  public async getOraclePrice(
    options?: CallOptions,
  ): Promise<Price> {
    const result = await this.contracts.call(
      this.perpetual.methods.getOraclePrice(),
      {
        from: this.contracts.p1Liquidation.options.address,
        ...options,
      },
    );
    return Price.fromSolidity(result);
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
    return {
      timestamp: new BigNumber(timestamp),
      baseValue: BaseValue.fromSolidity(value, isPositive),
    };
  }
}
