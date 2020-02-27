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
      ctx.perpetual.contracts.resetGasUsed();
    });

    // Runs before any after() calls made within the perpetualDescribe() call.
    after(async () => {
      await resetEVM(preInitSnapshotId);
    });

    // Runs before any afterEach() calls made within the perpetualDescribe() call.
    afterEach(() => {
      // Output the gas used in each test case.
      if (process.env.DEBUG_GAS_USAGE_BY_FUNCTION === 'true') {
        for (const { gasUsed, name } of ctx.perpetual.contracts.getGasUsedByFunction()) {
          const label = (`${name}:`).padEnd(20, ' ');
          printGasUsage(label, `${gasUsed}`.padStart(9, ' '));
        }
      } else {
        printGasUsage('Gas used:', ctx.perpetual.contracts.getCumulativeGasUsed());
      }
    });

    tests(ctx);
  });
}

function printGasUsage(label: string, value: number | string): void {
  console.log(`\t\t\x1b[33m${label} \x1b[93m${value}\x1b[0m`);
}
