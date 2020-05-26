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
import {
  CallOptions,
  SendOptions,
  MakerOracleMessage,
  TxResult,
} from '../lib/types';
import { signatureToVRS } from '../lib/SignatureHelper';

/**
 * Used to read and update the Maker Oracle V2 Medianizer contract.
 */
export class Relayer {
  private contracts: Contracts;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
  }

  // ============ Getter Functions ============

  public get address(): string {
    return this.contracts.makerOracle.options.address;
  }

  /**
   * Get the timestamp of the latest update.
   */
  public async getAge(
    options: CallOptions = {},
  ): Promise<BigNumber> {
    const result = await this.contracts.call(
      this.contracts.makerOracle.methods.age(),
      options,
    );
    return new BigNumber(result);
  }

  /**
   * Get the number of required signatures to update the oracle.
   */
  public async getBar(
    options: CallOptions = {},
  ): Promise <number> {
    const result = await this.contracts.call(
      this.contracts.makerOracle.methods.bar(),
      options,
    );
    return new BigNumber(result).toNumber();
  }

  /**
   * Get the value of the latest update.
   */
  public async getValue(
    options: CallOptions = {},
  ): Promise <BigNumber> {
    const bytes = await this.contracts.call(
      this.contracts.makerOracle.methods.read(),
      options,
    );
    return new BigNumber(bytes, 16);
  }

  // ============ State-Changing Functions ============

  /**
   * Update the oracle.
   */
  public async poke(
    messages: MakerOracleMessage[],
    options: SendOptions = {},
  ): Promise<TxResult> {
    // Get value and age of messages.
    const vals = messages.map(m => m.price.toSolidity());
    const ages = messages.map(m => m.timestamp.toFixed());

    // Get signatures.
    const vrss = messages.map(m => signatureToVRS(m.signature));
    const vs = vrss.map(vrs => new BigNumber(vrs.v, 16));
    const rs = vrss.map(vrs => `0x${vrs.r}`);
    const ss = vrss.map(vrs => `0x${vrs.s}`);

    // Call the method.
    return this.contracts.send(
      this.contracts.makerOracle.methods.poke(
        vals,
        ages,
        vs,
        rs,
        ss,
      ),
      options,
    );
  }
}
