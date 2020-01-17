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
/*
import {
  PromiEvent,
  Transaction,
  TransactionReceipt,
} from 'web3-core';
import {
  Block,
} from 'web3-eth';
import {
  ContractSendMethod,
  SendOptions,
} from 'web3-eth-contract';
*/

// Contracts
import { Perpetual } from '../../build/wrappers/Perpetual';

// JSON
const jsonFolder = `../../${process.env.COVERAGE ? '.coverage_artifacts' : 'build'}/contracts/`;
const perpetualJson = require(`${jsonFolder}Perpetual.json`);

import {
  address,
  Provider,
} from '../lib/types';

export class Contracts {
  private web3: Web3;
  private contractsList: any = [];

  // Contract instances
  public perpetual: Perpetual;

  constructor(
    provider: Provider,
    networkId: number,
    web3: Web3,
  ) {
    this.web3 = web3;

    // Contracts
    this.perpetual = new this.web3.eth.Contract(perpetualJson.abi) as Perpetual;

    this.contractsList = [
      { contract: this.perpetual, json: perpetualJson },
    ];

    this.setProvider(provider, networkId);
    this.setDefaultAccount(this.web3.eth.defaultAccount);
  }

  public setProvider(
    provider: Provider,
    networkId: number,
  ): void {
    this.contractsList.forEach(contract => this.setContractProvider(
        contract.contract,
        contract.json,
        provider,
        networkId,
      ),
    );
  }

  public setDefaultAccount(
    account: address,
  ): void {
    this.contractsList.forEach(contract => contract.contract.options.from = account);
  }

  private setContractProvider(
    contract: any,
    contractJson: any,
    provider: Provider,
    networkId: number,
  ): void {
    contract.setProvider(provider);
    contract.options.address = contractJson.networks[networkId]
      && contractJson.networks[networkId].address;
  }
}
