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

import { Contracts } from '../modules/Contracts';
import { Token } from '../modules/Token';
import {
  SendOptions,
  TxResult,
  address,
} from '../lib/types';

export class TestToken extends Token {

  constructor(
    contracts: Contracts,
  ) {
    super(contracts, contracts.testToken);
  }

  public mint(
    amount: BigNumber,
    from: address,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.contracts.send(
      this.token.methods.mint(
        amount.toFixed(0),
      ),
      { ...options, from },
    );
  }

  public mintTo(
    amount: BigNumber,
    who: address,
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.contracts.send(
      this.token.methods.mintTo(
        who,
        amount.toFixed(0),
      ),
      { ...options },
    );
  }
}
