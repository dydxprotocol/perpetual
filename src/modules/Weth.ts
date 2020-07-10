import BigNumber from 'bignumber.js';
import { Contract } from 'web3-eth-contract';

import {
  BigNumberable,
  SendOptions,
  TxResult,
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
    amount: BigNumberable,
    options: SendOptions = {},
  ): Promise<TxResult> {
    const amountBN = new BigNumber(amount);
    if (typeof options.value !== 'undefined' && !amountBN.eq(options.value)) {
      throw new Error('Weth.wrap: amount does not match options.value');
    }
    return this.contracts.send(
      this.weth.methods.deposit(),
      {
        ...options,
        value: amountBN.toFixed(0),
      },
    );
  }

  public async unwrap(
    amount: BigNumberable,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.contracts.send(
      this.weth.methods.withdraw(
        new BigNumber(amount).toFixed(0),
      ),
      options,
    );
  }
}
