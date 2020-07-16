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

import { Contract } from 'web3-eth-contract';

import {
  SendOptions,
  TxResult,
  address,
} from '../lib/types';
import { Contracts } from './Contracts';

/**
 * Base class for client modules for Proxy contracts inheriting from the P1Proxy base contract.
 */
export abstract class BaseProxy {
  protected contracts: Contracts;
  protected proxy: Contract;

  constructor(
    contracts: Contracts,
    proxy: Contract,
  ) {
    this.contracts = contracts;
    this.proxy = proxy;
  }

  get address(): address {
    return this.proxy.options.address;
  }

  // ============ State-Changing Functions ============

  public async approveMaximumOnPerpetual(
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.proxy.methods.approveMaximumOnPerpetual(
        this.contracts.perpetualProxy.options.address,
      ),
      options,
    );
  }
}
