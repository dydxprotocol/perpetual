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

import { Contracts } from './Contracts';
import { INTEGERS } from '../lib/Constants';
import {
  BigNumberable,
  CallOptions,
  SendOptions,
  TxResult,
  address,
} from '../lib/types';

export class Token {
  protected contracts: Contracts;
  private tokens: {[address: string]: Contract};

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
    this.tokens = {};
  }

  public async getAllowance(
    tokenAddress: address,
    ownerAddress: address,
    spenderAddress: address,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const token = this.getToken(tokenAddress);
    const allowance: string = await this.contracts.call(
      token.methods.allowance(ownerAddress, spenderAddress),
      options,
    );
    return new BigNumber(allowance);
  }

  public async getBalance(
    tokenAddress: address,
    ownerAddress: address,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const token = this.getToken(tokenAddress);
    const balance: string = await this.contracts.call(
      token.methods.balanceOf(ownerAddress),
      options,
    );
    return new BigNumber(balance);
  }

  public async getTotalSupply(
    tokenAddress: address,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const token = this.getToken(tokenAddress);
    const supply: string = await this.contracts.call(
      token.methods.totalSupply(),
      options,
    );
    return new BigNumber(supply);
  }

  public async getName(
    tokenAddress: address,
    options?: CallOptions,
  ): Promise<string> {
    const token = this.getToken(tokenAddress);
    return this.contracts.call(
      token.methods.name(),
      options,
    );
  }

  public async getSymbol(
    tokenAddress: address,
    options?: CallOptions,
  ): Promise<string> {
    const token = this.getToken(tokenAddress);
    return this.contracts.call(
      token.methods.symbol(),
      options,
    );
  }

  public async getDecimals(
    tokenAddress: address,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const token = this.getToken(tokenAddress);
    const decimals: string = await this.contracts.call(
      token.methods.decimals(),
      options,
    );
    return new BigNumber(decimals);
  }

  public async getPerpetualAllowance(
    tokenAddress: address,
    ownerAddress: address,
    options?: CallOptions,
  ): Promise<BigNumber> {
    return this.getAllowance(
      tokenAddress,
      ownerAddress,
      this.contracts.perpetualV1.options.address,
      options,
    );
  }

  public async setAllowance(
    tokenAddress: address,
    ownerAddress: address,
    spenderAddress: address,
    amount: BigNumberable,
    options: SendOptions = {},
  ): Promise<TxResult> {
    const token = this.getToken(tokenAddress);
    return this.contracts.send(
      token.methods.approve(
        spenderAddress,
        new BigNumber(amount).toFixed(0),
      ),
      { ...options, from: ownerAddress },
    );
  }

  public async setPerpetualAllowance(
    tokenAddress: address,
    ownerAddress: address,
    amount: BigNumberable,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.setAllowance(
      tokenAddress,
      ownerAddress,
      this.contracts.perpetualV1.options.address,
      amount,
      options,
    );
  }

  public async setMaximumAllowance(
    tokenAddress: address,
    ownerAddress: address,
    spenderAddress: address,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.setAllowance(
      tokenAddress,
      ownerAddress,
      spenderAddress,
      INTEGERS.ONES_255,
      options,
    );
  }

  public async setMaximumPerpetualAllowance(
    tokenAddress: address,
    ownerAddress: address,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.setAllowance(
      tokenAddress,
      ownerAddress,
      this.contracts.perpetualV1.options.address,
      INTEGERS.ONES_255,
      options,
    );
  }

  public async unsetPerpetualAllowance(
    tokenAddress: address,
    ownerAddress: address,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.setAllowance(
      tokenAddress,
      ownerAddress,
      this.contracts.perpetualV1.options.address,
      INTEGERS.ZERO,
      options,
    );
  }

  public async transfer(
    tokenAddress: address,
    fromAddress: address,
    toAddress: address,
    amount: BigNumberable,
    options: SendOptions = {},
  ): Promise<TxResult> {
    const token = this.getToken(tokenAddress);
    return this.contracts.send(
      token.methods.transfer(
        toAddress,
        new BigNumber(amount).toFixed(0),
      ),
      { ...options, from: fromAddress },
    );
  }

  public async transferFrom(
    tokenAddress: address,
    fromAddress: address,
    toAddress: address,
    senderAddress: address,
    amount: BigNumberable,
    options: SendOptions = {},
  ): Promise<TxResult> {
    const token = this.getToken(tokenAddress);
    return this.contracts.send(
      token.methods.transferFrom(
        fromAddress,
        toAddress,
        new BigNumber(amount).toFixed(0),
      ),
      { ...options, from: senderAddress },
    );
  }

  // ============ Helper Functions ============

  protected getToken(
    tokenAddress: string,
  ): Contract {
    if (this.tokens[tokenAddress]) {
      return this.tokens[tokenAddress];
    }

    const token: Contract = this.tokenContract();
    const contract: Contract = token.clone();
    contract.options.address = tokenAddress;

    this.tokens[tokenAddress] = contract;

    return contract;
  }

  protected tokenContract(): Contract {
    return this.contracts.erc20;
  }
}
