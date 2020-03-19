import BigNumber from 'bignumber.js';
import { Contracts } from '../modules/Contracts';
import { BaseValue, SendOptions, TxResult } from '../lib/types';

export class TestP1Funder {
  private contracts: Contracts;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
  }

  public get address(): string {
    return this.contracts.testP1Funder.options.address;
  }

  public async setFunding(
    newFunding: BaseValue,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.testP1Funder.methods.setFunding(
        !newFunding.isNegative(), // isPositive
        newFunding.toSolidity(),
      ),
      options,
    );
  }

  public async getFunding(
    timeDelta: BigNumber,
  ): Promise<BaseValue> {
    const [isPositive, funding]: [boolean, string] = await this.contracts.call(
      this.contracts.testP1Funder.methods.getFunding(timeDelta),
    );
    return BaseValue.fromSolidity(funding, isPositive);
  }
}
