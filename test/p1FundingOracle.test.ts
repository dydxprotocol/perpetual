import {
  FUNDING_RATE_MAX_ABS_VALUE,
  FUNDING_RATE_MAX_ABS_DIFF_PER_SECOND,
  INTEGERS,
} from '../src/lib/Constants';
import {
  BaseValue,
  BigNumberable,
  FundingRate,
  Price,
  address,
} from '../src/lib/types';
import { fastForward } from './helpers/EVM';
import {
  expect,
  expectAddressesEqual,
  expectBaseValueEqual,
  expectBaseValueNotEqual,
  expectThrow,
} from './helpers/Expect';
import initializePerpetual from './helpers/initializePerpetual';
import { ITestContext, perpetualDescribe } from './helpers/perpetualDescribe';

const minUnit = INTEGERS.ONE.shiftedBy(-18);
const oraclePrice = new Price(100);

let admin: address;
let fundingRateProvider: address;
let rando: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializePerpetual(ctx);
  admin = ctx.accounts[0];
  fundingRateProvider = ctx.accounts[1];
  rando = ctx.accounts[2];
  await ctx.perpetual.testing.oracle.setPrice(oraclePrice);
}

perpetualDescribe('P1FundingOracle', init, (ctx: ITestContext) => {

  describe('constants', () => {

    it('the bounds are set as expected', async () => {
      const bounds = await ctx.perpetual.fundingOracle.getBounds();
      expectBaseValueEqual(bounds.maxAbsValue, FUNDING_RATE_MAX_ABS_VALUE);
      expectBaseValueEqual(bounds.maxAbsDiffPerSecond, FUNDING_RATE_MAX_ABS_DIFF_PER_SECOND);
    });
  });

  describe('setFundingRateProvider', () => {

    it('sets the funding rate provider', async () => {
      // Check that provider can't set the rate at first.
      await expectThrow(
        ctx.perpetual.fundingOracle.setFundingRate(new FundingRate('1e-10')),
        'The funding rate can only be set by the funding rate provider',
      );

      // Set the provider.
      const txResult = await ctx.perpetual.fundingOracle.setFundingRateProvider(
        fundingRateProvider,
        { from: admin },
      );

      // Check that the provider can set the rate after.
      await ctx.perpetual.fundingOracle.setFundingRate(new FundingRate('1e-10'));

      // Check getter.
      const providerAfter = await ctx.perpetual.fundingOracle.getFundingRateProvider();
      expect(providerAfter).to.equal(fundingRateProvider);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      const log = logs[0];
      expect(log.name).to.equal('LogFundingRateProviderSet');
      expectAddressesEqual(log.args.fundingRateProvider, fundingRateProvider);

      // Set another provider.
      await ctx.perpetual.fundingOracle.setFundingRateProvider(
        rando,
        { from: admin },
      );

      // Check that the provider can set the rate after.
      await ctx.perpetual.fundingOracle.setFundingRate(new FundingRate('1e-10'), { from: rando });
    });

    it('fails if the caller is not the admin', async () => {
      // Call from a random address.
      await expectThrow(
        ctx.perpetual.fundingOracle.setFundingRateProvider(fundingRateProvider, { from: rando }),
        'Ownable: caller is not the owner',
      );

      // Set the provider as admin, and then call from the provider address.
      await ctx.perpetual.fundingOracle.setFundingRateProvider(
        fundingRateProvider,
        { from: admin },
      );
      await expectThrow(
        ctx.perpetual.fundingOracle.setFundingRateProvider(
          fundingRateProvider,
          { from: fundingRateProvider },
        ),
        'Ownable: caller is not the owner',
      );
    });
  });

  describe('getFunding()', () => {

    it('initially returns zero', async () => {
      await expectFunding(1000, 0);
    });

    it('gets funding as a function of time elapsed', async () => {
      // Set a funding rate.
      await ctx.perpetual.fundingOracle.setFundingRateProvider(
        fundingRateProvider,
        { from: admin },
      );
      await ctx.perpetual.fundingOracle.setFundingRate(new FundingRate('1e-10'));

      // Check funding amount for different time periods.
      await expectFunding(1230, '1.23e-7');
      await expectFunding(12300, '1.23e-6');
      await expectFunding(123000, '1.23e-5');
    });
  });

  describe('setFundingRate()', () => {

    beforeEach(async () => {
      await ctx.perpetual.fundingOracle.setFundingRateProvider(
        fundingRateProvider,
        { from: admin },
      );
    });

    it('sets a positive funding rate', async () => {
      await setFundingRate(new FundingRate('1e-10'));
      await setFundingRate(new FundingRate('1e-15'));
    });

    it('sets a negative funding rate', async () => {
      await setFundingRate(new FundingRate('-1e-10'));
      await setFundingRate(new FundingRate('-1e-15'));
    });

    it('sets a very small or zero funding rate', async () => {
      await setFundingRate(new FundingRate('-1e-16'));
      await setFundingRate(new FundingRate('-1e-18'));
      await setFundingRate(new FundingRate(0));
    });

    it('fails if not called by the funding rate provider', async () => {
      await expectThrow(
        ctx.perpetual.fundingOracle.setFundingRate(new FundingRate('1e-10'), { from: rando }),
        'The funding rate can only be set by the funding rate provider',
      );
      await expectThrow(
        ctx.perpetual.fundingOracle.setFundingRate(new FundingRate('1e-10'), { from: admin }),
        'The funding rate can only be set by the funding rate provider',
      );
    });

    describe('funding rate bounds', () => {

      it('cannot exceed the max value', async () => {
        // Set to max value, while obeying the per-update speed limit.
        await setFundingRate(FUNDING_RATE_MAX_ABS_VALUE);

        // Try to set above max value.
        await setFundingRate(
          FUNDING_RATE_MAX_ABS_VALUE.plus(minUnit),
          { expectedRate: FUNDING_RATE_MAX_ABS_VALUE },
        );
      });

      it('cannot exceed the min value', async () => {
        const minFundingRate = FUNDING_RATE_MAX_ABS_VALUE.negated();

        // Set to min value, while obeying the per-update speed limit.
        await setFundingRate(minFundingRate);

        // Try to set below min value.
        await setFundingRate(
          minFundingRate.minus(minUnit),
          { expectedRate: minFundingRate },
        );
      });

      it('cannot increase faster than the per second limit', async () => {
        const quarterHour = 60 * 15;
        const quarterHourMaxDiff = FUNDING_RATE_MAX_ABS_DIFF_PER_SECOND.times(quarterHour);
        const initialRate = FundingRate.fromEightHourRate('0.00123');
        const targetRate = initialRate.plus(quarterHourMaxDiff.value);

        // Update the funding rate timestamp so we can more accurately estimate the
        // time elapsed between updates.
        await setFundingRate(initialRate);

        // Elapse less than a quarter hour. Assume this test case takes less than 15 seconds.
        await fastForward(quarterHour - 15);

        // Expect the bounded rate to be slightly lower than the requested rate.
        const boundedRate = await getBoundedFundingRate(targetRate);
        expectBaseValueNotEqual(boundedRate, targetRate);

        // Error should be at most (15 seconds) / (15 minutes) = 1 / 60.
        const actualDiff = boundedRate.minus(initialRate.value);
        const ratio = actualDiff.value.div(quarterHourMaxDiff.value).toNumber();
        expect(ratio).to.be.lessThan(1); // sanity check
        expect(ratio).to.be.gte(59 / 60 - 0.0000000001); // Allow tolerance for rounding error.
      });

      it('cannot decrease faster than the per second limit', async () => {
        const quarterHour = 60 * 15;
        const quarterHourMaxDiff = FUNDING_RATE_MAX_ABS_DIFF_PER_SECOND.times(quarterHour);
        const initialRate = FundingRate.fromEightHourRate('0.00123');
        const targetRate = initialRate.minus(quarterHourMaxDiff.value);

        // Update the funding rate timestamp so we can more accurately estimate the
        // time elapsed between updates.
        await setFundingRate(initialRate);

        // Elapse less than a quarter hour. Assume this test case takes less than 15 seconds.
        await fastForward(quarterHour - 15);

        // Expect the bounded rate to be slightly greater than the requested rate.
        const boundedRate = await getBoundedFundingRate(targetRate);
        expectBaseValueNotEqual(boundedRate, targetRate);

        // Error should be at most (15 seconds) / (15 minutes) = 1 / 60.
        const actualDiff = boundedRate.minus(initialRate.value);
        const ratio = actualDiff.value.div(quarterHourMaxDiff.value).negated().toNumber();
        expect(ratio).to.be.lessThan(1); // sanity check
        expect(ratio).to.be.gte(59 / 60 - 0.0000000001); // Allow tolerance for rounding error.
      });
    });
  });

  async function expectFunding(
    timeDelta: BigNumberable,
    expectedFunding: BigNumberable,
  ): Promise<void> {
    const funding: BaseValue = await ctx.perpetual.fundingOracle.getFunding(timeDelta);
    expectBaseValueEqual(funding, new BaseValue(expectedFunding));
  }

  /**
   * Get the bounded funding rate as the funding rate provider.
   */
  async function getBoundedFundingRate(fundingRate: FundingRate): Promise<FundingRate> {
    return ctx.perpetual.fundingOracle.getBoundedFundingRate(
      fundingRate,
      { from: fundingRateProvider },
    );
  }

  /**
   * Set the funding rate and verify the emitted logs.
   */
  async function setFundingRate(
    fundingRate: FundingRate,
    options: {
      from?: address,
      expectedRate?: FundingRate,
    } = {},
  ): Promise<void> {
    // Elapse enough time so that the speed limit does not take effect.
    await fastForward(INTEGERS.ONE_HOUR_IN_SECONDS.toNumber());

    // Verify the return value is as expected.
    const simulatedResult = await getBoundedFundingRate(fundingRate);
    const expectedRate = options.expectedRate || fundingRate;
    expectBaseValueEqual(simulatedResult, expectedRate, 'simulated result');

    // Set the funding rate.
    const txResult = await ctx.perpetual.fundingOracle.setFundingRate(
      fundingRate,
      { from: options.from || fundingRateProvider },
    );

    // Check the actual rate as returned by getFunding().
    const actualRate = await ctx.perpetual.fundingOracle.getFundingRate();
    expectBaseValueEqual(actualRate, expectedRate, 'actual rate');

    // Check logs.
    const logs = ctx.perpetual.logs.parseLogs(txResult);
    expect(logs.length, 'logs length').to.equal(1);
    expect(logs[0].name).to.equal('LogFundingRateUpdated');
    expectBaseValueEqual(
      logs[0].args.fundingRate.baseValue,
      expectedRate,
      'funding rate',
    );
  }
});
