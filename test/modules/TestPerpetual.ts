import {
  Networks,
  PerpetualMarket,
  PerpetualOptions,
  Provider,
  SendOptions,
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
    market: PerpetualMarket,
    networkId: number,
    options: PerpetualOptions = {},
  ) {
    super(provider, market, networkId, options);
    this.testing = new Testing(provider, this.contracts, this.web3);
  }

  public setProvider(
    provider: Provider,
    networkId: number = Networks.MAINNET,
  ): void {
    super.setProvider(provider, networkId);
    this.testing.setProvider(provider);
  }

  protected getContracts(
    provider: Provider,
    market: PerpetualMarket,
    networkId: number,
    sendOptions?: SendOptions,
  ): Contracts {
    return new TestContracts(
      provider,
      market,
      networkId,
      this.web3,
      sendOptions,
    );
  }
}
