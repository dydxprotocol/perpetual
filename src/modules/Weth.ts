import BigNumber from 'bignumber.js';
import { Contract } from 'web3-eth-contract';

import {
  BigNumberable,
  SendOptions,
  TxResult,
  address,
} from '../lib/types';
import { Contracts } from './Contracts';
import { Token } from './Token';

/**
 * Client module for interacting with the WETH9 token contract.
 */
export class Weth extends Token {
  private weth: Contract;

  constructor(
    contracts: Contracts,
  ) {
    super(contracts);
    this.weth = contracts.weth;
  }

  public get address(): string {
    return this.weth.options.address;
  }

  public async wrap(
    ownerAddress: address,
    amount: BigNumberable,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.contracts.send(
      this.weth.methods.deposit(),
      {
        ...options,
        from: ownerAddress,
        value: new BigNumber(amount).toFixed(0),
      },
    );
  }

  public async unwrap(
    ownerAddress: address,
    amount: BigNumberable,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.contracts.send(
      this.weth.methods.withdraw(
        new BigNumber(amount).toFixed(0),
      ),
      {
        ...options,
        from: ownerAddress,
      },
    );
  }
}
