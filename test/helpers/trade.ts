import BigNumber from 'bignumber.js';
import _ from 'lodash';

import { ITestContext } from './perpetualDescribe';
import { TRADER_FLAG_ORDERS } from '../../src/lib/Constants';
import { TxResult, address } from '../../src/lib/types';

export async function buy(
  ctx: ITestContext,
  taker: address,
  maker: address,
  position: BigNumber,
  cost: BigNumber,
): Promise<TxResult> {
  return trade(ctx, taker, maker, position, cost, true);
}

export async function sell(
  ctx: ITestContext,
  taker: address,
  maker: address,
  position: BigNumber,
  cost: BigNumber,
): Promise<TxResult> {
  return trade(ctx, taker, maker, position, cost, false);
}

async function trade(
  ctx: ITestContext,
  taker: address,
  maker: address,
  position: BigNumber,
  cost: BigNumber,
  isBuy: boolean,
): Promise<TxResult> {
  await ctx.perpetual.testing.trader.setTradeResult({
    isBuy,
    marginAmount: cost,
    positionAmount: position,
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
