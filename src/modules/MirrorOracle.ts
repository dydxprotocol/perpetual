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
import Web3 from 'web3';

import {
  TxResult,
  CallOptions,
  SendOptions,
  address,
} from '../../src/lib/types';
import { Relayer } from '../../src/modules/Relayer';
import { Contracts } from './Contracts';

export class MirrorOracle extends Relayer {

  constructor(
    contracts: Contracts,
    web3: Web3,
  ) {
    super(contracts, web3, contracts.p1MirrorOracle);
  }

  // ============ Getter Functions ============

  public async getUnderlyingOracleAddress(
    options: CallOptions = {},
  ): Promise<address> {
    return this.contracts.call(
      this.oracle.methods._ORACLE_(),
      options,
    );
  }

  public async getUnderlyingOracle(
    options: CallOptions = {},
  ): Promise<Relayer> {
    return Relayer.fromAddress(
      this.contracts,
      this.web3,
      await this.getUnderlyingOracleAddress(options),
    );
  }

  /**
   * Check whether a mirror oracle is synced with its underlying oracle.
   */
  public async checkSynced(
    options: CallOptions = {},
  ): Promise<{
    toAddBitmap: BigNumber,
    toRemoveBitmap: BigNumber,
    barNeedsUpdate: boolean,
  }> {
    const [toAddBitmapHex, toRemoveBitmapHex, barNeedsUpdate] = await this.contracts.call(
      this.oracle.methods.checkSynced(),
      options,
    );
    const toAddBitmap = new BigNumber(toAddBitmapHex);
    const toRemoveBitmap = new BigNumber(toRemoveBitmapHex);
    return {
      toAddBitmap,
      toRemoveBitmap,
      barNeedsUpdate,
    };
  }

  /**
   * Check whether a mirror oracle is synced with its underlying oracle.
   *
   * Returns true if the mirror is synced, and false otherwise.
   */
  public async checkIsSynced(
    options: CallOptions = {},
  ): Promise<boolean> {
    const { toAddBitmap, toRemoveBitmap, barNeedsUpdate } = await this.checkSynced(options);
    return toAddBitmap.isZero() && toRemoveBitmap.isZero() && !barNeedsUpdate;
  }

  /**
   * Check whether a mirror oracle is synced with its underlying oracle.
   */
  public async checkSyncedDetailed(
    options: CallOptions = {},
  ): Promise<{
    signersToAdd: address[],
    signersToRemove: address[],
    barNeedsUpdate: boolean,
  }> {
    const { toAddBitmap, toRemoveBitmap, barNeedsUpdate } = await this.checkSynced(options);

    // Get the exact addresses to be added and removed.
    const underlying = await this.getUnderlyingOracle();
    const signersToAdd: address[] = [];
    const signersToRemove: address[] = [];
    let toAddBits = toAddBitmap;
    let toRemoveBits = toRemoveBitmap;
    for (let signerId = 0; signerId < 256; signerId += 1) {
      const toAdd = !toAddBits.mod(2).isZero();
      const toRemove = !toRemoveBits.mod(2).isZero();

      if (toAdd) {
        signersToAdd.push(await underlying.getSlot(signerId));
      }
      if (toRemove) {
        signersToRemove.push(await this.getSlot(signerId));
      }

      toAddBits = toAddBits.dividedBy(2).dp(0, BigNumber.ROUND_DOWN);
      toRemoveBits = toRemoveBits.dividedBy(2).dp(0, BigNumber.ROUND_DOWN);
    }

    return {
      signersToAdd,
      signersToRemove,
      barNeedsUpdate,
    };
  }

  // ============ State-Changing Functions ============

  /**
   * Set the required number of signers to update the price.
   */
  public async syncBar(
    options: SendOptions = {},
  ): Promise<TxResult> {
    return this.contracts.send(
      this.oracle.methods.setBar(
      ),
      options,
    );
  }
}
