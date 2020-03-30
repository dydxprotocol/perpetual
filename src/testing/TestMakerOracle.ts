import { Contracts } from '../modules/Contracts';
import {
  Price,
  TxResult,
  SendOptions,
} from '../lib/types';

export class TestMakerOracle {
  private contracts: Contracts;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
  }

  public get address(): string {
    return this.contracts.testMakerOracle.options.address;
  }

  public async setPrice(
    newPrice: Price,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.testMakerOracle.methods.setPrice(
        newPrice.toSolidity(),
      ),
      options,
    );
  }

  public async setValidity(
    valid: boolean,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.testMakerOracle.methods.setValidity(valid),
      options,
    );
  }
}
