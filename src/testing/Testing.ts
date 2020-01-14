import { Provider } from '../lib/types';
import { EVM } from './EVM';

export class Testing {
  public evm: EVM;

  constructor(
    provider: Provider,
  ) {
    this.evm = new EVM(provider);
  }
}
