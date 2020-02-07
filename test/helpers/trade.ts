import BigNumber from 'bignumber.js';

import { ITestContext } from './perpetualDescribe';
import { address } from '../../src/lib/types';

export async function buy(
  ctx: ITestContext,
  taker: address,
  maker: address,
  position: BigNumber,
  cost: BigNumber,
) {
  return trade(ctx, taker, maker, position, cost, true);
}

export async function sell(
  ctx: ITestContext,
  taker: address,
  maker: address,
  position: BigNumber,
  cost: BigNumber,
) {
  return trade(ctx, taker, maker, position, cost, false);
}

async function trade(
  ctx: ITestContext,
  taker: address,
  maker: address,
  position: BigNumber,
  cost: BigNumber,
  isBuy: boolean,
) {
  await ctx.perpetual.testing.trader.setTradeResult({
    isBuy,
    marginAmount: cost,
    positionAmount: position,
  });
  const accounts = [taker, maker].sort();
  await ctx.perpetual.trade.trade(
    accounts,
    [
      {
        makerIndex: accounts.indexOf(maker),
        takerIndex: accounts.indexOf(taker),
        trader: ctx.perpetual.testing.trader.address,
        data: '0x00',
      },
    ],
  );
}
