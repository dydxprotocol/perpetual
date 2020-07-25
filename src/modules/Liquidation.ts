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
import { bnToBytes32, boolToBytes32, combineHexStrings } from '../lib/BytesHelper';
import { INTEGERS } from '../lib/Constants';
import {
  BigNumberable,
  CallOptions,
  Price,
  TradeResult,
  address,
} from '../lib/types';

export function makeLiquidateTradeData(
  amount: BigNumberable,
  isBuy: boolean,
  allOrNothing: boolean,
): string {
  const amountData = bnToBytes32(amount);
  const isBuyData = boolToBytes32(isBuy);
  const allOrNothingData = boolToBytes32(allOrNothing);
  return combineHexStrings(amountData, isBuyData, allOrNothingData);
}

export class Liquidation {
  private contracts: Contracts;
  private liquidation: Contract;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
    this.liquidation = this.contracts.p1Liquidation;
  }

  public get address(): string {
    return this.liquidation.options.address;
  }

  /**
   * Use eth_call to simulate the result of calling the trade() function.
   */
  public async trade(
    sender: address,
    maker: address,
    taker: address,
    price: Price,
    amount: BigNumber,
    isBuy: boolean,
    allOrNothing: boolean = false,
    traderFlags: BigNumber = INTEGERS.ZERO,
    options?: CallOptions,
  ): Promise<TradeResult> {
    return this.contracts.call(
      this.liquidation.methods.trade(
        sender,
        maker,
        taker,
        price.toSolidity(),
        makeLiquidateTradeData(amount, isBuy, allOrNothing),
        bnToBytes32(traderFlags),
      ),
      options,
    );
  }
}
