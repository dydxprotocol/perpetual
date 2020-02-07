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
  PromiEvent,
  TransactionReceipt,
} from 'web3-core';
import {
  ContractSendMethod,
  Contract,
} from 'web3-eth-contract';

// JSON
const jsonFolder = `../../${process.env.COVERAGE ? '.coverage_artifacts' : 'build'}/contracts/`;
const perpetualProxyJson = require(`${jsonFolder}PerpetualProxy.json`);
const perpetualV1Json = require(`${jsonFolder}PerpetualV1.json`);
const p1OrdersJson = require(`${jsonFolder}P1Orders.json`);
const testP1FunderJson = require(`${jsonFolder}Test_P1Funder.json`);
const testP1OracleJson = require(`${jsonFolder}Test_P1Oracle.json`);
const testP1TraderJson = require(`${jsonFolder}Test_P1Trader.json`);
const testTokenJson = require(`${jsonFolder}Test_Token.json`);

import {
  address,
  CallOptions,
  ConfirmationType,
  Provider,
  SendOptions,
} from '../lib/types';

enum OUTCOMES {
  INITIAL = 0,
  RESOLVED = 1,
  REJECTED = 2,
}

export class Contracts {
  private web3: Web3;
  private contractsList: { contract: Contract, json: any }[] = [];

  private defaultOptions: SendOptions;

  // Contract instances
  public perpetualProxy: Contract;
  public perpetualV1: Contract;
  public p1Orders: Contract;

  // Testing contract instances
  public testP1Funder: Contract;
  public testP1Oracle: Contract;
  public testP1Trader: Contract;
  public testToken: Contract;

  constructor(
    provider: Provider,
    networkId: number,
    web3: Web3,
  ) {
    this.web3 = web3;
    this.defaultOptions = {
      gas: null,
      gasPrice: 1000000000,
      value: 0,
      from: null,
      confirmations: 1,
      confirmationType: ConfirmationType.Confirmed,
      gasMultiplier: 1.5,
    };

    // Contracts
    this.perpetualProxy = new web3.eth.Contract(perpetualProxyJson.abi);
    this.perpetualV1 = new web3.eth.Contract(perpetualV1Json.abi);
    this.p1Orders = new web3.eth.Contract(p1OrdersJson.abi);

    // Testing contracts
    this.testP1Funder = new web3.eth.Contract(testP1FunderJson.abi);
    this.testP1Oracle = new web3.eth.Contract(testP1OracleJson.abi);
    this.testP1Trader = new web3.eth.Contract(testP1TraderJson.abi);
    this.testToken = new web3.eth.Contract(testTokenJson.abi);

    this.contractsList = [
      // Contracts
      { contract: this.perpetualProxy, json: perpetualProxyJson },
      { contract: this.perpetualV1, json: perpetualProxyJson },
      { contract: this.p1Orders, json: p1OrdersJson },

      // Testing contracts
      { contract: this.testP1Funder, json: testP1FunderJson },
      { contract: this.testP1Oracle, json: testP1OracleJson },
      { contract: this.testP1Trader, json: testP1TraderJson },
      { contract: this.testToken, json: testTokenJson },
    ];

    this.setProvider(provider, networkId);
    this.setDefaultAccount(this.web3.eth.defaultAccount);
  }

  public setProvider(
    provider: Provider,
    networkId: number,
  ): void {
    this.contractsList.forEach(
      contract => this.setContractProvider(
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
    this.contractsList.forEach(
      contract => contract.contract.options.from = account,
    );
  }

  public async send(
    method: ContractSendMethod,
    specificOptions: SendOptions = {},
  ): Promise<any> {
    const txOptions = {
      ...this.defaultOptions,
      ...specificOptions,
    };

    if (txOptions.confirmationType === ConfirmationType.Simulate || !txOptions.gas) {
      const gasEstimate = await this.estimateGas(method, txOptions);
      txOptions.gas = Math.floor(gasEstimate * txOptions.gasMultiplier);

      if (txOptions.confirmationType === ConfirmationType.Simulate) {
        return {
          gasEstimate,
          gas: txOptions.gas,
        };
      }
    }

    const promi: PromiEvent<Contract> = method.send(txOptions as any);

    let hashOutcome = OUTCOMES.INITIAL;
    let confirmationOutcome = OUTCOMES.INITIAL;

    if (!Object.values(ConfirmationType).includes(txOptions.confirmationType)) {
      throw new Error(`Invalid confirmation type: ${txOptions.confirmationType}`);
    }

    let transactionHash: string;
    let hashPromise: Promise<string>;
    let confirmationPromise: Promise<TransactionReceipt>;

    if (
      txOptions.confirmationType === ConfirmationType.Hash
      || txOptions.confirmationType === ConfirmationType.Both
    ) {
      hashPromise = new Promise(
        (resolve, reject) => {
          promi.on('error', (error: Error) => {
            if (hashOutcome === OUTCOMES.INITIAL) {
              hashOutcome = OUTCOMES.REJECTED;
              reject(error);
              (promi as any).off();
            }
          });

          promi.on('transactionHash', (txHash: string) => {
            if (hashOutcome === OUTCOMES.INITIAL) {
              hashOutcome = OUTCOMES.RESOLVED;
              resolve(txHash);
              if (txOptions.confirmationType !== ConfirmationType.Both) {
                (promi as any).off();
              }
            }
          });
        },
      );
      transactionHash = await hashPromise;
    }

    if (
      txOptions.confirmationType === ConfirmationType.Confirmed
      || txOptions.confirmationType === ConfirmationType.Both
    ) {
      confirmationPromise = new Promise(
        (resolve, reject) => {
          promi.on('error', (error: Error) => {
            if (
              confirmationOutcome === OUTCOMES.INITIAL
              && (
                txOptions.confirmationType === ConfirmationType.Confirmed
                || hashOutcome === OUTCOMES.RESOLVED
              )
            ) {
              confirmationOutcome = OUTCOMES.REJECTED;
              reject(error);
              (promi as any).off();
            }
          });

          if (txOptions.confirmations) {
            promi.on('confirmation', (confNumber: number, receipt: TransactionReceipt) => {
              if (confNumber >= txOptions.confirmations) {
                if (confirmationOutcome === OUTCOMES.INITIAL) {
                  confirmationOutcome = OUTCOMES.RESOLVED;
                  resolve(receipt);
                  (promi as any).off();
                }
              }
            });
          } else {
            promi.on('receipt', (receipt: TransactionReceipt) => {
              confirmationOutcome = OUTCOMES.RESOLVED;
              resolve(receipt);
              (promi as any).off();
            });
          }
        },
      );
    }

    if (txOptions.confirmationType === ConfirmationType.Hash) {
      return { transactionHash };
    }

    if (txOptions.confirmationType === ConfirmationType.Confirmed) {
      return confirmationPromise;
    }

    return {
      transactionHash,
      confirmation: confirmationPromise,
    };
  }

  public async call(
    method: ContractSendMethod,
    specificOptions: CallOptions = {},
  ): Promise<any> {
    const {
      blockNumber,
      ...otherOptions
    } = {
      ...this.defaultOptions,
      ...specificOptions,
    };
    return (method as any).call(otherOptions);
  }

  // ============ Helper Functions ============

  private setContractProvider(
    contract: Contract,
    contractJson: any,
    provider: Provider,
    networkId: number,
  ): void {
    (contract as any).setProvider(provider);
    contract.options.address = contractJson.networks[networkId]
      && contractJson.networks[networkId].address;
  }

  private async estimateGas(
    method: ContractSendMethod,
    txOptions: SendOptions,
  ) {
    try {
      const gasEstimate = await method.estimateGas(txOptions);
      return gasEstimate;
    } catch (error) {
      const { from, value } = txOptions;
      error.transactionData = {
        from,
        value,
        data: method.encodeABI(),
        to: (method as any)._parent._address,
      };
      throw error;
    }
  }
}
