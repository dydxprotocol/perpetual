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

import { bnToBytes32 } from '../../src/lib/BytesHelper';
import { SendOptions, TradeResult, TxResult } from '../../src/lib/types';
import { TestContracts } from './TestContracts';

// Special testing-only trader flag that will cause the second result to be returned from
// subsequent calls to the trader (within the same transaction).
export const TRADER_FLAG_RESULT_2 = new BigNumber(2).pow(256).minus(1);

export class TestP1Trader {
  private contracts: TestContracts;

  constructor(
    contracts: TestContracts,
  ) {
    this.contracts = contracts;
  }

  public get address(): string {
    return this.contracts.testP1Trader.options.address;
  }

  public async setTradeResult(
    tradeResult: TradeResult,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.testP1Trader.methods.setTradeResult(
        tradeResult.marginAmount.toFixed(0),
        tradeResult.positionAmount.toFixed(0),
        tradeResult.isBuy,
        bnToBytes32(tradeResult.traderFlags),
      ),
      options,
    );
  }

  public async setSecondTradeResult(
    tradeResult: TradeResult,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.testP1Trader.methods.setSecondTradeResult(
        tradeResult.marginAmount.toFixed(0),
        tradeResult.positionAmount.toFixed(0),
        tradeResult.isBuy,
        bnToBytes32(tradeResult.traderFlags),
      ),
      options,
    );
  }
}
