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
import { bnToBytes32, boolToBytes32, stripHexPrefix } from '../lib/BytesHelper';
import { ADDRESSES, INTEGERS } from '../lib/Constants';
import {
  address,
  CallOptions,
  TradeResult,
} from '../lib/types';

export function makeDeleverageTradeData(
  amount: BigNumber,
  allOrNothing: boolean,
): string {
  const amountData = bnToBytes32(amount);
  const allOrNothingData = boolToBytes32(allOrNothing);
  return `0x${stripHexPrefix(amountData)}${stripHexPrefix(allOrNothingData)}`;
}

export class Deleveraging {
  private contracts: Contracts;
  private deleveraging: Contract;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
    this.deleveraging = this.contracts.p1Deleveraging;
  }

  public get address(): string {
    return this.deleveraging.options.address;
  }

  public async trade(
    maker: address,
    taker: address,
    price: BigNumber,
    amount: BigNumber,
    allOrNothing: boolean = false,
    options?: CallOptions,
  ): Promise<TradeResult> {
    return this.contracts.call(
      this.deleveraging.methods.trade(
        ADDRESSES.ZERO, // sender (unused)
        maker,
        taker,
        price.toFixed(0),
        makeDeleverageTradeData(amount, allOrNothing),
        bnToBytes32(INTEGERS.ZERO), // traderFlags
      ),
      options,
    );
  }
}
