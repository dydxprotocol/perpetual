import BigNumber from 'bignumber.js';
import { Contracts } from '../modules/Contracts';
import { SendOptions, TradeResult, TxResult, address } from '../lib/types';

export class TestP1Trader {
  private contracts: Contracts;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
  }

  public getAddress(): string {
    return this.contracts.testP1Trader.options.address;
  }

  public async setTradeResult(
    tradeResult: TradeResult,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.testP1Trader.methods.setTradeResult(
        tradeResult.marginAmount,
        tradeResult.positionAmount,
        tradeResult.isBuy,
      ),
      options,
    );
  }
}
