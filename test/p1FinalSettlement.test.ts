import BigNumber from 'bignumber.js';
import _ from 'lodash';

import { address } from '../src';
import { INTEGERS } from '../src/lib/Constants';
import {
  Price,
  TxResult,
  BigNumberable,
} from '../src/lib/types';
import { expectThrow, expect, expectAddressesEqual, expectBN } from './helpers/Expect';
import { expectBalances, mintAndDeposit } from './helpers/balances';
import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { buy } from './helpers/trade';

// Note: initialPrice * positionSize = initialMargin * 2
const initialMargin = new BigNumber(500);
const positionSize = new BigNumber(10);
const initialPrice = new Price(100);

const longUndercollateralizedPrice = new Price(54.9);
const longUnderwaterPrice = new Price(49.9);
const shortUndercollateralizedPrice = new Price(136.5);
const shortUnderwaterPrice = new Price(150.1);

let admin: address;
let long: address;
let short: address;
let otherAccount: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializeWithTestContracts(ctx);
  admin = ctx.accounts[0];
  long = ctx.accounts[2];
  short = ctx.accounts[3];
  otherAccount = ctx.accounts[4];

  // Set up initial balances:
  // +---------+--------+----------+-------------------+
  // | account | margin | position | collateralization |
  // |---------+--------+----------+-------------------|
  // | long    |   -500 |       10 |              200% |
  // | short   |   1500 |      -10 |              150% |
  // +---------+--------+----------+-------------------+
  await Promise.all([
    ctx.perpetual.testing.oracle.setPrice(initialPrice),
    mintAndDeposit(ctx, long, initialMargin),
    mintAndDeposit(ctx, short, initialMargin),
  ]);
  await buy(ctx, long, short, positionSize, initialMargin.times(2));

  // Sanity check balances.
  await expectBalances(
    ctx,
    [long, short],
    [-500, 1500],
    [10, -10],
  );
}

perpetualDescribe('P1FinalSettlement', init, (ctx: ITestContext) => {

  describe('noFinalSettlement', () => {

    beforeEach(async () => {
      await ctx.perpetual.admin.enableFinalSettlement(initialPrice, { from: admin });
      await ctx.perpetual.contracts.resetGasUsed();
    });

    it('prevents deposits during final settlement', async () => {
      await expectThrow(
        ctx.perpetual.margin.deposit(long, INTEGERS.ONE),
        'Not permitted during final settlement',
      );
    });

    it('prevents withdrawals during final settlement', async () => {
      await expectThrow(
        ctx.perpetual.margin.withdraw(long, INTEGERS.ONE),
        'Not permitted during final settlement',
      );
    });

    it('prevents trades during final settlement', async () => {
      await expectThrow(
        buy(ctx, long, short, INTEGERS.ONE, INTEGERS.ONE),
        'Not permitted during final settlement',
      );
    });
  });

  describe('onlyFinalSettlement', () => {

    it('prevents calls if final settlement is not enabled', async () => {
      await expectThrow(
        ctx.perpetual.finalSettlement.withdrawFinalSettlement({ from: long }),
        'Only permitted during final settlement',
      );
    });
  });

  describe('withdrawFinalSettlement()', () => {

    /**
     * Handle withdrawals for simple cases where _/_ notation represents margin/position.
     */
    describe('simple cases', () => {
      it('settles a 0/0 balance', async () => {
        await enableSettlement(initialPrice);
        await expectWithdraw(otherAccount, INTEGERS.ZERO);
      });

      it('settles a 0/+ balance', async () => {
        await buy(ctx, otherAccount, long, INTEGERS.ONE, INTEGERS.ZERO);
        await enableSettlement(initialPrice);
        await expectWithdraw(otherAccount, initialPrice.value);
      });

      it('settles a -/+ well-collateralized balance', async () => {
        await enableSettlement(initialPrice);
        await expectWithdraw(long, initialMargin);
      });

      it('settles a -/+ undercollateralized balance', async () => {
        await enableSettlement(longUndercollateralizedPrice);
        await expectWithdraw(long, '49');
      });

      it('settles a -/+ underwater balance', async () => {
        await enableSettlement(longUnderwaterPrice);
        await expectWithdraw(long, INTEGERS.ZERO);
      });

      it('settles a +/0 balance', async () => {
        await mintAndDeposit(ctx, otherAccount, INTEGERS.ONE);
        await enableSettlement(initialPrice);
        await expectWithdraw(otherAccount, INTEGERS.ONE);
      });

      it('settles a +/- well-collateralized balance', async () => {
        await enableSettlement(initialPrice);
        await expectWithdraw(short, initialMargin);
      });

      it('settles a +/- undercollateralized balance', async () => {
        await enableSettlement(shortUndercollateralizedPrice);
        await expectWithdraw(short, '135');
      });

      it('settles a +/- underwater balance', async () => {
        await enableSettlement(shortUnderwaterPrice);
        await expectWithdraw(short, INTEGERS.ZERO);
      });

      it('settles a +/+ balance', async () => {
        await mintAndDeposit(ctx, long, initialMargin.times(2));
        await enableSettlement(initialPrice);
        await expectWithdraw(long, initialMargin.times(3));
      });
    });

    /**
     * Edge cases and other non-standard situations.
     */
    describe('other cases', () => {

      it('does not allow withdrawing a non-zero balance more than once (long)', async () => {
        await enableSettlement(initialPrice);
        await expectWithdraw(long, initialMargin);
        await expectWithdraw(long, INTEGERS.ZERO);
        await expectWithdraw(long, INTEGERS.ZERO);
      });

      it('in absence of underwater accounts, remains solvent despite rounding errors', async () => {

      });
    });
  });

  /**
   * Enable final settlement at a certain price.
   */
  async function enableSettlement(settlementPrice: Price): Promise<TxResult> {
    await ctx.perpetual.testing.oracle.setPrice(settlementPrice);
    return ctx.perpetual.admin.enableFinalSettlement(settlementPrice, { from: admin });
  }

  /**
   * Withdraw final settlement and check that withdrawn amount is as expected.
   */
  async function expectWithdraw(account: address, expectedAmount: BigNumberable): Promise<void> {
    const expectedAmountBN = new BigNumber(expectedAmount);
    const balanceBefore = await ctx.perpetual.testing.token.getBalance(account);
    const txResult = await ctx.perpetual.finalSettlement.withdrawFinalSettlement({ from: account });

    // Check logs.
    const logs = ctx.perpetual.logs.parseLogs(txResult);
    expect(logs.length).to.equal(1);
    const log = logs[0];
    expect(log.name).to.equal('LogWithdrawFinalSettlement');
    expectAddressesEqual(log.args.account, account);
    expectBN(log.args.amount, 'logged final settlement amount').to.equal(expectedAmountBN);

    // Check that token balance is updated as expected.
    const balanceAfter = await ctx.perpetual.testing.token.getBalance(account);
    const balanceDiff = balanceAfter.minus(balanceBefore);
    expectBN(balanceDiff, 'change in token balance').to.equal(expectedAmountBN);
  }
});
