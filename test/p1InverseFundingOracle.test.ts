import {
  BaseValue,
  BigNumberable,
  FundingRate,
  address,
} from '../src/lib/types';
import {
  expectBaseValueEqual,
} from './helpers/Expect';
import initializePerpetual from './helpers/initializePerpetual';
import { ITestContext, inversePerpetualDescribe } from './helpers/perpetualDescribe';

let admin: address;
let fundingRateProvider: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializePerpetual(ctx);
  admin = ctx.accounts[0];
  fundingRateProvider = ctx.accounts[2];

  // Set the funding rate provider.
  await ctx.perpetual.fundingOracle.setFundingRateProvider(
    fundingRateProvider,
    { from: admin },
  );
}

inversePerpetualDescribe('P1InverseFundingOracle', init, (ctx: ITestContext) => {

  describe('getFunding()', () => {

    it('returns a negative rate when the funding rate was set positive', async () => {
      // Set a funding rate.
      await ctx.perpetual.fundingOracle.setFundingRate(
        new FundingRate('1e-10'),
        { from: fundingRateProvider },
      );

      // Check funding amount for different time periods.
      await expectFunding(1230, '-1.23e-7');
      await expectFunding(12300, '-1.23e-6');
      await expectFunding(123000, '-1.23e-5');
    });

    it('returns a positive rate when the funding rate was set negative', async () => {
      // Set a funding rate.
      await ctx.perpetual.fundingOracle.setFundingRate(
        new FundingRate('-2e-9'),
        { from: fundingRateProvider },
      );

      // Check funding amount for different time periods.
      await expectFunding(1230, '2.46e-6');
      await expectFunding(12300, '2.46e-5');
      await expectFunding(123000, '2.46e-4');
    });
  });

  async function expectFunding(
    timeDelta: BigNumberable,
    expectedFunding: BigNumberable,
  ): Promise<void> {
    const funding: BaseValue = await ctx.perpetual.fundingOracle.getFunding(timeDelta);
    expectBaseValueEqual(funding, new BaseValue(expectedFunding));
  }
});
