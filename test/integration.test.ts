import BigNumber from 'bignumber.js';

import { mintAndDeposit } from './helpers/balances';
import initializePerpetual from './helpers/initializePerpetual';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { buy } from './helpers/trade';
import {
  FundingRate,
  Price,
  address,
} from '../src/lib/types';
import { fastForward } from './helpers/EVM';
import { INTEGERS } from '../src/lib/Constants';
import { expectBN } from './helpers/Expect';

// Percentage error tolerance when comparing effective daily rate to nominal daily rate.
// The only source of error should be small variations in transaction timing.
const FUNDING_ERROR_BOUND = 0.0002;

const initialPrice = new Price('118.75');
const positionSize = new BigNumber('10.25e18');

const longInitialMargin = new BigNumber('-200.5e18');
const shortInitialMargin = new BigNumber('3200.5e18');

let admin: address;
let long: address;
let short: address;
let neutral: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializePerpetual(ctx, { funder: ctx.perpetual.fundingOracle.address });

  admin = ctx.accounts[0];
  long = ctx.accounts[1];
  short = ctx.accounts[2];
  neutral = ctx.accounts[3];

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

  // Trade at a price of 117.12.
  await buy(ctx, long, short, positionSize, '1200.5e18');
}

perpetualDescribe('Integration testing', init, (ctx: ITestContext) => {

  it('applies the funding rate without compounding', async () => {
    // Note: Funding interest does not compound, as the interest affects margin balances but
    // is calculated based on position balances. This means we do not expected interest paid
    // to depend upon the frequency of updates to the index.

    // Update global index before setting the funding rate, to minimize final error.
    await ctx.perpetual.margin.deposit(admin, 0);

    // Suppose the perpetual market is initially trading above the oracle price.
    // Then the funding rate is likely to be positive, indicating that longs pay shorts.
    // Use a “real world” example of a +0.5% daily funding rate.
    await ctx.perpetual.fundingOracle.setFundingRate(
      FundingRate.fromDailyRate('0.005'),
      { from: admin },
    );

    // Allow a day to elapse. Suppose that the contract is interacted with once an hour.
    for (let i = 0; i < 24; i += 1) {
      await fastForward(INTEGERS.ONE_HOUR_IN_SECONDS.toNumber());
      await ctx.perpetual.margin.deposit(admin, 0);
    }

    // Settle the long and short accounts and calculate the effective daily rate.
    await buy(ctx, long, short, 0, 0);
    const longDailyRate = await getEffectiveDailyRate(long, longInitialMargin);
    const shortDailyRate = await getEffectiveDailyRate(short, shortInitialMargin);

    // Check that the effective daily rate is approximately equal to the nominal daily rate.
    // The only source of error should be small variations in transaction timing.
    expectBN(longDailyRate.minus('-0.005').abs().div('0.005'), 'long error')
      .to.be.lessThan(FUNDING_ERROR_BOUND);
    expectBN(shortDailyRate.minus('0.005').abs().div('0.005'), 'short error')
      .to.be.lessThan(FUNDING_ERROR_BOUND);

    // Repeat the experiment with a different funding rate and less frequent index updates.
    // Since the funding rate does not compound, we do not expect the outcome to depend on
    // the frequency of updates to the index.

    // Update global index before setting the funding rate, to minimize final error.
    const longNewMargin = (await ctx.perpetual.getters.getAccountBalance(long)).margin;
    const shortNewMargin = (await ctx.perpetual.getters.getAccountBalance(short)).margin;
    await ctx.perpetual.margin.deposit(admin, 0);

    // Use a “boundary case” example of a -2% daily funding rate.
    await ctx.perpetual.fundingOracle.setFundingRate(
      FundingRate.fromDailyRate('-0.02'),
      { from: admin },
    );

    // Allow a day to elapse with no intervening updates to the index.
    await fastForward(INTEGERS.ONE_DAY_IN_SECONDS.toNumber());

    // Settle the long and short accounts and calculate the effective daily rate.
    await buy(ctx, long, short, 0, 0);
    const longDailyRate2 = await getEffectiveDailyRate(long, longNewMargin);
    const shortDailyRate2 = await getEffectiveDailyRate(short, shortNewMargin);

    // Check that the effective daily rate is approximately equal to the nominal daily rate.
    // The only source of error should be small variations in transaction timing.
    expectBN(longDailyRate2.minus('0.02').abs().div('0.02'), 'long error')
      .to.be.lessThan(FUNDING_ERROR_BOUND);
    expectBN(shortDailyRate2.minus('-0.02').abs().div('0.02'), 'short error')
      .to.be.lessThan(FUNDING_ERROR_BOUND);
  });

  /**
   * Get effective daily rate, assuming the initial position size and price.
   */
  async function getEffectiveDailyRate(
    account: address,
    initialMargin: BigNumber,
  ): Promise<BigNumber> {
    const balance = await ctx.perpetual.getters.getAccountBalance(account);
    const interestPaid = balance.margin.minus(initialMargin);
    const positionValue = positionSize.times(initialPrice.value);
    return interestPaid.div(positionValue);
  }
});
