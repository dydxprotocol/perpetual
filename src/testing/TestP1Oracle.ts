import BigNumber from 'bignumber.js';
import { Contracts } from '../modules/Contracts';
import { SendOptions, TxResult } from '../lib/types';

export class TestP1Oracle {
  private contracts: Contracts;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
  }

  public getAddress(): string {
    return this.contracts.testP1Oracle.options.address;
  }

  public async setPrice(
    newPrice: BigNumber,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.testP1Oracle.methods.setPrice(
        newPrice.toFixed(0),
      ),
      options,
    );
  }

  public async getPrice(): Promise<BigNumber> {
    const price = await this.contracts.call(
      this.contracts.testP1Oracle.methods.getPrice(),
    );
    return new BigNumber(price.value);
  }
}
