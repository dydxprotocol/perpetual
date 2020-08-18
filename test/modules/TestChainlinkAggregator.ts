import BigNumber from 'bignumber.js';

import {
  BigNumberable,
  TxResult,
  SendOptions,
} from '../../src/lib/types';
import { TestContracts } from './TestContracts';

export class TestChainlinkAggregator {
  private testContracts: TestContracts;

  constructor(
    testContracts: TestContracts,
  ) {
    this.testContracts = testContracts;
  }

  public async setAnswer(
    newAnswer: BigNumberable,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.testContracts.send(
      this.testContracts.testChainlinkAggregator.methods.setAnswer(
        new BigNumber(newAnswer).toFixed(0),
      ),
      options,
    );
  }
}
