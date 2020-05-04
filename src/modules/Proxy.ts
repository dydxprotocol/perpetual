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
  BaseValue,
  CallOptions,
  SendOptions,
} from '../lib/types';
import {
  Contract,
} from 'web3-eth-contract';

export class Proxy {
  private contracts: Contracts;
  private proxy: Contract;
  private perpetualV1: Contract;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
    this.proxy = this.contracts.perpetualProxy;
    this.perpetualV1 = this.contracts.perpetualV1;
  }

  // ============ Getters ============

  public async getAdmin(
    options?: CallOptions,
  ): Promise<address> {
    return this.contracts.call(
      this.perpetualV1.methods.getAdmin(),
      options,
    );
  }

  public async getImplementation(
    options?: CallOptions,
  ): Promise<address> {
    return this.contracts.call(
      this.proxy.methods.implementation(),
      options,
    );
  }

  // ============ Setters ============

  public async initialize(
    token: address,
    oracle: address,
    funder: address,
    minCollateral: BaseValue,
    options?: SendOptions,
  ): Promise<any> {
    return this.contracts.send(
      this.perpetualV1.methods.initializeV1(
        token,
        oracle,
        funder,
        minCollateral.toSolidity(),
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
