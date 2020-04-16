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

import { BaseValue, BigNumberable, address } from '../../src';
import { ITestContext } from './perpetualDescribe';

export interface PerpetualOptions {
  token?: address;
  oracle?: address;
  funder?: address;
  minCollateral?: BigNumberable;
}

/**
 * Initialize the perpetual smart contract, using test contracts by default.
 */
export default async function initializePerpetual(
  ctx: ITestContext,
  options: PerpetualOptions = {},
): Promise<void> {
  await ctx.perpetual.contracts.send(
    ctx.perpetual.contracts.perpetualV1.methods.initializeV1(
      options.token || ctx.perpetual.testing.token.address,
      options.oracle || ctx.perpetual.testing.oracle.address,
      options.funder || ctx.perpetual.testing.funder.address,
      options.minCollateral || new BaseValue('1.1').toSolidity(), // minCollateral
    ),
    { from: ctx.accounts[0] },
  );
}
