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

import { BigNumber } from 'bignumber.js';
import {
  SendOptions,
  TxResult,
  address,
  BigNumberable,
} from '../../src/lib/types';
import { TestContracts } from './TestContracts';

export class TestSolo {
  private contracts: TestContracts;

  constructor(
    contracts: TestContracts,
  ) {
    this.contracts = contracts;
  }

  public get address(): string {
    return this.contracts.testSolo.options.address;
  }

  // ============ Test Data Setter Functions ============

  public async setIsLocalOperator(
    owner: address,
    operator: address,
    approved: boolean,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.testSolo.methods.setIsLocalOperator(
        owner,
        operator,
        approved,
      ),
      options,
    );
  }

  public async setIsGlobalOperator(
    operator: address,
    approved: boolean,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.testSolo.methods.setIsGlobalOperator(
        operator,
        approved,
      ),
      options,
    );
  }

  public async setTokenAddress(
    marketId: BigNumberable,
    tokenAddress: address,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.testSolo.methods.setTokenAddress(
        new BigNumber(marketId).toFixed(0),
        tokenAddress,
      ),
      options,
    );
  }
}
