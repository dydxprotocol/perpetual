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
import _ from 'lodash';
import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';

import {
  CallOptions,
  SendOptions,
  MakerOracleMessage,
  TxResult,
  address,
  BigNumberable,
  Price,
} from '../lib/types';
import { signatureToVRS } from '../lib/SignatureHelper';
import { Contracts } from '../modules/Contracts';

/**
 * Used to read and update the Maker Oracle V2 Medianizer contract.
 */
export class Relayer {
  static relayers: {[address: string]: Relayer} = {};

  protected contracts: Contracts;
  protected web3: Web3;
  protected oracle: Contract;

  // ============ Factory Functions ============

  static fromAddress(contracts: Contracts, web3: Web3, address: string): Relayer {
    if (Relayer.relayers[address]) {
      return Relayer.relayers[address];
    }

    const oracle: Contract = contracts.makerOracle.clone();
    oracle.options.address = address;
    return new Relayer(contracts, web3, oracle);
  }

  // ============ Constructor ============

  constructor(
    contracts: Contracts,
    web3: Web3,
    oracle: Contract = contracts.makerOracle,
  ) {
    this.contracts = contracts;
    this.web3 = web3;
    this.oracle = oracle;

    // Register this relayer in the static map of relayers.
    if (this.address && !Relayer.relayers[this.address]) {
      Relayer.relayers[this.address] = this;
    }
  }

  // ============ Getter Functions ============

  public get address(): string {
    return this.oracle.options.address;
  }

  /**
   * Get the timestamp of the latest update.
   */
  public async getAge(
    options: CallOptions = {},
  ): Promise<BigNumber> {
    const result = await this.contracts.call(
      this.oracle.methods.age(),
      options,
    );
    return new BigNumber(result);
  }

  /**
   * Get the number of required signatures to update the oracle.
   */
  public async getBar(
    options: CallOptions = {},
  ): Promise<number> {
    const result = await this.contracts.call(
      this.oracle.methods.bar(),
      options,
    );
    return new BigNumber(result).toNumber();
  }

  /**
   * Get whether an address is authorized to sign price messages.
   */
  public async getOrcl(
    signer: address,
    options: CallOptions = {},
  ): Promise<boolean> {
    const result = await this.contracts.call(
      this.oracle.methods.orcl(
        signer,
      ),
      options,
    );
    return new BigNumber(result).eq(1);
  }

  /**
   * Get whether an address is authorized to read the oracle price.
   */
  public async getBud(
    signer: address,
    options: CallOptions = {},
  ): Promise<boolean> {
    const result = await this.contracts.call(
      this.oracle.methods.bud(
        signer,
      ),
      options,
    );
    return new BigNumber(result).eq(1);
  }

  /**
   * Get a signer address, given the signer ID (value of the first byte of the address).
   */
  public async getSlot(
    signerId: BigNumberable,
    options: CallOptions = {},
  ): Promise<address> {
    const signerIdBN = new BigNumber(signerId);
    if (!(signerIdBN.isInteger() && signerIdBN.gte(0) && signerIdBN.lt(256))) {
      throw new Error('Signer ID must be an integer from 0 to 255');
    }
    const result = await this.contracts.call(
      this.oracle.methods.slot(
        signerIdBN.toFixed(0),
      ),
      options,
    );
    return result;
  }

  /**
   * Get the value of the latest update, and a boolean indicating whether the price is nonzero.
   *
   * Must be called from an account with permission to read the oracle.
   */
  public async peek(
    options: CallOptions = {},
  ): Promise<[BigNumber, boolean]> {
    const [bytes, isValid] = await this.contracts.call(
      this.oracle.methods.peek(),
      options,
    );
    return [new BigNumber(bytes, 16), isValid];
  }

  /**
   * Get the value of the latest update. Throws if the price is zero.
   *
   * Must be called from an account with permission to read the oracle.
   */
  public async getValue(
    options: CallOptions = {},
  ): Promise<BigNumber> {
    const bytes = await this.contracts.call(
      this.oracle.methods.read(),
      options,
    );
    return new BigNumber(bytes, 16);
  }

  /**
   * Get the value of the latest update. Throws if the price is zero.
   *
   * Returns a Price object, which accounts for the on-chain 18 decimals fixed-point representation.
   * Must be called from an account with permission to read the oracle.
   */
  public async getPrice(
    options: CallOptions = {},
  ): Promise<Price> {
    const value = await this.getValue(options);
    return Price.fromSolidity(value);
  }

  public async getPrivateValue(): Promise<{
    age: BigNumber,
    value: BigNumber,
  }> {
    const rawStorageHex = await this.web3.eth.getStorageAt(this.address, 1);
    const paddedHex = rawStorageHex.slice(2).padStart(64, '0');
    const value = new BigNumber(paddedHex.slice(32), 16);
    const age = new BigNumber(paddedHex.slice(0, 32), 16);
    return {
      age,
      value,
    };
  }

  public async getPrivatePrice(): Promise<{
    age: BigNumber,
    price: Price,
  }> {
    const { age, value } = await this.getPrivateValue();
    return {
      age,
      price: Price.fromSolidity(value),
    };
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
    const vs = vrss.map(vrs => `0x${vrs.v}`);
    const rs = vrss.map(vrs => `0x${vrs.r}`);
    const ss = vrss.map(vrs => `0x${vrs.s}`);

    // Call the method.
    return this.contracts.send(
      this.oracle.methods.poke(
        vals,
        ages,
        vs,
        rs,
        ss,
      ),
      options,
    );
  }

  /**
   * Authorize new signers.
   */
  public async lift(
    signers: address[],
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.contracts.send(
      this.oracle.methods.lift(
        signers,
      ),
      options,
    );
  }

  /**
   * Unauthorize new signers.
   */
  public async drop(
    signers: address[],
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.contracts.send(
      this.oracle.methods.drop(
        signers,
      ),
      options,
    );
  }

  /**
   * Set the required number of signers to update the price.
   */
  public async setBar(
    newBar: BigNumberable,
    options: SendOptions = {},
  ): Promise<TxResult> {
    const barBn = new BigNumber(newBar);
    if (!barBn.isInteger()) {
      throw new Error('Bar must be an integer');
    }
    return this.contracts.send(
      this.oracle.methods.setBar(
        barBn.toFixed(0),
      ),
      options,
    );
  }

  /**
   * Authorize addresses to read the oracle price.
   */
  public async kiss(
    readers: address | address[],
    options: SendOptions = {},
  ): Promise<TxResult> {
    const signature = _.isArray(readers) ? 'kiss(address[])' : 'kiss(address)';
    return this.contracts.send(
      this.oracle.methods[signature](
        readers,
      ),
      options,
    );
  }

  /**
   * Unauthorize addresses so they can no longer read the oracle price.
   */
  public async diss(
    readers: address | address[],
    options: SendOptions = {},
  ): Promise<TxResult> {
    const signature = _.isArray(readers) ? 'diss(address[])' : 'diss(address)';
    return this.contracts.send(
      this.oracle.methods[signature](
        readers,
      ),
      options,
    );
  }
}
