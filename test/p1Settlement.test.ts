import BigNumber from 'bignumber.js';
import _ from 'lodash';

import { INTEGERS } from '../src/lib/Constants';
import { BaseValue, Index, Price, TxResult, address } from '../src/lib/types';
import { mineAvgBlock } from './helpers/EVM';
import { expect, expectBN, expectBaseValueEqual } from './helpers/Expect';
import initializePerpetual from './helpers/initializePerpetual';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { buy, sell } from './helpers/trade';
import { expectBalances, mintAndDeposit, expectMarginBalances, expectContractSurplus } from './helpers/balances';

const marginAmount = new BigNumber(1000);
const positionSize = new BigNumber(12);

let long: address;
let short: address;
let otherAccountA: address;
let otherAccountB: address;
let otherAccountC: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializePerpetual(ctx);
  long = ctx.accounts[2];
  short = ctx.accounts[3];
  otherAccountA = ctx.accounts[4];
  otherAccountB = ctx.accounts[5];
  otherAccountC = ctx.accounts[6];

  // Set up initial balances:
  // +---------+--------+----------+
  // | account | margin | position |
  // |---------+--------+----------+
  // | long    |      0 |       12 |
  // | short   |   2000 |      -12 |
  // +---------+--------+----------+
  await Promise.all([
    ctx.perpetual.testing.oracle.setPrice(new Price(100)),
    mintAndDeposit(ctx, long, marginAmount),
    mintAndDeposit(ctx, short, marginAmount),
  ]);
  const txResult = await buy(ctx, long, short, positionSize, marginAmount);

  // Sanity check balances.
  await expectBalances(
    ctx,
    txResult,
    [long, short],
    [0, 2000],
    [12, -12],
  );
}

perpetualDescribe('P1Settlement', init, (ctx: ITestContext) => {

  describe('_loadContext()', () => {
    it('Updates the global index for a positive funding rate', async () => {
      await ctx.perpetual.testing.funder.setFunding(new BaseValue('0.005'));
      let txResult = await triggerIndexUpdate(otherAccountA);
      await expectIndexUpdated(txResult, new BaseValue('0.5'));
      txResult = await triggerIndexUpdate(otherAccountA);
      await expectIndexUpdated(txResult, new BaseValue('1.0'));
    });

    it('Updates the global index for a negative funding rate', async () => {
      await ctx.perpetual.testing.funder.setFunding(new BaseValue('-0.005'));
      let txResult = await triggerIndexUpdate(otherAccountA);
      await expectIndexUpdated(txResult, new BaseValue('-0.5'));
      txResult = await triggerIndexUpdate(otherAccountA);
      await expectIndexUpdated(txResult, new BaseValue('-1.0'));
    });

    it('Updates the global index over time with a variable funding rate and price', async () => {
      await ctx.perpetual.testing.funder.setFunding(new BaseValue('0.000001'));
      let txResult = await triggerIndexUpdate(otherAccountA);
      await expectIndexUpdated(txResult, new BaseValue('0.0001'));

      await ctx.perpetual.testing.funder.setFunding(new BaseValue('4'));
      txResult = await triggerIndexUpdate(otherAccountA);
      await expectIndexUpdated(txResult, new BaseValue('400.0001'));

      await ctx.perpetual.testing.oracle.setPrice(new Price('40'));
      txResult = await triggerIndexUpdate(otherAccountA);
      await expectIndexUpdated(txResult, new BaseValue('560.0001'));

      await ctx.perpetual.testing.funder.setFunding(new BaseValue('-10.5'));
      txResult = await triggerIndexUpdate(otherAccountA);
      await expectIndexUpdated(txResult, new BaseValue('140.0001'));

      await ctx.perpetual.testing.oracle.setPrice(new Price('0.00001'));
      txResult = await triggerIndexUpdate(otherAccountA);
      await expectIndexUpdated(txResult, new BaseValue('139.999995'));
    });

    it('Maintains solvency despite rounding errors in interest calculation', async () => {
      // Set up balances:
      // +---------------+--------+----------+
      // | account       | margin | position |
      // |---------------+--------+----------+
      // | otherAccountA |     10 |        7 |
      // | otherAccountB |     10 |       -3 |
      // | otherAccountC |     10 |       -4 |
      // +---------------+--------+----------+
      await Promise.all([
        ctx.perpetual.testing.oracle.setPrice(new Price(1)),
        mintAndDeposit(ctx, otherAccountA, 10),
        mintAndDeposit(ctx, otherAccountB, 10),
        mintAndDeposit(ctx, otherAccountC, 10),
      ]);
      await buy(ctx, otherAccountA, otherAccountB, 3, 0);
      let txResult = await buy(ctx, otherAccountA, otherAccountC, 4, 0);

      // Check balances.
      await expectBalances(
        ctx,
        txResult,
        [otherAccountA, otherAccountB, otherAccountC],
        [10, 10, 10],
        [7, -3, -4],
        false,
      );

      // Time period 1, global index is 0.7
      //
      // Settle account A, paying 5 margin in interest. New balances:
      // +---------------+--------+----------+-------------+--------------+
      // | account       | margin | position | local index | interest due |
      // |---------------+--------+----------+-------------+--------------+
      // | otherAccountA |      5 |        7 |         0.7 |            0 |
      // | otherAccountB |     10 |       -3 |           0 |          2.1 |
      // | otherAccountC |     10 |       -4 |           0 |          2.8 |
      // +---------------+--------+----------+-------------+--------------+
      await ctx.perpetual.testing.funder.setFunding(new BaseValue('0.7'));
      txResult = await triggerIndexUpdate(otherAccountA);
      await expectMarginBalances(ctx, txResult, [otherAccountA], [5], false);

      // Time period 1, global index is 1.4
      //
      // Settle all accounts. New balances:
      // +---------------+--------+----------+-------------+--------------+
      // | account       | margin | position | local index | interest due |
      // |---------------+--------+----------+-------------+--------------+
      // | otherAccountA |      0 |        7 |         1.4 |            0 |
      // | otherAccountB |     14 |       -3 |         1.4 |            0 |
      // | otherAccountC |     15 |       -4 |         1.4 |            0 |
      // +---------------+--------+----------+-------------+--------------+
      await triggerIndexUpdate(otherAccountA);
      await ctx.perpetual.testing.funder.setFunding(new BaseValue(0));
      await triggerIndexUpdate(otherAccountB);
      txResult = await triggerIndexUpdate(otherAccountC);

      // Check balances.
      await expectBalances(
        ctx,
        txResult,
        [otherAccountA, otherAccountB, otherAccountC],
        [0, 14, 15],
        [7, -3, -4],
        false,
      );
      await expectContractSurplus(
        ctx,
        [long, short, otherAccountA, otherAccountB, otherAccountC],
        1,
      );
    });
  });

  describe('_settleAccount()', () => {
    it('Settles interest accumulated on an account', async () => {
      // Sequence of operations:
      // +---------------+-------------+-----------+--------------+------------+
      // | operation     | long margin | long pos. | short margin | short pos. |
      // |---------------+-------------+-----------+--------------+------------|
      // | deposit       |        1000 |         0 |         1000 |          0 |
      // | trade         |           0 |        12 |         2000 |        -12 |
      // | settle(long)  |         -50 |        12 |         2000 |        -12 |
      // | settle(short) |           0 |        12 |         2050 |        -12 |
      // +---------------+-------------+-----------+--------------+------------+

      // Accumulate interest and settle the long account.
      await ctx.perpetual.testing.funder.setFunding(new BaseValue('0.05'));
      let txResult = await triggerIndexUpdate(long);
      await ctx.perpetual.testing.funder.setFunding(new BaseValue('0'));

      // Check account settlement log.
      const expectedInterest = new BigNumber('60'); // 0.05 * 100 * 12
      expectAccountSettledLog(txResult, long, expectedInterest.negated());

      // Check balances after settlement of the long. Note that the short is not yet settled.
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [expectedInterest.negated(), marginAmount.times(2)],
        [positionSize, positionSize.negated()],
        false, // fullSettled
        true, // positionsSumToZero
      );

      // Settle the short account and check account settlement log.
      txResult = await triggerIndexUpdate(short);
      expectAccountSettledLog(txResult, short, expectedInterest);

      // Check balances after settlement of the short account.
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [expectedInterest.negated(), marginAmount.times(2).plus(expectedInterest)],
        [positionSize, positionSize.negated()],
      );
    });

    it('Can settle accounts with a different frequency for each account', async () => {
      // Accumulate interest and settle the long account.
      await ctx.perpetual.testing.funder.setFunding(new BaseValue('0.05'));
      let txResult: TxResult;
      for (let i = 0; i < 9; i += 1) {
        txResult = await triggerIndexUpdate(long);
      }
      await ctx.perpetual.testing.funder.setFunding(new BaseValue('0'));

      const expectedInterest = new BigNumber('540'); // 0.05 * 100 * 12 * 9

      // Check balances after settlement of the long. Note that the short is not yet settled.
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [expectedInterest.negated(), marginAmount.times(2)],
        [positionSize, positionSize.negated()],
        false, // fullSettled
        true, // positionsSumToZero
      );

      // Settle the short account and check account settlement log.
      txResult = await triggerIndexUpdate(short);
      expectAccountSettledLog(txResult, short, expectedInterest);

      // Check balances after settlement of the short account.
      await expectBalances(
        ctx,
        txResult,
        [long, short],
        [expectedInterest.negated(), marginAmount.times(2).plus(expectedInterest)],
        [positionSize, positionSize.negated()],
      );
    });

    it('Does not settle an account if its local index is up-to-date', async () => {
      await ctx.perpetual.testing.funder.setFunding(new BaseValue('0.05'));

      // Wait until we get two deposits with the same timestamp.
      let result1: TxResult;
      let result2: TxResult;
      let block1: any;
      let block2: any;
      let numTries = 0;
      do {
        result1 = await ctx.perpetual.margin.deposit(long, new BigNumber(0));
        result2 = await ctx.perpetual.margin.deposit(long, new BigNumber(0));
        [block1, block2] = await Promise.all([
          ctx.perpetual.web3.eth.getBlock(result1.blockNumber),
          ctx.perpetual.web3.eth.getBlock(result2.blockNumber),
        ]);
        numTries += 1;
      }
      while (block1.timestamp !== block2.timestamp && numTries < 10);

      // Expect the second deposit not to trigger settlement of the account.
      const logs = ctx.perpetual.logs.parseLogs(result2);
      const filteredLogs = _.filter(logs, { name: 'LogAccountSettled' });
      expect(filteredLogs.length, 'filter for LogAccountSettled').to.equal(0);
    });

    it('Does not settle an account with no position', async () => {
      // Accumulate interest on long and short accounts.
      const localIndexBefore = await ctx.perpetual.getters.getAccountIndex(otherAccountA);
      await ctx.perpetual.testing.funder.setFunding(new BaseValue('0.05'));
      const txResult = await triggerIndexUpdate(otherAccountA);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      const filteredLogs = _.filter(logs, { name: 'LogAccountSettled' });
      expect(filteredLogs.length, 'filter for LogAccountSettled').to.equal(0);

      // Check balance.
      const { margin, position } = await ctx.perpetual.getters.getAccountBalance(otherAccountA);
      expectBN(margin).to.eq(INTEGERS.ZERO);
      expectBN(position).to.eq(INTEGERS.ZERO);

      // Check local index.
      const localIndexAfter = await ctx.perpetual.getters.getAccountIndex(otherAccountA);
      expectBN(localIndexAfter.baseValue.value).to.not.eq(localIndexBefore.baseValue.value);
      expectBN(localIndexAfter.timestamp).to.not.eq(localIndexBefore.timestamp);
    });
  });

  describe('_isCollateralized()', () => {
    const largeValue = new BigNumber(2).pow(120).minus(1);

    it('can handle large values', async () => {
      await mintAndDeposit(ctx, otherAccountA, largeValue);
      await mineAvgBlock();
      await buy(ctx, otherAccountA, long, 1, 100);
      await mineAvgBlock();
      await sell(ctx, otherAccountA, long, 1, 100);
      await mineAvgBlock();
      await ctx.perpetual.margin.withdraw(
        otherAccountA,
        otherAccountA,
        largeValue,
        { from: otherAccountA },
      );
    });
  });

  // ============ Helper Functions ============

  /**
   * Triggers an index update and settles an account by making a deposit of zero.
   */
  async function triggerIndexUpdate(account: address): Promise<TxResult> {
    await mineAvgBlock();
    return ctx.perpetual.margin.deposit(account, new BigNumber(0), { from: account });
  }

  /**
   * Check the global index value emitted by the log and returned by the getter.
   */
  async function expectIndexUpdated(
    txResult: TxResult,
    expectedBaseValue: BaseValue,
  ): Promise<void> {
    // Construct expected Index.
    const { timestamp } = await ctx.perpetual.web3.eth.getBlock(txResult.blockNumber);
    const expectedIndex: Index = {
      timestamp: new BigNumber(timestamp),
      baseValue: expectedBaseValue,
    };

    // Check the getter function.
    const globalIndex = await ctx.perpetual.getters.getGlobalIndex();
    expectBaseValueEqual(globalIndex.baseValue, expectedIndex.baseValue, 'index value from getter');
    expectBN(globalIndex.timestamp, 'index timestamp from logs').to.eq(expectedIndex.timestamp);

    // Check the logs.
    const logs = ctx.perpetual.logs.parseLogs(txResult);
    const filteredLogs = _.filter(logs, { name: 'LogIndex' });
    expect(filteredLogs.length, 'filter for LogIndex').to.equal(1);
    const loggedIndex: Index = filteredLogs[0].args.index;
    expectBaseValueEqual(loggedIndex.baseValue, expectedIndex.baseValue, 'index value from logs');
    expectBN(loggedIndex.timestamp, 'index timestamp from logs').to.eq(expectedIndex.timestamp);
  }

  function expectAccountSettledLog(
    txResult: TxResult,
    account: address,
    expectedInterest: BigNumber,
  ): void {
    const logs = ctx.perpetual.logs.parseLogs(txResult);
    const filteredLogs = _.filter(logs, { name: 'LogAccountSettled' });
    expect(filteredLogs.length, 'filter for LogAccountSettled').to.equal(1);
    const accountSettledLog = filteredLogs[0];

    expect(accountSettledLog.args.account, 'the settled account address').to.equal(account);
    let actualInterest = accountSettledLog.args.amount;
    expect(typeof accountSettledLog.args.isPositive).to.equal('boolean');
    if (!accountSettledLog.args.isPositive) {
      actualInterest = actualInterest.negated();
    }
    expectBN(actualInterest, 'interest applied in account settlement').to.eq(expectedInterest);
  }
});
