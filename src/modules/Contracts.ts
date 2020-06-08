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

import _ from 'lodash';
import Web3 from 'web3';
import {
  PromiEvent,
  TransactionReceipt,
} from 'web3-core';
import {
  ContractSendMethod,
  Contract,
} from 'web3-eth-contract';
import {
  address,
  ConfirmationType,
  Provider,
  TxResult,
  TxOptions,
  CallOptions,
  NativeSendOptions,
  SendOptions,
} from '../lib/types';

// JSON
import perpetualProxyJson from '../../build/contracts/PerpetualProxy.json';
import perpetualV1Json from '../../build/contracts/PerpetualV1.json';
import p1FundingOracleJson from '../../build/contracts/P1FundingOracle.json';
import p1MakerOracleJson from '../../build/contracts/P1MakerOracle.json';
import p1OrdersJson from '../../build/contracts/P1Orders.json';
import p1DeleveragingJson from '../../build/contracts/P1Deleveraging.json';
import p1LiquidationJson from '../../build/contracts/P1Liquidation.json';
import p1CurrencyConverterProxyJson from '../../build/contracts/P1CurrencyConverterProxy.json';
import p1LiquidatorProxyJson from '../../build/contracts/P1LiquidatorProxy.json';
import erc20Json from '../../build/contracts/ERC20.json';
import makerOracleJson from '../../build/contracts/I_MakerOracle.json';

enum OUTCOMES {
  INITIAL = 0,
  RESOLVED = 1,
  REJECTED = 2,
}

interface Json {
  abi: any;
  networks: { [network: number]: any };
}

interface ContractInfo {
  contract: Contract;
  json: Json;
  isTest: boolean;
}

export class Contracts {
  private defaultOptions: SendOptions;
  private _cumulativeGasUsed: number = 0;
  private _gasUsedByFunction: { name: string, gasUsed: number }[] = [];
  private _countGasUsage: boolean = false;

  protected web3: Web3;

  // Contract instances
  public networkId: number;
  public contractsList: ContractInfo[] = [];
  public perpetualProxy: Contract;
  public perpetualV1: Contract;
  public p1FundingOracle: Contract;
  public p1MakerOracle: Contract;
  public p1Orders: Contract;
  public p1Deleveraging: Contract;
  public p1Liquidation: Contract;
  public p1CurrencyConverterProxy: Contract;
  public p1LiquidatorProxy: Contract;
  public erc20: Contract;
  public makerOracle: Contract;

  constructor(
    provider: Provider,
    networkId: number,
    web3: Web3,
    sendOptions: SendOptions = {},
  ) {
    this.web3 = web3;
    this.defaultOptions = {
      gas: null,
      gasPrice: 1000000000,
      value: 0,
      from: null,
      confirmations: 0,
      confirmationType: ConfirmationType.Confirmed,
      gasMultiplier: 1.5,
      ...sendOptions,
    };

    // Contracts
    this.perpetualProxy = this.addContract(perpetualProxyJson);
    this.perpetualV1 = this.addContract(perpetualV1Json);
    this.p1FundingOracle = this.addContract(p1FundingOracleJson);
    this.p1MakerOracle = this.addContract(p1MakerOracleJson);
    this.p1Orders = this.addContract(p1OrdersJson);
    this.p1Deleveraging = this.addContract(p1DeleveragingJson);
    this.p1Liquidation = this.addContract(p1LiquidationJson);
    this.p1CurrencyConverterProxy = this.addContract(p1CurrencyConverterProxyJson);
    this.p1LiquidatorProxy = this.addContract(p1LiquidatorProxyJson);
    this.erc20 = this.addContract(erc20Json, true);
    this.makerOracle = this.addContract(makerOracleJson, true);

    this.setProvider(provider, networkId);
    this.setDefaultAccount(this.web3.eth.defaultAccount);
  }

  public getCumulativeGasUsed(): number {
    return this._cumulativeGasUsed;
  }

  public resetGasUsed(): void {
    this._cumulativeGasUsed = 0;
    this._gasUsedByFunction = []; // leave work for garbage collector
  }

  /**
   * Get a list of gas used by function since last call to resetGasUsed().
   */
  public * getGasUsedByFunction(): Iterable<{ name: string, gasUsed: number }> {
    for (const gasUsed of this._gasUsedByFunction) {
      yield gasUsed;
    }
  }

  public setProvider(
    provider: Provider,
    networkId: number,
  ): void {
    this.networkId = networkId;

    // Only record gas usage for local testnets.
    this._countGasUsage = [1001, 1002].includes(networkId);

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

  public async call(
    method: ContractSendMethod,
    specificOptions: CallOptions = {},
  ): Promise<any> {
    const {
      blockNumber,
      ...otherOptions
    } = this.toCallOptions({
      ...this.defaultOptions,
      ...specificOptions,
    });
    return (method as any).call(otherOptions, blockNumber || 'latest');
  }

  public async send(
    method: ContractSendMethod,
    specificOptions: SendOptions = {},
  ): Promise<TxResult> {
    const sendOptions: SendOptions = {
      ...this.defaultOptions,
      ...specificOptions,
    };

    const result = await this._send(method, sendOptions);

    if (
      this._countGasUsage
      && [
        ConfirmationType.Both,
        ConfirmationType.Confirmed,
      ].includes(sendOptions.confirmationType)
    ) {
      // Count gas used.
      const contract: Contract = (method as any)._parent;
      const contractInfo = _.find(this.contractsList, { contract });
      if (contractInfo && !contractInfo.isTest) {
        const gasUsed = (result as TxResult).gasUsed;
        this._cumulativeGasUsed += gasUsed;
        this._gasUsedByFunction.push({ gasUsed, name: (method as any)._method.name });
      }
    }

    return result;
  }

  // ============ Helper Functions ============

  protected addContract(
    json: Json,
    isTest: boolean = false,
  ): Contract {
    const contract = new this.web3.eth.Contract(json.abi);
    this.contractsList.push({ contract, json, isTest });
    return contract;
  }

  private setContractProvider(
    contract: Contract,
    contractJson: Json,
    provider: Provider,
    networkId: number,
  ): void {
    (contract as any).setProvider(provider);
    const json: Json = (contract === this.perpetualV1)
      ? _.find(this.contractsList, { contract: this.perpetualProxy }).json
      : contractJson;
    contract.options.address = json.networks[networkId] && json.networks[networkId].address;
  }

  private async _send( // tslint:disable-line:function-name
    method: ContractSendMethod,
    sendOptions: SendOptions = {},
  ): Promise<TxResult> {
    const {
      confirmations,
      confirmationType,
      gasMultiplier,
      ...txOptions
    } = sendOptions;

    if (!Object.values(ConfirmationType).includes(confirmationType)) {
      throw new Error(`Invalid confirmation type: ${confirmationType}`);
    }

    if (confirmationType === ConfirmationType.Simulate || !txOptions.gas) {
      const gasEstimate = await this.estimateGas(method, txOptions);
      txOptions.gas = Math.floor(gasEstimate * gasMultiplier);

      if (confirmationType === ConfirmationType.Simulate) {
        return {
          gasEstimate,
          gas: txOptions.gas,
        };
      }
    }

    const promi: PromiEvent<Contract> = method.send(this.toNativeSendOptions(txOptions) as any);

    let hashOutcome = OUTCOMES.INITIAL;
    let confirmationOutcome = OUTCOMES.INITIAL;

    let transactionHash: string;
    let hashPromise: Promise<string>;
    let confirmationPromise: Promise<TransactionReceipt>;

    if ([
      ConfirmationType.Hash,
      ConfirmationType.Both,
    ].includes(confirmationType)) {
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
              if (confirmationType !== ConfirmationType.Both) {
                (promi as any).off();
              }
            }
          });
        },
      );
      transactionHash = await hashPromise;
    }

    if ([
      ConfirmationType.Confirmed,
      ConfirmationType.Both,
    ].includes(confirmationType)) {
      confirmationPromise = new Promise(
        (resolve, reject) => {
          promi.on('error', (error: Error) => {
            if (
              confirmationOutcome === OUTCOMES.INITIAL
              && (
                confirmationType === ConfirmationType.Confirmed
                || hashOutcome === OUTCOMES.RESOLVED
              )
            ) {
              confirmationOutcome = OUTCOMES.REJECTED;
              reject(error);
              (promi as any).off();
            }
          });

          if (confirmations) {
            promi.on('confirmation', (confNumber: number, receipt: TransactionReceipt) => {
              if (confNumber >= confirmations) {
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

    if (confirmationType === ConfirmationType.Hash) {
      return this.normalizeResponse({ transactionHash });
    }

    if (confirmationType === ConfirmationType.Confirmed) {
      return confirmationPromise;
    }

    return this.normalizeResponse({
      transactionHash,
      confirmation: confirmationPromise,
    });
  }

  private async estimateGas(
    method: ContractSendMethod,
    txOptions: SendOptions,
  ) {
    const estimateOptions: TxOptions = this.toEstimateOptions(txOptions);
    try {
      const gasEstimate = await method.estimateGas(estimateOptions);
      return gasEstimate;
    } catch (error) {
      error.transactionData = {
        ...estimateOptions,
        data: method.encodeABI(),
        to: (method as any)._parent._address,
      };
      throw error;
    }
  }

  // ============ Parse Options ============

  private toEstimateOptions(
    options: SendOptions,
  ): TxOptions {
    return _.pick(options, [
      'from',
      'value',
    ]);
  }

  private toCallOptions(
    options: any,
  ): CallOptions {
    return _.pick(options, [
      'from',
      'value',
      'blockNumber',
    ]);
  }

  private toNativeSendOptions(
    options: any,
  ): NativeSendOptions {
    return _.pick(options, [
      'from',
      'value',
      'gasPrice',
      'gas',
      'nonce',
    ]);
  }

  private normalizeResponse(
    txResult: any,
  ): any {
    const txHash = txResult.transactionHash;
    if (txHash) {
      const {
        transactionHash: internalHash,
        nonce: internalNonce,
      } = txHash;
      if (internalHash) {
        txResult.transactionHash = internalHash;
      }
      if (internalNonce) {
        txResult.nonce = internalNonce;
      }
    }
    return txResult;
  }
}
