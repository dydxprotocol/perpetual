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
  SendOptions,
  TxResult,
  BigNumberable,
} from '../lib/types';
import { Contract } from 'web3-eth-contract';

export class Margin {
  private contracts: Contracts;
  private perpetual: Contract;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
    this.perpetual = this.contracts.perpetualV1;
  }

  // ============ Senders ============

  public async deposit(
    account: address,
    amount: BigNumberable,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.perpetual.methods.deposit(
        account,
        new BigNumber(amount).toFixed(0),
      ),
      options,
    );
  }

  public async withdraw(
    account: address,
    destination: address,
    amount: BigNumberable,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.perpetual.methods.withdraw(
        account,
        destination,
        new BigNumber(amount).toFixed(0),
      ),
      options,
    );
  }
}
