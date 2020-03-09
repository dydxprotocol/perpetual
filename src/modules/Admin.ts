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

import { Contracts } from './Contracts';
import {
  BaseValue,
  SendOptions,
  TxResult,
  address,
  Price,
} from '../lib/types';
import { Contract } from 'web3-eth-contract';

export class Admin {
  private contracts: Contracts;
  private perpetual: Contract;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
    this.perpetual = this.contracts.perpetualV1;
  }

  public async setGlobalOperator(
    operator: address,
    approved: boolean,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.perpetual.methods.setGlobalOperator(
        operator,
        approved,
      ),
      options,
    );
  }

  public async setOracle(
    oracle: address,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.perpetual.methods.setOracle(
        oracle,
      ),
      options,
    );
  }

  public async setFunder(
    funder: address,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.perpetual.methods.setFunder(
        funder,
      ),
      options,
    );
  }

  public async setMinCollateral(
    minCollateral: BaseValue,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.perpetual.methods.setMinCollateral(
        minCollateral.toSolidity(),
      ),
      options,
    );
  }

  public async enableFinalSettlement(
    priceLowerBound: Price,
    priceUpperBound: Price,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.perpetual.methods.enableFinalSettlement(
        priceLowerBound.toSolidity(),
        priceUpperBound.toSolidity(),
      ),
      options,
    );
  }
}
