/*

    Copyright 2020 dYdX Trading Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

import BigNumber from 'bignumber.js';
import { Contract } from 'web3-eth-contract';

import { Contracts } from './Contracts';
import {
  BigNumberable,
  CallOptions,
  SendOptions,
  TxResult,
  address,
} from '../lib/types';

export class CurrencyConverterProxy {
  private contracts: Contracts;
  private proxy: Contract;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
    this.proxy = this.contracts.p1CurrencyConverterProxy;
  }

  // ============ Getters ============

  /**
   * Use eth_call to simulate the result of calling the deposit() function.
   */
  public async getDepositConvertedAmount(
    account: address,
    exchangeWrapper: address,
    tokenFrom: address,
    tokenFromAmount: BigNumberable,
    data: string,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const result: string = await this.contracts.call(
      this.proxy.methods.deposit(
        account,
        this.contracts.perpetualProxy.options.address,
        exchangeWrapper,
        tokenFrom,
        new BigNumber(tokenFromAmount).toFixed(),
        data,
      ),
      options,
    );
    return new BigNumber(result);
  }

  /**
   * Use eth_call to simulate the result of calling the withdraw() function.
   */
  public async getWithdrawConvertedAmount(
    account: address,
    destination: address,
    exchangeWrapper: address,
    tokenTo: address,
    tokenFromAmount: BigNumberable,
    data: string,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const result: string = await  this.contracts.call(
      this.proxy.methods.withdraw(
        account,
        destination,
        this.contracts.perpetualProxy.options.address,
        exchangeWrapper,
        tokenTo,
        new BigNumber(tokenFromAmount).toFixed(),
        data,
      ),
      options,
    );
    return new BigNumber(result);
  }

  // ============ State-Changing Functions ============

  public async approveMaximumOnPerpetual(
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.proxy.methods.approveMaximumOnPerpetual(
        this.contracts.perpetualProxy.options.address,
      ),
      options,
    );
  }

  public async deposit(
    account: address,
    exchangeWrapper: address,
    tokenFrom: address,
    tokenFromAmount: BigNumberable,
    data: string,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.proxy.methods.deposit(
        account,
        this.contracts.perpetualProxy.options.address,
        exchangeWrapper,
        tokenFrom,
        new BigNumber(tokenFromAmount).toFixed(),
        data,
      ),
      options,
    );
  }

  public async withdraw(
    account: address,
    destination: address,
    exchangeWrapper: address,
    tokenTo: address,
    tokenFromAmount: BigNumberable,
    data: string,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.proxy.methods.withdraw(
        account,
        destination,
        this.contracts.perpetualProxy.options.address,
        exchangeWrapper,
        tokenTo,
        new BigNumber(tokenFromAmount).toFixed(),
        data,
      ),
      options,
    );
  }
}
