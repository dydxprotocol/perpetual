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
import { ADDRESSES, INTEGERS } from '../lib/Constants';
import {
  BigNumberable,
  CallOptions,
  Price,
  SendOptions,
  TradeResult,
  TxResult,
  address,
} from '../lib/types';

export function makeDeleverageTradeData(
  amount: BigNumberable,
  isBuy: boolean,
  allOrNothing: boolean,
): string {
  const amountData = bnToBytes32(amount);
  const isBuyData = boolToBytes32(isBuy);
  const allOrNothingData = boolToBytes32(allOrNothing);
  return combineHexStrings(amountData, isBuyData, allOrNothingData);
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

  // ============ Getters ============

  /**
   * Use eth_call to simulate the result of calling the trade() function.
   */
  public async trade(
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
      this.deleveraging.methods.trade(
        ADDRESSES.ZERO, // sender (unused)
        maker,
        taker,
        price.toSolidity(),
        makeDeleverageTradeData(amount, isBuy, allOrNothing),
        bnToBytes32(traderFlags),
      ),
      options,
    );
  }

  public async getDeleveragingTimelockSeconds(
    options?: CallOptions,
  ): Promise<number> {
    const timelockSeconds: string = await this.contracts.call(
      this.deleveraging.methods.DELEVERAGING_TIMELOCK_S(),
      options,
    );
    return Number.parseInt(timelockSeconds, 10);
  }

  public async getDeleveragingOperator(
    options?: CallOptions,
  ): Promise<address> {
    return this.contracts.call(
      this.deleveraging.methods._DELEVERAGING_OPERATOR_(),
      options,
    );
  }

  // ============ State-Changing Functions ============

  public async mark(
    account: address,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.deleveraging.methods.mark(
        account,
      ),
      options,
    );
  }

  public async unmark(
    account: address,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.deleveraging.methods.unmark(
        account,
      ),
      options,
    );
  }

  // ============ Admin Functions ============

  /**
   * Set the privileged deleveraging operator.
   *
   * Must be called by the contract owner.
   */
  public async setDeleveragingOperator(
    deleveragingOperator: address,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.p1Deleveraging.methods.setDeleveragingOperator(
        deleveragingOperator,
      ),
      options,
    );
  }
}
