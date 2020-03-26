import { INTEGERS } from '../src/lib/Constants';
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
  expectBaseValueEqual,
  expectBaseValueNotEqual,
  expectThrow,
} from './helpers/Expect';
import initializePerpetual from './helpers/initializePerpetual';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';

// Funding rate limits. Some of these are set by the deploy script.
const minUnit = INTEGERS.ONE.shiftedBy(-18);
const maxRate = FundingRate.fromDailyRate('0.02');
const minRate = maxRate.negated();
const maxDiffPerUpdate = FundingRate.fromDailyRate('0.01');
const maxDiffPerSecond = maxRate.div(INTEGERS.ONE_HOUR_IN_SECONDS);

const oraclePrice = new Price(100);

let admin: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializePerpetual(ctx);
  admin = ctx.accounts[0];
  await ctx.perpetual.testing.oracle.setPrice(oraclePrice);
}

perpetualDescribe('P1FundingOracle', init, (ctx: ITestContext) => {

  describe('constants', () => {

    it('the bounds are set as expected', async () => {
      const bounds = await ctx.perpetual.fundingOracle.getBounds();
      expectBaseValueEqual(bounds.maxAbsValue, maxRate);
      expectBaseValueEqual(bounds.maxAbsDiffPerUpdate, maxDiffPerUpdate);
      expectBaseValueEqual(bounds.maxAbsDiffPerSecond, maxDiffPerSecond);
    });
  });

  describe('getFunding()', () => {

    it('initially returns zero', async () => {
      await expectFunding(1000, 0);
    });

    it('gets funding as a function of time elapsed', async () => {
      // Funding is represented as an annual rate.
      await ctx.perpetual.fundingOracle.setFundingRate(
        new FundingRate('1e-10'),
        { from: admin },
      );

      await expectFunding(INTEGERS.ONE_YEAR_IN_SECONDS.times(1000), '1e-7');
      await expectFunding(INTEGERS.ONE_YEAR_IN_SECONDS.times(10000), '1e-6');
      await expectFunding(INTEGERS.ONE_YEAR_IN_SECONDS.times(100000), '1e-5');
    });
  });

  describe('setFundingRate()', () => {

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

    it('fails if not called by the contract owner', async () => {
      await expectThrow(
        ctx.perpetual.fundingOracle.setFundingRate(new FundingRate('1e-10')),
        'Ownable: caller is not the owner',
      );
    });

    describe('funding rate bounds', () => {

      it('cannot exceed the max value', async () => {
        // Set to max value, while obeying the per-update speed limit.
        await setFundingRate(FundingRate.fromDailyRate('0.01'));
        await setFundingRate(maxRate);

        // Try to set above max value.
        await setFundingRate(maxRate.plus(minUnit), maxRate);
      });

      it('cannot exceed the min value', async () => {
        // Set to min value, while obeying the per-update speed limit.
        await setFundingRate(FundingRate.fromDailyRate('-0.01'));
        await setFundingRate(minRate);

        // Try to set below min value.
        await setFundingRate(minRate.minus(minUnit), minRate);
      });

      it('cannot increase faster than the per update limit', async () => {
        await setFundingRate(maxDiffPerUpdate.plus(minUnit), maxDiffPerUpdate);
        await setFundingRate(maxDiffPerUpdate.times(2).plus(minUnit), maxDiffPerUpdate.times(2));
      });

      it('cannot decrease faster than the per update limit', async () => {
        const negativeMaxDiff = maxDiffPerUpdate.negated();
        await setFundingRate(negativeMaxDiff.minus(minUnit), negativeMaxDiff);
        await setFundingRate(negativeMaxDiff.times(2).minus(minUnit), negativeMaxDiff.times(2));
      });

      it('cannot increase faster than the per second limit', async () => {
        const quarterHour = 60 * 15;
        const quarterHourMaxDiff = maxDiffPerSecond.times(quarterHour);
        const initialRate = new FundingRate('0.123');
        const targetRate = initialRate.plus(quarterHourMaxDiff.value);

        // Update the funding rate timestamp so we can more accurately estimate the
        // time elapsed between updates.
        await setFundingRate(initialRate);

        // Elapse less than a quarter hour. Assume this test case takes less than 15 seconds.
        await fastForward(quarterHour - 15);

        // Expect the bounded rate to be slightly lower than the requested rate.
        const boundedRate = await ctx.perpetual.fundingOracle.getBoundedFundingRate(
          targetRate,
          { from: admin },
        );
        expectBaseValueNotEqual(boundedRate, targetRate);

        // Error should be at most (15 seconds) / (15 minutes) = 1 / 60.
        const actualDiff = boundedRate.minus(initialRate.value);
        const ratio = actualDiff.value.div(quarterHourMaxDiff.value).toNumber();
        expect(ratio).to.be.lessThan(1); // sanity check
        expect(ratio).to.be.gte(59 / 60 - 0.0000000001); // Allow tolerance for rounding error.
      });

      it('cannot decrease faster than the per second limit', async () => {
        const quarterHour = 60 * 15;
        const quarterHourMaxDiff = maxDiffPerSecond.times(quarterHour);
        const initialRate = new FundingRate('0.123');
        const targetRate = initialRate.minus(quarterHourMaxDiff.value);

        // Update the funding rate timestamp so we can more accurately estimate the
        // time elapsed between updates.
        await setFundingRate(initialRate);

        // Elapse less than a quarter hour. Assume this test case takes less than 15 seconds.
        await fastForward(quarterHour - 15);

        // Expect the bounded rate to be slightly greater than the requested rate.
        const boundedRate = await ctx.perpetual.fundingOracle.getBoundedFundingRate(
          targetRate,
          { from: admin },
        );
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
   * Set the funding rate and verify the emitted logs.
   */
  async function setFundingRate(
    fundingRate: FundingRate,
    expectedRate: FundingRate = fundingRate,
  ): Promise<void> {
    // Elapse enough time so that the speed limit does not take effect.
    await fastForward(INTEGERS.ONE_HOUR_IN_SECONDS.toNumber());

    // Verify the return value is as expected.
    const simulatedResult = await ctx.perpetual.fundingOracle.getBoundedFundingRate(
      fundingRate,
      { from: admin },
    );
    expectBaseValueEqual(simulatedResult, expectedRate, 'simulated result');

    // Set the funding rate.
    const txResult = await ctx.perpetual.fundingOracle.setFundingRate(fundingRate, { from: admin });

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
