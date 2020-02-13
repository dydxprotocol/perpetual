import { Contracts } from '../modules/Contracts';
import { bnToBytes32 } from '../lib/BytesHelper';
import { SendOptions, TradeResult, TxResult } from '../lib/types';

export class TestP1Trader {
  private contracts: Contracts;

  constructor(
    contracts: Contracts,
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
}
