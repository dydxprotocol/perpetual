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

import Web3 from 'web3';
import {
  address,
  Networks,
  Provider,
} from './lib/types';
import { Testing } from './testing/Testing';
import { Contracts } from './modules/Contracts';
import { Proxy } from './modules/Proxy';
import { Getters } from './modules/Getters';
import { Margin } from './modules/Margin';
import { Trade } from './modules/Trade';

export class Perpetual {

  public web3: Web3;
  public contracts: Contracts;
  public testing: Testing;
  public proxy: Proxy;
  public getters: Getters;
  public margin: Margin;
  public trade: Trade;

  constructor(
    provider: Provider,
    networkId: number = Networks.MAINNET,
  ) {
    this.web3 = new Web3(provider);
    this.contracts = new Contracts(provider, networkId, this.web3);
    this.testing = new Testing(provider);
    this.proxy = new Proxy(this.contracts);
    this.getters = new Getters(this.contracts);
    this.margin = new Margin(this.contracts);
    this.trade = new Trade(this.contracts);
  }

  public setDefaultAccount(
    account: address,
  ): void {
    this.web3.eth.defaultAccount = account;
    this.contracts.setDefaultAccount(account);
  }
}
