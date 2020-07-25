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

import { Token } from '../../src/modules/Token';
import {
  BigNumberable,
  SendOptions,
  TxResult,
  address,
} from '../../src/lib/types';
import { TestContracts } from './TestContracts';

export class TestToken extends Token {
  constructor(
    contracts: TestContracts,
  ) {
    super(contracts);
  }

  public mint(
    tokenAddress: address,
    account: address,
    amount: BigNumberable,
    options: SendOptions = {},
  ): Promise<TxResult> {
    const token = this.getToken(tokenAddress);
    return this.contracts.send(
      token.methods.mint(
        account,
        new BigNumber(amount).toFixed(0),
      ),
      { ...options },
    );
  }

  // ============ Helper Functions ============

  protected tokenContract(): Contract {
    return (this.contracts as TestContracts).testToken;
  }
}
