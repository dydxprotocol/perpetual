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

import { snapshot, resetEVM } from './EVM';
import { getPerpetual } from './Perpetual';
import { address } from '../../src/lib/types';
import { Perpetual } from '../../src/Perpetual';

export interface ITestContext {
  perpetual?: Perpetual;
  accounts?: address[];
}

export type initFunction = (ctx: ITestContext) => Promise<void>;
export type testsFunction = (ctx: ITestContext) => void;

export default function perpetualDescribe(
  name: string,
  init: initFunction,
  tests: testsFunction,
):void {
  // Note that the function passed into describe() should not be async.
  describe(name, () => {
    const ctx: ITestContext = {};

    let preInitSnapshotId: string;
    let postInitSnapshotId: string;

    // Runs before any before() calls made within the perpetualDescribe() call.
    before(async () => {
      const { perpetual, accounts } = await getPerpetual();
      ctx.perpetual = perpetual;
      ctx.accounts = accounts;

      preInitSnapshotId = await snapshot();
      await init(ctx);
      postInitSnapshotId = await snapshot();
    });

    // Runs before any beforeEach() calls made within the perpetualDescribe() call.
    beforeEach(async () => {
      await resetEVM(postInitSnapshotId);
    });

    // Runs before any after() calls made within the perpetualDescribe() call.
    after(async () => {
      await resetEVM(preInitSnapshotId);
    });

    tests(ctx);
  });
}
