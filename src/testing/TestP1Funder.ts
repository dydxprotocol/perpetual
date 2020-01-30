import BigNumber from 'bignumber.js';
import { Contracts } from '../modules/Contracts';
import { SendOptions, TxResult, Integer } from '../lib/types';

export class TestP1Funder {
  private contracts: Contracts;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
  }

  public getAddress(): string {
    return this.contracts.testP1Funder.options.address;
  }

  public async setFunding(
    isPositive: boolean,
    newFunding: Integer,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.testP1Funder.methods.setFunding(
        isPositive,
        newFunding.toFixed(0),
      ),
      options,
    );
  }

  public async getFunding(
    timestamp: Integer,
  ): Promise<Integer> {
    const [isPositive, funding] = await this.contracts.call(
      this.contracts.testP1Funder.methods.getFunding(timestamp),
    );
    if (isPositive) {
      return new BigNumber(funding.value);
    }
    return new BigNumber(funding.value).negated();
  }
}
