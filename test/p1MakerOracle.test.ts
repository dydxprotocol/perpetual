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

import { Price } from '../src/lib/types';
import {
  expectBaseValueEqual,
  expectThrow,
} from './helpers/Expect';
import initializePerpetual from './helpers/initializePerpetual';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';

const oraclePrice = new Price(100);

async function init(ctx: ITestContext): Promise<void> {
  await initializePerpetual(ctx);
  await ctx.perpetual.testing.makerOracle.setPrice(oraclePrice);
}

perpetualDescribe('P1MakerOracle', init, (ctx: ITestContext) => {

  describe('getPrice', () => {
    it('succeeds if valid', async () => {
      const price = await ctx.perpetual.priceOracle.getPrice();
      expectBaseValueEqual(price, oraclePrice);
    });

    it('fails if not valid', async () => {
      await ctx.perpetual.testing.makerOracle.setValidity(false);
      await expectThrow(
        ctx.perpetual.priceOracle.getPrice(),
        'Median/invalid-price-feed',
      );
    });

    it('fails if msg.sender is not PerpetualV1', async () => {
      await expectThrow(
        ctx.perpetual.priceOracle.getPrice({ from: ctx.accounts[0] }),
        'msg.sender must be PerpetualV1',
      );
    });
  });
});
