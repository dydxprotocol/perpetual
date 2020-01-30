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
import { EventEmitterStatic as EventEmitter } from 'eventemitter3';
import { Contracts } from './Contracts';
import { INTEGERS } from '../lib/Constants';
import { IErc20 as ERC20 } from '../../build/wrappers/IErc20';
import {
  SendOptions,
  TxResult,
  address,
  CallOptions,
} from '../lib/types';

export class Token {
  private contracts: Contracts;
  private tokens: object;

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
    const allowStr: string = await this.contracts.call(
      token.methods.allowance(ownerAddress, spenderAddress),
      options,
    );
    return new BigNumber(allowStr);
  }

  public async getBalance(
    tokenAddress: address,
    ownerAddress: address,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const token = this.getToken(tokenAddress);
    const balStr: string = await this.contracts.call(
      token.methods.balanceOf(ownerAddress),
      options,
    );
    return new BigNumber(balStr);
  }

  public async getTotalSupply(
    tokenAddress: address,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const token = this.getToken(tokenAddress);
    const supplyStr: string = await this.contracts.call(
      token.methods.totalSupply(),
      options,
    );
    return new BigNumber(supplyStr);
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
    const decStr: string = await this.contracts.call(
      token.methods.decimals(),
      options,
    );
    return new BigNumber(decStr);
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
    amount: BigNumber,
    options: SendOptions = {},
  ): Promise<TxResult> {
    const token = this.getToken(tokenAddress);

    return this.contracts.send(
      token.methods.approve(
        spenderAddress,
        amount.toFixed(0),
      ),
      { ...options, from: ownerAddress },
    );
  }

  public async setPerpetualllowance(
    tokenAddress: address,
    ownerAddress: address,
    amount: BigNumber,
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
    amount: BigNumber,
    options: SendOptions = {},
  ): Promise<TxResult> {
    const token = this.getToken(tokenAddress);

    return this.contracts.send(
      token.methods.transfer(
        toAddress,
        amount.toFixed(0),
      ),
      { ...options, from: fromAddress },
    );
  }

  public async transferFrom(
    tokenAddress: address,
    fromAddress: address,
    toAddress: address,
    senderAddress: address,
    amount: BigNumber,
    options: SendOptions = {},
  ): Promise<TxResult> {
    const token = this.getToken(tokenAddress);

    return this.contracts.send(
      token.methods.transferFrom(
        fromAddress,
        toAddress,
        amount.toFixed(0),
      ),
      { ...options, from: senderAddress },
    );
  }

  public subscribeToTransfers(
    tokenAddress: address,
    {
      from,
      to,
      fromBlock,
    }: {
      from?: address,
      to?: address,
      fromBlock?: number,
    } = {},
  ): EventEmitter {
    const token = this.getToken(tokenAddress);

    const filter: { from?: address, to?: address } = {};

    if (from) {
      filter.from = from;
    }
    if (to) {
      filter.to = to;
    }

    return token.events.Transfer({
      filter,
      fromBlock,
    });
  }

  public subscribeToApprovals(
    tokenAddress: address,
    {
      owner,
      spender,
      fromBlock,
    }: {
      owner?: address,
      spender?: address,
      fromBlock?: number,
    } = {},
  ): EventEmitter {
    const token = this.getToken(tokenAddress);

    const filter: { owner?: address, spender?: address } = {};

    if (owner) {
      filter.owner = owner;
    }
    if (spender) {
      filter.spender = spender;
    }

    return token.events.Approval({
      filter,
      fromBlock,
    });
  }

  private getToken(
    tokenAddress: string,
  ): ERC20 {
    if (this.tokens[tokenAddress]) {
      return this.tokens[tokenAddress];
    }

    const token: ERC20 = this.contracts.erc20;
    const contract: ERC20 = token.clone();
    contract.options.address = tokenAddress;

    this.tokens[tokenAddress] = contract;

    return contract;
  }
}
