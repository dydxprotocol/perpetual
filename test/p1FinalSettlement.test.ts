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
let otherAccountA: address;
let otherAccountB: address;
let otherAccountC: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializeWithTestContracts(ctx);
  admin = ctx.accounts[0];
  long = ctx.accounts[2];
  short = ctx.accounts[3];
  otherAccountA = ctx.accounts[4];
  otherAccountB = ctx.accounts[5];
  otherAccountC = ctx.accounts[6];

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
      await ctx.perpetual.admin.enableFinalSettlement(initialPrice, initialPrice, { from: admin });
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
        ctx.perpetual.margin.withdraw(long, long, INTEGERS.ONE),
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
        await expectWithdraw(otherAccountA, INTEGERS.ZERO);
      });

      it('settles a 0/+ balance', async () => {
        await buy(ctx, otherAccountA, long, INTEGERS.ONE, INTEGERS.ZERO);
        await enableSettlement(initialPrice);
        await expectWithdraw(otherAccountA, initialPrice.value);
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
        await mintAndDeposit(ctx, otherAccountA, INTEGERS.ONE);
        await enableSettlement(initialPrice);
        await expectWithdraw(otherAccountA, INTEGERS.ONE);
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

      it('does not allow withdrawing a non-zero balance more than once (short)', async () => {
        await enableSettlement(initialPrice);
        await expectWithdraw(short, initialMargin);
        await expectWithdraw(short, INTEGERS.ZERO);
        await expectWithdraw(short, INTEGERS.ZERO);
      });

      it('avoids insolvency resulting from rounding errors', async () => {
        // Set up balances:
        // +---------------+--------+----------+
        // | account       | margin | position |
        // |---------------+--------+----------+
        // | otherAccountA |      2 |       -1 |
        // | otherAccountB |      2 |       -1 |
        // | otherAccountC |     -1 |        2 |
        // +---------------+--------+----------+
        await Promise.all([
          ctx.perpetual.testing.oracle.setPrice(new Price(1)),
          mintAndDeposit(ctx, otherAccountA, 2),
          mintAndDeposit(ctx, otherAccountB, 1),
        ]);
        await buy(ctx, otherAccountC, otherAccountA, 1, 0);
        await buy(ctx, otherAccountC, otherAccountB, 1, 1);

        // Check balances.
        await expectBalances(
          ctx,
          [otherAccountA, otherAccountB, otherAccountC],
          [2, 2, -1],
          [-1, -1, 2],
          false,
        );

        await enableSettlement(new Price(1.5));
        await expectWithdraw(otherAccountA, 0);
        await expectWithdraw(otherAccountB, 0);
        await expectWithdraw(otherAccountC, 2);
      });

      describe('when the contract is insolvent due to underwater accounts', async () => {

        beforeEach(async () => {
          // Set up initial balances (settlement price of 40):
          // +---------------+--------+----------+-------------------+---------------+
          // | account       | margin | position | collateralization | account value |
          // |---------------+--------+----------+-------------------|---------------|
          // | long          |  -2500 |       30 |               48% |         -1300 |
          // | short         |   1500 |      -10 |              375% |          1100 |
          // | otherAccountA |   1500 |      -10 |              375% |          1100 |
          // | otherAccountB |   1500 |      -10 |              375% |          1100 |
          // +---------------+--------+----------+-------------------+---------------+
          //
          // Both otherAccountA and otherAccountB are short positions.
          await Promise.all([
            mintAndDeposit(ctx, otherAccountA, initialMargin),
            mintAndDeposit(ctx, otherAccountB, initialMargin),
          ]);
          await Promise.all([
            await buy(ctx, long, otherAccountA, positionSize, initialMargin.times(2)),
            await buy(ctx, long, otherAccountB, positionSize, initialMargin.times(2)),
          ]);
          await ctx.perpetual.contracts.resetGasUsed();
        });

        it('will return partial balances, as long as funds remain', async () => {
          // Enable settlement at price where long is underwater.
          await enableSettlement(new Price(40));

          // Some short positions can withdraw funds.
          await expectWithdraw(long, 0);
          await expectWithdraw(short, 1100);
          await expectWithdraw(otherAccountA, 900);
          await expectWithdraw(otherAccountB, 0);

          // Check that the balances reflect the amount owed.
          await expectBalances(
            ctx,
            [long, short, otherAccountA, otherAccountB],
            [0, 0, 200, 1100],
            [0, 0, 0, 0],

            // During final settlement, margin balances may not match contract token balance.
            false,
          );
        });

        it('can be bailed out, allowing all balances to be withdrawn', async () => {
          await enableSettlement(new Price(40));

          // Some short positions can withdraw funds.
          await expectWithdraw(long, 0);
          await expectWithdraw(short, 1100);
          await expectWithdraw(otherAccountA, 900);
          await expectWithdraw(otherAccountB, 0);

          // Admin bails out the contract.
          const underwaterAmount = new BigNumber(1300);
          await ctx.perpetual.testing.token.mint(admin, underwaterAmount);
          await ctx.perpetual.testing.token.transfer(
            admin,
            ctx.perpetual.contracts.perpetualProxy.options.address,
            underwaterAmount,
          );

          // Short positions can withdraw the rest of their account value.
          await expectWithdraw(long, 0);
          await expectWithdraw(short, 0);
          await expectWithdraw(otherAccountA, 200);
          await expectWithdraw(otherAccountB, 1100);

          // Check balances.
          await expectBalances(
            ctx,
            [long, short, otherAccountA, otherAccountB],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
          );
        });

        it('allows negative margin account to withdraw partial balances', async () => {
          // Enable settlement at price where shorts are underwater.
          //
          // Account value:
          // - long:        2300
          // - each short:  -100
          await enableSettlement(new Price(160));

          // Long position can partially withdraw.
          await expectWithdraw(long, 2000);

          // Admin bails out the contract.
          const underwaterAmount = new BigNumber(300);
          await ctx.perpetual.testing.token.mint(admin, underwaterAmount);
          await ctx.perpetual.testing.token.transfer(
            admin,
            ctx.perpetual.contracts.perpetualProxy.options.address,
            underwaterAmount,
          );

          // Long position can withdraw the rest of their account value.
          await expectWithdraw(short, 0);
          await expectWithdraw(long, 300);
          await expectWithdraw(long, 0);

          // Check balances.
          await expectBalances(
            ctx,
            [long, short, otherAccountA, otherAccountB],
            [0, 0, 1500, 1500],
            [0, 0, -10, -10],
            false,
            false,
          );
        });
      });
    });
  });

  /**
   * Enable final settlement at a certain price.
   */
  async function enableSettlement(settlementPrice: Price): Promise<TxResult> {
    await ctx.perpetual.testing.oracle.setPrice(settlementPrice);
    return ctx.perpetual.admin.enableFinalSettlement(
      settlementPrice,
      settlementPrice,
      { from: admin },
    );
  }

  /**
   * Withdraw final settlement and check that withdrawn amount is as expected.
   *
   * Checks that the account's balance on the token contract is updated as expected.
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
