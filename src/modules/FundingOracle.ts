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

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
  }

  public get address(): string {
    return this.contracts.p1FundingOracle.options.address;
  }

  // ============ Getters ============

  public async getBounds(
    options?: CallOptions,
  ): Promise<FundingRateBounds> {
    const results: [string, string] = await Promise.all([
      this.contracts.call(this.contracts.p1FundingOracle.methods.MAX_ABS_VALUE(), options),
      this.contracts.call(
        this.contracts.p1FundingOracle.methods.MAX_ABS_DIFF_PER_SECOND(),
        options,
      ),
    ]);
    const [maxAbsValue, maxAbsDiffPerSecond] = results.map((s: string) => {
      return FundingRate.fromSolidity(s);
    });
    return { maxAbsValue, maxAbsDiffPerSecond };
  }

  public async getFunding(
    timeDelta: BigNumberable,
    options?: CallOptions,
  ): Promise<BaseValue> {
    const [isPositive, funding]: [boolean, string] = await this.contracts.call(
      this.contracts.p1FundingOracle.methods.getFunding(
        new BigNumber(timeDelta).toFixed(0),
      ),
      options,
    );
    return BaseValue.fromSolidity(funding, isPositive);
  }

  public async getFundingRate(
    options?: CallOptions,
  ): Promise<FundingRate> {
    const oneSecondFunding = await this.getFunding(1, options);
    return new FundingRate(oneSecondFunding.value);
  }

  public async getFundingRateProvider(
    options?: CallOptions,
  ): Promise<address> {
    return this.contracts.call(
      this.contracts.p1FundingOracle.methods._FUNDING_RATE_PROVIDER_(),
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
      this.contracts.p1FundingOracle.methods.setFundingRate(
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
      this.contracts.p1FundingOracle.methods.setFundingRate(
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
      this.contracts.p1FundingOracle.methods.setFundingRateProvider(
        fundingRateProvider,
      ),
      options,
    );
  }
}
