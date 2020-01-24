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
  address,
  CallOptions,
  SendOptions,
} from '../lib/types';
import {
  Contract,
} from 'web3-eth-contract';

export class Proxy {
  private contracts: Contracts;
  private proxy: Contract;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
    this.proxy = this.contracts.perpetualProxy;
  }

  // ============ Getters ============

  public async admin(
    options?: CallOptions,
  ): Promise<address> {
    return this.contracts.call(
      this.proxy.methods.admin(),
      options,
    );
  }

  public async implementation(
    options?: CallOptions,
  ): Promise<address> {
    return this.contracts.call(
      this.proxy.methods.implementation(),
      options,
    );
  }

  // ============ Setters ============

  public async initialize(
    logic: address,
    admin: address,
    data: string,
    options?: SendOptions,
  ): Promise<any> {
    return this.contracts.send(
      this.proxy.methods.initialize(
        logic,
        admin,
        data,
      ),
      options,
    );
  }

  public async changeAdmin(
    newAdmin: address,
    options?: SendOptions,
  ): Promise<any> {
    return this.contracts.send(
      this.proxy.methods.changeAdmin(
        newAdmin,
      ),
      options,
    );
  }

  public async upgradeTo(
    newImplementation: address,
    options?: SendOptions,
  ): Promise<any> {
    return this.contracts.send(
      this.proxy.methods.upgradeTo(
        newImplementation,
      ),
      options,
    );
  }

  public async upgradeToAndCall(
    newImplementation: address,
    data: string,
    options?: SendOptions,
  ): Promise<any> {
    return this.contracts.send(
      this.proxy.methods.upgradeToAndCall(
        newImplementation,
        data,
      ),
      options,
    );
  }
}
