import { Contracts } from '../modules/Contracts';
import {
  Price,
  TxResult,
  SendOptions,
} from '../lib/types';

export class TestP1Monolith {
  private contracts: Contracts;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
  }

  public get address(): string {
    return this.contracts.testP1Monolith.options.address;
  }

  public async setPrice(
    newPrice: Price,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.testP1Monolith.methods.setPrice(
        newPrice.toSolidity(),
      ),
      options,
    );
  }

  public async getPrice(): Promise<Price> {
    const price = await this.contracts.call(
      this.contracts.testP1Monolith.methods.getPrice(),
    );
    return Price.fromSolidity(price);
  }
}
