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
  SendOptions,
  TxResult,
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

  public async getFunding(
    timestamp: BigNumberable,
    options?: CallOptions,
  ): Promise<BaseValue> {
    const [isPositive, funding]: [boolean, string] = await this.contracts.call(
      this.contracts.p1FundingOracle.methods.getFunding(
        new BigNumber(timestamp).toFixed(0),
      ),
      options,
    );
    return BaseValue.fromSolidity(funding, isPositive);
  }

  public async setFundingRate(
    fundingRate: FundingRate,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.p1FundingOracle.methods.setFundingRate(
        fundingRate.isPositive(),
        fundingRate.toSolidity(),
      ),
      options,
    );
  }
}
