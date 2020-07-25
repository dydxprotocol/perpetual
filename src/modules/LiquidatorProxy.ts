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
import { Contract } from 'web3-eth-contract';

import { Contracts } from './Contracts';
import {
  BigNumberable,
  BaseValue,
  TxResult,
  CallOptions,
  SendOptions,
  address,
  bnToSoliditySignedInt,
} from '../lib/types';

export class LiquidatorProxy {
  private contracts: Contracts;
  private proxy: Contract;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
    this.proxy = this.contracts.p1LiquidatorProxy;
  }

  // ============ Getters ============

  public get address(): string {
    return this.proxy.options.address;
  }

  public async getInsuranceFund(
    options?: CallOptions,
  ): Promise<address> {
    return this.contracts.call(
      this.proxy.methods._INSURANCE_FUND_(),
      options,
    );
  }

  public async getInsuranceFee(
    options?: CallOptions,
  ): Promise<BaseValue> {
    const result = await this.contracts.call(
      this.proxy.methods._INSURANCE_FEE_(),
      options,
    );
    return BaseValue.fromSolidity(result);
  }

  public async getLiquidateReturnValue(
    liquidatee: address,
    liquidator: address,
    isBuy: boolean,
    maxPosition: BigNumberable,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const result = await this.contracts.call(
      this.proxy.methods.liquidate(
        liquidatee,
        liquidator,
        isBuy,
        bnToSoliditySignedInt(maxPosition),
      ),
      options,
    );
    return new BigNumber(result);
  }

  // ============ State-Changing Functions ============

  public async approveMaximumOnPerpetual(
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.proxy.methods.approveMaximumOnPerpetual(),
      options,
    );
  }

  public async liquidate(
    liquidatee: address,
    liquidator: address,
    isBuy: boolean,
    maxPosition: BigNumberable,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.proxy.methods.liquidate(
        liquidatee,
        liquidator,
        isBuy,
        bnToSoliditySignedInt(maxPosition),
      ),
      options,
    );
  }

  // ============ Admin Functions ============

  public async setInsuranceFund(
    insuranceFund: address,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.proxy.methods.setInsuranceFund(insuranceFund),
      options,
    );
  }

  public async setInsuranceFee(
    insuranceFee: BaseValue,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.proxy.methods.setInsuranceFee(insuranceFee.toSolidity()),
      options,
    );
  }
}
