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

import { Contract } from 'web3-eth-contract';
import { Contracts } from './Contracts';
import {
  SendOptions,
  TradeArg,
  TxResult,
} from '../lib/types';
import { TradeOperation } from './TradeOperation';
import { Orders } from './Orders';

export class Trade {
  private contracts: Contracts;
  private perpetual: Contract;
  private orders: Orders;

  constructor(
    contracts: Contracts,
    orders: Orders,
  ) {
    this.contracts = contracts;
    this.perpetual = this.contracts.perpetualV1;
    this.orders = orders;
  }

  // ============ Public Functions ============

  public initiate(): TradeOperation {
    return new TradeOperation(
      this.contracts,
      this.orders,
    );
  }

  // ============ Solidity Functions ============

  public async trade(
    accounts: string[],
    tradeArgs: TradeArg[],
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.perpetual.methods.trade(
        accounts,
        tradeArgs,
      ),
      options,
    );
  }
}
