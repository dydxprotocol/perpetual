import {
  CallOptions,
  Price,
  TxResult,
  SendOptions,
} from '../../src/lib/types';
import { TestContracts } from './TestContracts';

export class TestP1Oracle {
  private contracts: TestContracts;

  constructor(
    contracts: TestContracts,
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
