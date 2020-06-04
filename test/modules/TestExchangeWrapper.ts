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

import { BigNumber } from 'bignumber.js';
import Web3 from 'web3';

import { ADDRESSES } from '../../src/lib/Constants';
import {
  CallOptions,
  SendOptions,
  TxResult,
  address,
  BigNumberable,
} from '../../src/lib/types';
import { TestContracts } from './TestContracts';

export class TestExchangeWrapper {
  private web3: Web3;
  private contracts: TestContracts;

  constructor(
    contracts: TestContracts,
    web3: Web3,
  ) {
    this.web3 = web3;
    this.contracts = contracts;
  }

  public get address(): string {
    return this.contracts.testExchangeWrapper.options.address;
  }

  // ============ Test Data Setter Functions ============

  public async setMakerAmount(
    makerAmount: BigNumberable,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.testExchangeWrapper.methods.setMakerAmount(
        new BigNumber(makerAmount).toFixed(0),
      ),
      options,
    );
  }

  public async setTakerAmount(
    takerAmount: BigNumberable,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.testExchangeWrapper.methods.setTakerAmount(
        new BigNumber(takerAmount).toFixed(0),
      ),
      options,
    );
  }

  // ============ Getters ============

  public async getExchangeCost(
    options?: CallOptions,
  ): Promise<BigNumber> {
    const resultString = await this.contracts.call(
      this.contracts.testExchangeWrapper.methods.getExchangeCost(
        ADDRESSES.ZERO, // makerToken
        ADDRESSES.ZERO, // takerToken
        0, // desiredMakerToken
        '0x00', // orderData
      ),
      options,
    );
    return new BigNumber(resultString);
  }

  // ============ State-Changing Functions ============

  public async exchange(
    receiver: address,
    makerToken: address,
    takerToken: address,
    requestedFillAmount: BigNumberable,
    options?: SendOptions,
  ): Promise<TxResult> {
    return this.contracts.send(
      this.contracts.testExchangeWrapper.methods.setTakerAmount(
        ADDRESSES.ZERO, // tradeOriginator
        receiver,
        makerToken,
        takerToken,
        new BigNumber(requestedFillAmount).toFixed(0),
        this.testOrderToBytes({ amount: requestedFillAmount }),
      ),
      options,
    );
  }

  public testOrderToBytes(
    orderData: {
      amount: BigNumberable;
    },
  ): string {
    return this.web3.eth.abi.encodeParameters(
      ['uint256'],
      [new BigNumber(orderData.amount).toFixed()],
    );
  }
}
