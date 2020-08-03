import {
  BaseValue,
  BigNumberable,
  CallOptions,
} from '../lib/types';
import { Contracts } from './Contracts';
import { FundingOracle } from './FundingOracle';

/**
 * Module for interacting with the funding oracle in an inverse perpetual market.
 *
 * Inverse perpetual: An account with a long position in the inverse perpetual (long the base
 * currency) is short the position currency according to the smart contract. To account for this,
 * the inverse perpetual uses an funding oracle which flips the sign of the value when calculating
 * funding.
 */
export class InverseFundingOracle extends FundingOracle {

  constructor(
    contracts: Contracts,
  ) {
    super(contracts, contracts.p1InverseFundingOracle);
  }

  /**
   * Get the funding that would accumulate over a period of time at the current rate.
   *
   * This is simply the current funding rate multiplied by the time delta in seconds.
   *
   * Inverse perpetual: Flip the funding value so it has the same sign as the funding rate.
   */
  public async getFunding(
    timeDeltaSeconds: BigNumberable,
    options?: CallOptions,
  ): Promise<BaseValue> {
    const funding = await super.getFunding(timeDeltaSeconds, options);
    return funding.negated();
  }
}
