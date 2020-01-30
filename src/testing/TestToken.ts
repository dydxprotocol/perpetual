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

import { Contracts } from '../modules/Contracts';
import { Token } from '../modules/Token';
import {
  SendOptions,
  CallOptions,
  TxResult,
  address,
} from '../lib/types';

export class TestToken {
  private contracts: Contracts;
  private token: Token;
  private testTokenContract: Contract;

  constructor(
    contracts: Contracts,
    token: Token,
    testTokenContract: Contract,
  ) {
    this.contracts = contracts;
    this.token = token;
    this.testTokenContract = testTokenContract;
  }

  public getAddress(): string {
    return this.testTokenContract.options.address;
  }

  public issue(
    amount: BigNumber,
    from: address,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.contracts.send(
      this.testTokenContract.methods.issue(
        amount.toFixed(0),
      ),
      { ...options, from },
    );
  }

  public issueTo(
    amount: BigNumber,
    who: address,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.contracts.send(
      this.testTokenContract.methods.issueTo(
        who,
        amount.toFixed(0),
      ),
      { ...options },
    );
  }

  public async getAllowance(
    ownerAddress: address,
    spenderAddress: address,
    options?: CallOptions,
  ): Promise<BigNumber> {
    return this.token.getAllowance(
      this.testTokenContract.options.address,
      ownerAddress,
      spenderAddress,
      options,
    );
  }

  public async getBalance(
    ownerAddress: address,
    options?: CallOptions,
  ): Promise<BigNumber> {
    return this.token.getBalance(
      this.testTokenContract.options.address,
      ownerAddress,
      options,
    );
  }

  public async getTotalSupply(
    options?: CallOptions,
  ): Promise<BigNumber> {
    return this.token.getTotalSupply(
      this.testTokenContract.options.address,
      options,
    );
  }

  public async getName(
    options?: CallOptions,
  ): Promise<string> {
    return this.token.getName(
      this.testTokenContract.options.address,
      options,
    );
  }

  public async getSymbol(
    options?: CallOptions,
  ): Promise<string> {
    return this.token.getSymbol(
      this.testTokenContract.options.address,
      options,
    );
  }

  public async getDecimals(
    options?: CallOptions,
  ): Promise<BigNumber> {
    return this.token.getDecimals(
      this.testTokenContract.options.address,
      options,
    );
  }

  public async getPerpetualAllowance(
    ownerAddress: address,
    options?: CallOptions,
  ): Promise<BigNumber> {
    return this.token.getPerpetualAllowance(
      this.testTokenContract.options.address,
      ownerAddress,
      options,
    );
  }

  public async setAllowance(
    ownerAddress: address,
    spenderAddress: address,
    amount: BigNumber,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.token.setAllowance(
      this.testTokenContract.options.address,
      ownerAddress,
      spenderAddress,
      amount,
      options,
    );
  }

  public async setPerpetualllowance(
    ownerAddress: address,
    amount: BigNumber,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.token.setPerpetualllowance(
      this.testTokenContract.options.address,
      ownerAddress,
      amount,
      options,
    );
  }

  public async setMaximumAllowance(
    ownerAddress: address,
    spenderAddress: address,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.token.setMaximumAllowance(
      this.testTokenContract.options.address,
      ownerAddress,
      spenderAddress,
      options,
    );
  }

  public async setMaximumPerpetualAllowance(
    ownerAddress: address,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.token.setMaximumPerpetualAllowance(
      this.testTokenContract.options.address,
      ownerAddress,
      options,
    );
  }

  public async unsetPerpetualAllowance(
    ownerAddress: address,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.token.unsetPerpetualAllowance(
      this.testTokenContract.options.address,
      ownerAddress,
      options,
    );
  }

  public async transfer(
    fromAddress: address,
    toAddress: address,
    amount: BigNumber,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.token.transfer(
      this.testTokenContract.options.address,
      fromAddress,
      toAddress,
      amount,
      options,
    );
  }

  public async transferFrom(
    fromAddress: address,
    toAddress: address,
    senderAddress: address,
    amount: BigNumber,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.token.transferFrom(
      this.testTokenContract.options.address,
      fromAddress,
      toAddress,
      senderAddress,
      amount,
      options,
    );
  }
}
