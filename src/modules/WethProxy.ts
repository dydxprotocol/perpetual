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
  BigNumberable,
  SendOptions,
  TxResult,
} from '../lib/types';
import { BaseProxy } from './BaseProxy';

export class WethProxy extends BaseProxy {

  constructor(
    contracts: Contracts,
  ) {
    super(contracts, contracts.p1WethProxy);
  }

  public async depositEth(
    account: address,
    amount: BigNumberable,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.proxy.methods.depositEth(
        this.contracts.perpetualProxy.options.address,
        account,
      ),
      {
        ...options,
        value: new BigNumber(amount).toFixed(0),
      },
    );
  }

  public async withdrawEth(
    account: address,
    destination: address,
    amount: BigNumberable,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.proxy.methods.withdrawEth(
        this.contracts.perpetualProxy.options.address,
        account,
        destination,
        new BigNumber(amount).toFixed(0),
      ),
      options,
    );
  }
}
