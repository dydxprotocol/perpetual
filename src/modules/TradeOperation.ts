import BigNumber from 'bignumber.js';
import { Contracts } from './Contracts';
import { Orders } from './Orders';
import {
  SendOptions,
  TxResult,
  ConfirmationType,
  address,
  SignedOrder,
  TradeArg,
} from '../lib/types';
import {
  addressesAreEqual,
} from '../lib/BytesHelper';

export class TradeOperation {
  // constants
  private contracts: Contracts;
  private orders: Orders;

  // stateful data
  private accounts: address[];
  private tradeArgs: TradeArg[];
  private committed: boolean;

  constructor(
    contracts: Contracts,
    orders: Orders,
  ) {
    this.contracts = contracts;
    this.orders = orders;

    this.tradeArgs = [];
    this.accounts = [];
    this.committed = false;
  }

  // ============ Public Functions ============

  public fillSignedOrder(
    order: SignedOrder,
    amount: BigNumber,
    price: BigNumber,
    fee: BigNumber,
  ): TradeOperation {
    const tradeData = this.orders.fillToTradeData(
      order,
      amount,
      price,
      fee,
    );
    this.addTradeArg({
      maker: order.maker,
      taker: order.taker,
      data: tradeData,
      trader: this.contracts.p1Orders.options.address,
    });
    return this;
  }

  public async commit(
    options?: SendOptions,
  ): Promise<TxResult> {
    if (this.committed) {
      throw new Error('Operation already committed');
    }
    if (!this.accounts.length) {
      throw new Error('No accounts have been added to trade');
    }
    if (!this.tradeArgs.length) {
      throw new Error('No tradeArgs have been added to trade');
    }

    if (options && options.confirmationType !== ConfirmationType.Simulate) {
      this.committed = true;
    }

    try {
      return this.contracts.send(
        this.contracts.perpetualV1.methods.trade(
          this.accounts,
          this.tradeArgs,
        ),
        options,
      );
    } catch (error) {
      this.committed = false;
      throw error;
    }
  }

  // ============ Private Helper Functions ============

  private addTradeArg({
    maker,
    taker,
    trader,
    data,
  }:{
    maker: address,
    taker: address,
    trader: address,
    data: string,
  }): void {
    if (this.committed) {
      throw new Error('Operation already committed');
    }

    const takerIndex = this.getAccountIndex(taker);
    const makerIndex = this.getAccountIndex(maker);
    const newTradeArg: TradeArg = {
      makerIndex,
      takerIndex,
      trader,
      data,
    };

    this.tradeArgs.push(newTradeArg);
  }

  private getAccountIndex(
    account: address,
  ): number {
    const index = this.accounts.findIndex(a => addressesAreEqual(a, account));

    // return the index if it exists
    if (index >= 0) {
      return index;
    }

    // push the account onto the list and return that index
    this.accounts.push(account);
    return this.accounts.length - 1;
  }
}
