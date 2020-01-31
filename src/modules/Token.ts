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
  SendOptions,
  TxResult,
  address,
  CallOptions,
} from '../lib/types';

export class Token {
  protected contracts: Contracts;
  protected token: Contract;

  constructor(
    contracts: Contracts,
    token: Contract,
  ) {
    this.contracts = contracts;
    this.token = token;
  }

  public get address(): string {
    return this.token.options.address;
  }

  public async getAllowance(
    ownerAddress: address,
    spenderAddress: address,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const allowStr: string = await this.contracts.call(
      this.token.methods.allowance(ownerAddress, spenderAddress),
      options,
    );
    return new BigNumber(allowStr);
  }

  public async getBalance(
    ownerAddress: address,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const balStr: string = await this.contracts.call(
      this.token.methods.balanceOf(ownerAddress),
      options,
    );
    return new BigNumber(balStr);
  }

  public async getTotalSupply(
    options?: CallOptions,
  ): Promise<BigNumber> {
    const supplyStr: string = await this.contracts.call(
      this.token.methods.totalSupply(),
      options,
    );
    return new BigNumber(supplyStr);
  }

  public async getName(
    options?: CallOptions,
  ): Promise<string> {
    return this.contracts.call(
      this.token.methods.name(),
      options,
    );
  }

  public async getSymbol(
    options?: CallOptions,
  ): Promise<string> {
    return this.contracts.call(
      this.token.methods.symbol(),
      options,
    );
  }

  public async getDecimals(
    options?: CallOptions,
  ): Promise<BigNumber> {
    const decStr: string = await this.contracts.call(
      this.token.methods.decimals(),
      options,
    );
    return new BigNumber(decStr);
  }

  public async getPerpetualAllowance(
    ownerAddress: address,
    options?: CallOptions,
  ): Promise<BigNumber> {
    return this.getAllowance(
      ownerAddress,
      this.contracts.perpetualV1.options.address,
      options,
    );
  }

  public async setAllowance(
    ownerAddress: address,
    spenderAddress: address,
    amount: BigNumber,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.contracts.send(
      this.token.methods.approve(
        spenderAddress,
        amount.toFixed(0),
      ),
      { ...options, from: ownerAddress },
    );
  }

  public async setPerpetualAllowance(
    ownerAddress: address,
    amount: BigNumber,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.setAllowance(
      ownerAddress,
      this.contracts.perpetualV1.options.address,
      amount,
      options,
    );
  }

  public async setMaximumAllowance(
    ownerAddress: address,
    spenderAddress: address,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.setAllowance(
      ownerAddress,
      spenderAddress,
      INTEGERS.ONES_255,
      options,
    );
  }

  public async setMaximumPerpetualAllowance(
    ownerAddress: address,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.setAllowance(
      ownerAddress,
      this.contracts.perpetualV1.options.address,
      INTEGERS.ONES_255,
      options,
    );
  }

  public async unsetPerpetualAllowance(
    ownerAddress: address,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.setAllowance(
      ownerAddress,
      this.contracts.perpetualV1.options.address,
      INTEGERS.ZERO,
      options,
    );
  }

  public async transfer(
    fromAddress: address,
    toAddress: address,
    amount: BigNumber,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.contracts.send(
      this.token.methods.transfer(
        toAddress,
        amount.toFixed(0),
      ),
      { ...options, from: fromAddress },
    );
  }

  public async transferFrom(
    fromAddress: address,
    toAddress: address,
    senderAddress: address,
    amount: BigNumber,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.contracts.send(
      this.token.methods.transferFrom(
        fromAddress,
        toAddress,
        amount.toFixed(0),
      ),
      { ...options, from: senderAddress },
    );
  }
}
