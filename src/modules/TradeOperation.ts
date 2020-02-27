import BigNumber from 'bignumber.js';

import { Contracts } from './Contracts';
import { makeDeleverageTradeData } from './Deleveraging';
import { makeLiquidateTradeData } from './Liquidation';
import { Orders } from './Orders';
import {
  address,
  ConfirmationType,
  Fee,
  Price,
  SendOptions,
  SignedOrder,
  TradeArg,
  TxResult,
} from '../lib/types';

interface TempTradeArg {
  maker: address;
  taker: address;
  trader: address;
  data: string;
}

export class TradeOperation {
  // constants
  private contracts: Contracts;
  private orders: Orders;

  // stateful data
  private trades: TempTradeArg[];
  private committed: boolean;

  constructor(
    contracts: Contracts,
    orders: Orders,
  ) {
    this.contracts = contracts;
    this.orders = orders;

    this.trades = [];
    this.committed = false;
  }

  // ============ Public Functions ============

  public fillSignedOrder(
    order: SignedOrder,
    amount: BigNumber,
    price: Price,
    fee: Fee,
  ): this {
    const tradeData = this.orders.fillToTradeData(
      order,
      amount,
      price,
      fee,
    );
    return this.addTradeArg({
      maker: order.maker,
      taker: order.taker,
      data: tradeData,
      trader: this.contracts.p1Orders.options.address,
    });
  }

  public liquidate(
    maker: address,
    taker: address,
    amount: BigNumber,
    allOrNothing: boolean = false,
  ): this {
    return this.addTradeArg({
      maker,
      taker,
      data: makeLiquidateTradeData(amount, allOrNothing),
      trader: this.contracts.p1Liquidation.options.address,
    });
  }

  public deleverage(
    maker: address,
    taker: address,
    amount: BigNumber,
    allOrNothing: boolean = false,
  ): this {
    return this.addTradeArg({
      maker,
      taker,
      data: makeDeleverageTradeData(amount, allOrNothing),
      trader: this.contracts.p1Deleveraging.options.address,
    });
  }

  public async commit(
    options?: SendOptions,
  ): Promise<TxResult> {
    if (this.committed) {
      throw new Error('Operation already committed');
    }
    if (!this.trades.length) {
      throw new Error('No tradeArgs have been added to trade');
    }

    if (options && options.confirmationType !== ConfirmationType.Simulate) {
      this.committed = true;
    }

    // construct sorted address list
    const accountSet = new Set<address>();
    this.trades.forEach((t) => {
      accountSet.add(t.maker);
      accountSet.add(t.taker);
    });
    const accounts: address[] = Array.from(accountSet).sort();

    // construct trade args
    const tradeArgs: TradeArg[] = this.trades.map(t => ({
      makerIndex: accounts.indexOf(t.maker),
      takerIndex: accounts.indexOf(t.taker),
      trader: t.trader,
      data: t.data,
    }));

    try {
      return this.contracts.send(
        this.contracts.perpetualV1.methods.trade(
          accounts,
          tradeArgs,
        ),
        options,
      );
    } catch (error) {
      this.committed = false;
      throw error;
    }
  }

  public addTradeArg({
    maker,
    taker,
    trader,
    data,
  }: {
    maker: address,
    taker: address,
    trader: address,
    data: string,
  }): this {
    if (this.committed) {
      throw new Error('Operation already committed');
    }
    this.trades.push({
      trader,
      data,
      maker: maker.toLowerCase(),
      taker: taker.toLowerCase(),
    });
    return this;
  }
}
