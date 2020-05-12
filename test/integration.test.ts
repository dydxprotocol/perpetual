import BigNumber from 'bignumber.js';

import { mintAndDeposit } from './helpers/balances';
import initializePerpetual from './helpers/initializePerpetual';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { buy } from './helpers/trade';
import {
  FUNDING_RATE_MAX_ABS_VALUE,
  INTEGERS,
} from '../src/lib/Constants';
import {
  BigNumberable,
  FundingRate,
  Price,
  address,
} from '../src/lib/types';
import { fastForward } from './helpers/EVM';
import { expectBN, expectBaseValueEqual } from './helpers/Expect';

// Percentage error tolerance when comparing effective 8-hour rate to nominal 8-hour rate.
// The only source of error should be small variations in transaction timing.
const FUNDING_ERROR_TOLERANCE = 0.001;

const initialPrice = new Price('118.75');
const positionSize = new BigNumber('10.25e18');

const longInitialMargin = new BigNumber('-200.5e18');
const shortInitialMargin = new BigNumber('3200.5e18');

let admin: address;
let fundingRateProvider: address;
let long: address;
let short: address;
let neutral: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializePerpetual(ctx, { funder: ctx.perpetual.fundingOracle.address });

  admin = ctx.accounts[0];
  fundingRateProvider = ctx.accounts[1];
  long = ctx.accounts[2];
  short = ctx.accounts[3];
  neutral = ctx.accounts[4];

  // Set up initial balances:
  // +-----------+-----------+-----------+-------------------+
  // | account   | margin    | position  | collateralization |
  // |-----------+-----------+-----------+-------------------|
  // | long      | -200.5e18 |  10.25e18 |              607% |
  // | short     | 3200.5e18 | -10.25e18 |              263% |
  // | neutral   |   3000e18 |         0 |               inf |
  // +-----------+-----------+-----------+-------------------+
  await Promise.all([
    ctx.perpetual.testing.oracle.setPrice(initialPrice),
    mintAndDeposit(ctx, long, '1000e18'),
    mintAndDeposit(ctx, short, '2000e18'),
    mintAndDeposit(ctx, neutral, '3000e18'),
  ]);

  await ctx.perpetual.fundingOracle.setFundingRateProvider(
    fundingRateProvider,
    { from: admin },
  );
  // Trade at a price of 117.12.
  await buy(ctx, long, short, positionSize, '1200.5e18');
}

perpetualDescribe('Integration testing', init, (ctx: ITestContext) => {

  it('applies the funding rate without compounding', async () => {
    // Note: Funding interest does not compound, as the interest affects margin balances but
    // is calculated based on position balances. This means we do not expected interest paid
    // to depend upon the frequency of updates to the index.

    // Fast forward so that the speed limit on changes to funding rate does not take effect.
    await fastForward(INTEGERS.ONE_HOUR_IN_SECONDS.toNumber());

    // Update global index before setting the funding rate, to minimize final error.
    await ctx.perpetual.margin.deposit(admin, 0);

    // Suppose the perpetual market is initially trading above the oracle price.
    // Then the funding rate is likely to be positive, indicating that longs pay shorts.
    // Use a “real world” example of a +0.17% 8-hour funding rate.
    const targetRate1 = 0.0017;
    await setFundingRateAndCheckLogs(targetRate1);

    // Allow funding to accumulate for 24 hours.
    // Suppose that the contract is interacted with once an hour.
    for (let i = 0; i < 24; i += 1) {
      await fastForward(INTEGERS.ONE_HOUR_IN_SECONDS.toNumber());
      await ctx.perpetual.margin.deposit(admin, 0);
    }

    // Calculate the effective 8-hour rate.
    const [longDailyRate, shortDailyRate] = await Promise.all([
      getEffectiveEightHourRate(long, longInitialMargin),
      getEffectiveEightHourRate(short, shortInitialMargin),
    ]);

    // Check that the effective 8-hour rate is approximately equal to the nominal 8-hour rate.
    // The only source of error should be small variations in transaction timing.
    expectBN(
      longDailyRate.minus(targetRate1 * -1).abs().div(targetRate1),
      'long funding error',
    ).to.be.lessThan(FUNDING_ERROR_TOLERANCE);
    expectBN(
      shortDailyRate.minus(targetRate1).abs().div(targetRate1),
      'short funding error',
    ).to.be.lessThan(FUNDING_ERROR_TOLERANCE);

    // REPEAT THE EXPERIMENT with a different funding rate and less frequent index updates.
    //
    // Since the funding rate does not compound, we do not expect the outcome to depend on
    // the frequency of updates to the index.

    // Fast forward and update the rate in multiple steps so that the diff-per-update and
    // diff-per-second limits do not take effect.
    await ctx.perpetual.fundingOracle.setFundingRate(
      new FundingRate(0),
      { from: fundingRateProvider },
    );
    await fastForward(INTEGERS.ONE_HOUR_IN_SECONDS.toNumber());

    // Settle the accounts and get checkpoint balances.
    await buy(ctx, long, short, 0, 0);
    const longCheckpointMargin = (await ctx.perpetual.getters.getAccountBalance(long)).margin;
    const shortCheckpointMargin = (await ctx.perpetual.getters.getAccountBalance(short)).margin;

    // Test boundary case of the min rate.
    const targetRate2: BigNumber = FUNDING_RATE_MAX_ABS_VALUE.negated().value;
    await setFundingRateAndCheckLogs(targetRate2);

    // Allow a day to elapse with no intervening updates to the index.
    await fastForward(INTEGERS.ONE_DAY_IN_SECONDS.toNumber());

    // Calculate the effective 8-hour rate.
    const [longDailyRate2, shortDailyRate2] = await Promise.all([
      getEffectiveEightHourRate(long, longCheckpointMargin),
      getEffectiveEightHourRate(short, shortCheckpointMargin),
    ]);

    // Check that the effective 8-hour rate is approximately equal to the nominal 8-hour rate.
    // The only source of error should be small variations in transaction timing.
    expectBN(
      longDailyRate2.minus(targetRate2.negated()).abs().div(targetRate2.abs()),
      'long funding error',
    ).to.be.lessThan(FUNDING_ERROR_TOLERANCE);
    expectBN(
      shortDailyRate2.minus(targetRate2).abs().div(targetRate2.abs()),
      'short funding error',
    ).to.be.lessThan(FUNDING_ERROR_TOLERANCE);
  });

  /**
   * Get effective 8-hour rate, given initial margin and assuming initial position and price.
   *
   * Assumes that funding has accumulated for 24 hours.
   */
  async function getEffectiveEightHourRate(
    account: address,
    initialMargin: BigNumber,
  ): Promise<BigNumber> {
    // Settle the account.
    await ctx.perpetual.margin.deposit(account, 0);

    const balance = await ctx.perpetual.getters.getAccountBalance(account);
    const interestPaid = balance.margin.minus(initialMargin);
    const positionValue = positionSize.times(initialPrice.value);
    const dailyRate = interestPaid.div(positionValue);
    return dailyRate.div(3);
  }

  /**
   * Set the funding rate and verify the emitted logs.
   */
  async function setFundingRateAndCheckLogs(eightHourRate: BigNumberable): Promise<void> {
    const fundingRate = FundingRate.fromEightHourRate(eightHourRate);

    // Verify the return value is as expected.
    const simulatedResult = await ctx.perpetual.fundingOracle.getBoundedFundingRate(
      fundingRate,
      { from: fundingRateProvider },
    );
    expectBaseValueEqual(simulatedResult, fundingRate, 'simulated result');

    // Set the funding rate.
    const txResult = await ctx.perpetual.fundingOracle.setFundingRate(
      fundingRate,
      { from: fundingRateProvider },
    );

    // Check logs.
    const fundingRateUpdatedLog = ctx.perpetual.logs.parseLogs(txResult)[0];
    expectBaseValueEqual(
      fundingRateUpdatedLog.args.fundingRate.baseValue,
      fundingRate,
      'funding rate',
    );
  }
});
