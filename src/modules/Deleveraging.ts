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
import { Trade } from './Trade';
import { bnToBytes32 } from '../lib/BytesHelper';
import { ADDRESSES } from '../lib/Constants';
import {
  address,
  SendOptions,
  TxResult,
  TradeResult,
} from '../lib/types';

export class Deleveraging {
  private contracts: Contracts;
  private tradeModule: Trade;
  private deleveraging: Contract;

  constructor(
    contracts: Contracts,
    tradeModule: Trade,
  ) {
    this.contracts = contracts;
    this.tradeModule = tradeModule;
    this.deleveraging = this.contracts.p1Deleveraging;
  }

  public get address(): string {
    return this.deleveraging.options.address;
  }

  /**
   * Call trade() directly on the P1Deleveraging contract.
   */
  public async trade(
    maker: address,
    taker: address,
    price: BigNumber,
    amount: BigNumber,
    options?: SendOptions,
  ): Promise<TradeResult> {
    return this.contracts.call(
      this.deleveraging.methods.trade(
        ADDRESSES.ZERO, // sender (unused)
        maker,
        taker,
        price.toFixed(0),
        bnToBytes32(amount),
      ),
      options,
    );
  }

  /**
   * Execute a single deleverage operation via the PerpetualV1 contract.
   */
  public async deleverage(
    maker: address,
    taker: address,
    amount: BigNumber,
    options?: SendOptions,
  ): Promise<TxResult> {
    const accounts = [maker, taker].sort();
    return this.tradeModule.trade(
      accounts,
      [
        {
          makerIndex: accounts.indexOf(maker),
          takerIndex: accounts.indexOf(taker),
          trader: this.deleveraging.options.address,
          data: bnToBytes32(amount),
        },
      ],
      options,
    );
  }
}
