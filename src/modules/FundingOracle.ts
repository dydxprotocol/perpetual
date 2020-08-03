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

import { Contracts } from '../modules/Contracts';
import {
  BaseValue,
  BigNumberable,
  CallOptions,
  FundingRate,
  FundingRateBounds,
  FundingRateStruct,
  SendOptions,
  TxResult,
  address,
} from '../lib/types';

export class FundingOracle {
  private contracts: Contracts;
  private fundingOracle: Contract;

  constructor(
    contracts: Contracts,
    fundingOracle: Contract = contracts.p1FundingOracle,
  ) {
    this.contracts = contracts;
    this.fundingOracle = fundingOracle;
  }

  public get address(): string {
    return this.fundingOracle.options.address;
  }

  // ============ Getters ============

  public async getBounds(
    options?: CallOptions,
  ): Promise<FundingRateBounds> {
    const results: [string, string] = await Promise.all([
      this.contracts.call(this.fundingOracle.methods.MAX_ABS_VALUE(), options),
      this.contracts.call(
        this.fundingOracle.methods.MAX_ABS_DIFF_PER_SECOND(),
        options,
      ),
    ]);
    const [maxAbsValue, maxAbsDiffPerSecond] = results.map((s: string) => {
      return FundingRate.fromSolidity(s);
    });
    return { maxAbsValue, maxAbsDiffPerSecond };
  }

  /**
   * Get the funding that would accumulate over a period of time at the current rate.
   *
   * This is simply the current funding rate multiplied by the time delta in seconds.
   */
  public async getFunding(
    timeDeltaSeconds: BigNumberable,
    options?: CallOptions,
  ): Promise<BaseValue> {
    const [isPositive, funding]: [boolean, string] = await this.contracts.call(
      this.fundingOracle.methods.getFunding(
        new BigNumber(timeDeltaSeconds).toFixed(0),
      ),
      options,
    );
    return BaseValue.fromSolidity(funding, isPositive);
  }

  /**
   * Get the current funding rate, represented as a per-second rate.
   */
  public async getFundingRate(
    options?: CallOptions,
  ): Promise<FundingRate> {
    const oneSecondFunding = await this.getFunding(1, options);
    return new FundingRate(oneSecondFunding.value);
  }

  /**
   * Get the address with permission to update the funding rate.
   */
  public async getFundingRateProvider(
    options?: CallOptions,
  ): Promise<address> {
    return this.contracts.call(
      this.fundingOracle.methods._FUNDING_RATE_PROVIDER_(),
      options,
    );
  }

  /**
   * Simulates the result of calling setFundingRate() using `eth_call`.
   */
  public async getBoundedFundingRate(
    fundingRate: FundingRate,
    options?: CallOptions,
  ): Promise<FundingRate> {
    const result: FundingRateStruct = await this.contracts.call(
      this.fundingOracle.methods.setFundingRate(
        fundingRate.toSoliditySignedInt(),
      ),
      options,
    );
    return FundingRate.fromSolidity(result.value, result.isPositive);
  }

  // ============ Admin Functions ============

  /**
   * Set the funding rate.
   *
   * Must be called by the funding rate provider.
   */
  public async setFundingRate(
    fundingRate: FundingRate,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.fundingOracle.methods.setFundingRate(
        fundingRate.toSoliditySignedInt(),
      ),
      options,
    );
  }

  /**
   * Set the funding rate provider.
   *
   * Must be called by the contract owner.
   */
  public async setFundingRateProvider(
    fundingRateProvider: address,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.fundingOracle.methods.setFundingRateProvider(
        fundingRateProvider,
      ),
      options,
    );
  }
}
