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

import { BaseValue } from '../src';
import { expectBN, expectBaseValueEqual } from './helpers/Expect';
import initializePerpetual from './helpers/initializePerpetual';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';

perpetualDescribe('Perpetual', initializePerpetual, (ctx: ITestContext) => {

  describe('initial state', () => {
    it('has proper index', async () => {
      const index = await ctx.perpetual.getters.getGlobalIndex();
      const { timestamp } = await ctx.perpetual.web3.eth.getBlock('latest');
      expectBaseValueEqual(index.baseValue, new BaseValue(0));
      expectBN(index.timestamp).lte(timestamp as any);
    });

    it('has empty balances', async () => {
      const balance = await ctx.perpetual.getters.getAccountBalance(ctx.accounts[0]);
      expectBN(balance.margin).eq(0);
      expectBN(balance.position).eq(0);
    });

    // TODO
  });

  // TODO
});
