import {
  Networks,
  Provider,
} from '../../src/lib/types';
import { Contracts } from '../../src/modules/Contracts';
import { Perpetual } from '../../src/Perpetual';
import { TestContracts } from './TestContracts';
import { Testing } from './Testing';

export class TestPerpetual extends Perpetual {
  public contracts: TestContracts;
  public testing: Testing;

  constructor(
    provider: Provider,
    networkId: number = Networks.MAINNET,
  ) {
    super(provider, networkId);
    this.testing = new Testing(provider, this.contracts);
  }

  protected getContracts(
    provider: Provider,
    networkId: number,
  ): Contracts {
    return new TestContracts(provider, networkId, this.web3);
  }
}
