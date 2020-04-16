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
import _ from 'lodash';

import { ITestContext } from './perpetualDescribe';
import { TRADER_FLAG_ORDERS } from '../../src/lib/Constants';
import { BigNumberable, TxResult, address } from '../../src/lib/types';

export async function buy(
  ctx: ITestContext,
  taker: address,
  maker: address,
  position: BigNumberable,
  cost: BigNumberable,
): Promise<TxResult> {
  return trade(ctx, taker, maker, position, cost, true);
}

export async function sell(
  ctx: ITestContext,
  taker: address,
  maker: address,
  position: BigNumberable,
  cost: BigNumberable,
): Promise<TxResult> {
  return trade(ctx, taker, maker, position, cost, false);
}

export async function trade(
  ctx: ITestContext,
  taker: address,
  maker: address,
  position: BigNumberable,
  cost: BigNumberable,
  isBuy: boolean,
): Promise<TxResult> {
  await ctx.perpetual.testing.trader.setTradeResult({
    isBuy,
    marginAmount: new BigNumber(cost),
    positionAmount: new BigNumber(position),
    traderFlags: TRADER_FLAG_ORDERS,
  });
  const accounts = _.chain([taker, maker]).map(_.toLower).sort().sortedUniq().value();
  return ctx.perpetual.trade.trade(
    accounts,
    [
      {
        makerIndex: accounts.indexOf(maker.toLowerCase()),
        takerIndex: accounts.indexOf(taker.toLowerCase()),
        trader: ctx.perpetual.testing.trader.address,
        data: '0x00',
      },
    ],
  );
}
