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

import { perpetual } from './Perpetual';

export async function resetEVM(id?: string) {
  await perpetual.testing.evm.resetEVM(id || process.env.RESET_SNAPSHOT_ID);
}

export async function mineAvgBlock() {
  await perpetual.testing.evm.increaseTime(15);
  await perpetual.testing.evm.mineBlock();
}

export async function snapshot() {
  return perpetual.testing.evm.snapshot();
}

export async function fastForward(seconds: number) {
  await perpetual.testing.evm.increaseTime(seconds);
  await perpetual.testing.evm.mineBlock();
}
