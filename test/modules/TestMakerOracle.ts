import Web3 from 'web3';

import {
  Price,
  TxResult,
  SendOptions,
} from '../../src/lib/types';
import { Relayer } from '../../src/modules/Relayer';
import { TestContracts } from './TestContracts';

export class TestMakerOracle extends Relayer {
  private testContracts: TestContracts;

  constructor(
    testContracts: TestContracts,
    web3: Web3,
  ) {
    super(testContracts, web3, testContracts.testMakerOracle);
    this.testContracts = testContracts;
  }

  public async setAge(
    newAge: Price,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.testContracts.send(
      this.testContracts.testMakerOracle.methods.setAge(
        newAge.toSolidity(),
      ),
      options,
    );
  }

  public async setPrice(
    newPrice: Price,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.testContracts.send(
      this.testContracts.testMakerOracle.methods.setPrice(
        newPrice.toSolidity(),
      ),
      options,
    );
  }

  public async setValidity(
    valid: boolean,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.testContracts.send(
      this.testContracts.testMakerOracle.methods.setValidity(valid),
      options,
    );
  }
}
