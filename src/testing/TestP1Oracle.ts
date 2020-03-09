import { Contracts } from '../modules/Contracts';
import {
  CallOptions,
  Price,
  TxResult,
  SendOptions,
} from '../lib/types';

export class TestP1Oracle {
  private contracts: Contracts;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
  }

  public get address(): string {
    return this.contracts.testP1Oracle.options.address;
  }

  public async setPrice(
    newPrice: Price,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.testP1Oracle.methods.setPrice(
        newPrice.toSolidity(),
      ),
      options,
    );
  }

  public async getPrice(
    options?: CallOptions,
  ): Promise<Price> {
    const price = await this.contracts.call(
      this.contracts.testP1Oracle.methods.getPrice(),
      options,
    );
    return Price.fromSolidity(price);
  }
}
