import BigNumber from 'bignumber.js';
import _ from 'lodash';

import { INTEGERS } from '../src/lib/Constants';
import { BaseValue, Price, TxResult, address } from '../src/lib/types';
import { mineAvgBlock } from './helpers/EVM';
import { expect, expectBN, expectBaseValueEqual } from './helpers/Expect';
import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { buy } from './helpers/trade';
import { expectBalances, mintAndDeposit } from './helpers/balances';

const marginAmount = new BigNumber(1000);
const positionSize = new BigNumber(12);

let long;
let short;
let otherAccount;

async function init(ctx: ITestContext): Promise<void> {
  await initializeWithTestContracts(ctx);
  long = ctx.accounts[2];
  short = ctx.accounts[3];
  otherAccount = ctx.accounts[4];

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
  await buy(ctx, long, short, positionSize, marginAmount);

  // Sanity check balances.
  await expectBalances(
    ctx,
    [long, short],
    [INTEGERS.ZERO, marginAmount.times(2)],
    [positionSize, positionSize.negated()],
  );
}

perpetualDescribe('P1Settlement', init, (ctx: ITestContext) => {

  describe('_loadContext()', () => {
    it('Updates the global index for a positive funding rate', async () => {
      await ctx.perpetual.testing.funder.setFunding(new BaseValue('0.005'));
      let txResult = await triggerIndexUpdate(otherAccount);
      await expectIndexUpdated(txResult, new BaseValue('0.5'));
      txResult = await triggerIndexUpdate(otherAccount);
      await expectIndexUpdated(txResult, new BaseValue('1.0'));
    });

    it('Updates the global index for a positive funding rate', async () => {
      await ctx.perpetual.testing.funder.setFunding(new BaseValue('-0.005'));
      let txResult = await triggerIndexUpdate(otherAccount);
      await expectIndexUpdated(txResult, new BaseValue('-0.5'));
      txResult = await triggerIndexUpdate(otherAccount);
      await expectIndexUpdated(txResult, new BaseValue('-1.0'));
    });

    it('Updates the global index over time with a variable funding rate and price', async () => {
      await ctx.perpetual.testing.funder.setFunding(new BaseValue('0.000001'));
      let txResult = await triggerIndexUpdate(otherAccount);
      await expectIndexUpdated(txResult, new BaseValue('0.0001'));

      await ctx.perpetual.testing.funder.setFunding(new BaseValue('4'));
      txResult = await triggerIndexUpdate(otherAccount);
      await expectIndexUpdated(txResult, new BaseValue('400.0001'));

      await ctx.perpetual.testing.oracle.setPrice(new Price('40'));
      txResult = await triggerIndexUpdate(otherAccount);
      await expectIndexUpdated(txResult, new BaseValue('560.0001'));

      await ctx.perpetual.testing.funder.setFunding(new BaseValue('-10.5'));
      txResult = await triggerIndexUpdate(otherAccount);
      await expectIndexUpdated(txResult, new BaseValue('140.0001'));

      await ctx.perpetual.testing.oracle.setPrice(new Price('0.00001'));
      txResult = await triggerIndexUpdate(otherAccount);
      await expectIndexUpdated(txResult, new BaseValue('139.999995'));
    });

    it('Does not update the global index if the timestamp has not increased', async () => {
      await ctx.perpetual.testing.funder.setFunding(new BaseValue('0.05'));

      // Wait until we get two deposits with the same timestamp.
      let result1: TxResult;
      let result2: TxResult;
      let block1: any;
      let block2: any;
      let numTries = 0;
      do {
        // Since it's unknown whether the deposit will trigger an index update, we need to use
        // a high gas amount, in case the estimate is too low.
        result1 = await ctx.perpetual.margin.deposit(long, new BigNumber(0), { gas: 4000000 });
        result2 = await ctx.perpetual.margin.deposit(long, new BigNumber(0), { gas: 4000000 });
        [block1, block2] = await Promise.all([
          ctx.perpetual.web3.eth.getBlock(result1.blockNumber),
          ctx.perpetual.web3.eth.getBlock(result2.blockNumber),
        ]);
        numTries += 1;
      }
      while (block1.timestamp !== block2.timestamp && numTries < 10);

      // Expect the second deposit not to update the global index.
      const logs = ctx.perpetual.logs.parseLogs(result2);
      const filteredLogs = _.filter(logs, { name: 'LogIndexUpdated' });
      expect(filteredLogs.length, 'filter for LogIndexUpdated').to.equal(0);
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
        [long, short],
        [expectedInterest.negated(), marginAmount.times(2).plus(expectedInterest)],
        [positionSize, positionSize.negated()],
      );
    });

    it('Can settle accounts with a different frequency for each account', async () => {
      // Accumulate interest and settle the long account.
      await ctx.perpetual.testing.funder.setFunding(new BaseValue('0.05'));
      for (let i = 0; i < 9; i += 1) {
        await triggerIndexUpdate(long);
      }
      await ctx.perpetual.testing.funder.setFunding(new BaseValue('0'));

      const expectedInterest = new BigNumber('540'); // 0.05 * 100 * 12 * 9

      // Check balances after settlement of the long. Note that the short is not yet settled.
      await expectBalances(
        ctx,
        [long, short],
        [expectedInterest.negated(), marginAmount.times(2)],
        [positionSize, positionSize.negated()],
        false, // fullSettled
        true, // positionsSumToZero
      );

      // Settle the short account and check account settlement log.
      const txResult = await triggerIndexUpdate(short);
      expectAccountSettledLog(txResult, short, expectedInterest);

      // Check balances after settlement of the short account.
      await expectBalances(
        ctx,
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
        // Since it's unknown whether the deposit will trigger an index update, we need to use
        // a high gas amount, in case the estimate is too low.
        result1 = await ctx.perpetual.margin.deposit(long, new BigNumber(0), { gas: 4000000 });
        result2 = await ctx.perpetual.margin.deposit(long, new BigNumber(0), { gas: 4000000 });
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
      await ctx.perpetual.testing.funder.setFunding(new BaseValue('0.05'));
      const txResult = await triggerIndexUpdate(otherAccount);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      const filteredLogs = _.filter(logs, { name: 'LogAccountSettled' });
      expect(filteredLogs.length, 'filter for LogAccountSettled').to.equal(0);

      // Check balance.
      const { margin, position } = await ctx.perpetual.getters.getAccountBalance(otherAccount);
      expectBN(margin).to.eq(INTEGERS.ZERO);
      expectBN(position).to.eq(INTEGERS.ZERO);
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
    expectedIndex: BaseValue,
  ): Promise<void> {
    // Check the getter function.
    const globalIndex = await ctx.perpetual.getters.getGlobalIndex();
    expectBaseValueEqual(globalIndex.baseValue, expectedIndex, 'global index from getter');

    // Check the logs.
    const logs = ctx.perpetual.logs.parseLogs(txResult);
    const filteredLogs = _.filter(logs, { name: 'LogIndexUpdated' });
    expect(filteredLogs.length, 'filter for LogIndexUpdated').to.equal(1);
    const indexUpdatedLog = filteredLogs[0];

    const loggedIndexRaw = indexUpdatedLog.args.index;
    const loggedIndex = BaseValue.fromSolidity(loggedIndexRaw.value, loggedIndexRaw.isPositive);
    expectBaseValueEqual(loggedIndex, expectedIndex, 'global index from logs');
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
