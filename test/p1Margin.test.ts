import BigNumber from 'bignumber.js';

import { mineAvgBlock } from './helpers/EVM';
import { expect, expectBN, expectThrow } from './helpers/Expect';
import initializePerpetual from './helpers/initializePerpetual';
import { expectMarginBalances, expectTokenBalances, mintAndDeposit } from './helpers/balances';
import { ITestContext, perpetualDescribe } from './helpers/perpetualDescribe';
import { sell } from './helpers/trade';
import {
  address,
  Price,
} from '../src/lib/types';

let accountOwner: address;
let otherUser: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializePerpetual(ctx);
  accountOwner = ctx.accounts[2];
  otherUser = ctx.accounts[3];
}

perpetualDescribe('P1Margin', init, (ctx: ITestContext) => {

  describe('deposit()', () => {
    it('Account owner can deposit', async () => {
      // Set initial balances and allowances.
      const amount = new BigNumber(150);
      await ctx.perpetual.testing.token.mint(
        ctx.perpetual.contracts.testToken.options.address,
        accountOwner,
        amount,
      );
      await ctx.perpetual.testing.token.setMaximumPerpetualAllowance(
        ctx.perpetual.contracts.testToken.options.address,
        accountOwner,
      );

      // Execute deposit.
      const txResult = await ctx.perpetual.margin.deposit(
        accountOwner,
        amount,
        { from: accountOwner },
      );

      // Check balances.
      await Promise.all([
        expectMarginBalances(ctx, txResult, [accountOwner], [amount]),
        expectTokenBalances(ctx, [accountOwner], [0]),
      ]);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(2);
      const [indexUpdatedLog, depositLog] = logs;
      expect(indexUpdatedLog.name).to.equal('LogIndex');
      expect(depositLog.name).to.equal('LogDeposit');
      expect(depositLog.args.account).to.equal(accountOwner);
      expectBN(depositLog.args.amount).to.eq(amount);
    });

    it('Non-owner can deposit', async () => {
      // Set initial balances and allowances.
      const amount = new BigNumber(150);
      await ctx.perpetual.testing.token.mint(
        ctx.perpetual.contracts.testToken.options.address,
        otherUser,
        amount,
      );
      await ctx.perpetual.testing.token.setMaximumPerpetualAllowance(
        ctx.perpetual.contracts.testToken.options.address,
        otherUser,
      );

      // Execute deposit.
      const txResult = await ctx.perpetual.margin.deposit(
        accountOwner,
        amount,
        { from: otherUser },
      );

      // Check balances.
      await Promise.all([
        expectMarginBalances(ctx, txResult, [accountOwner], [amount]),
        expectTokenBalances(ctx, [otherUser], [0]),
      ]);
    });

    it('Can make multiple deposits', async () => {
      // Set initial balances and allowances.
      await ctx.perpetual.testing.token.mint(
        ctx.perpetual.contracts.testToken.options.address,
        accountOwner,
        new BigNumber(1000),
      );
      await ctx.perpetual.testing.token.mint(
        ctx.perpetual.contracts.testToken.options.address,
        otherUser,
        new BigNumber(1000),
      );
      await ctx.perpetual.testing.token.setMaximumPerpetualAllowance(
        ctx.perpetual.contracts.testToken.options.address,
        accountOwner,
      );
      await ctx.perpetual.testing.token.setMaximumPerpetualAllowance(
        ctx.perpetual.contracts.testToken.options.address,
        otherUser,
      );

      // Execute deposits.
      await ctx.perpetual.margin.deposit(accountOwner, new BigNumber(50), { from: accountOwner });
      await ctx.perpetual.margin.deposit(accountOwner, new BigNumber(150), { from: accountOwner });
      await ctx.perpetual.margin.deposit(accountOwner, new BigNumber(0), { from: accountOwner });
      const txResult =
        await ctx.perpetual.margin.deposit(accountOwner, new BigNumber(300), { from: otherUser });

      // Check balances.
      await Promise.all([
        expectMarginBalances(ctx, txResult, [accountOwner], [500]),
        expectTokenBalances(ctx, [accountOwner, otherUser], [800, 700]),
      ]);
    });

    it('Cannot deposit more than the sender\'s balance', async () => {
      // Set initial balances and allowances.
      const amount = new BigNumber(1000);
      await ctx.perpetual.testing.token.mint(
        ctx.perpetual.contracts.testToken.options.address,
        accountOwner,
        amount,
      );
      await ctx.perpetual.testing.token.setMaximumPerpetualAllowance(
        ctx.perpetual.contracts.testToken.options.address,
        otherUser,
      );

      await expectThrow(
        ctx.perpetual.margin.deposit(accountOwner, amount.plus(1), { from: accountOwner }),
        'SafeERC20: low-level call failed',
      );
    });
  });

  describe('withdraw()', () => {
    beforeEach(async () => {
      await mintAndDeposit(ctx, accountOwner, new BigNumber(150));
      await mineAvgBlock();
      ctx.perpetual.contracts.resetGasUsed();
    });

    it('Account owner can withdraw partial amount', async () => {
      const amount = new BigNumber(100);

      // Execute withdraw.
      const txResult = await ctx.perpetual.margin.withdraw(
        accountOwner,
        accountOwner,
        amount,
        { from: accountOwner },
      );

      // Check balances.
      await Promise.all([
        expectMarginBalances(ctx, txResult, [accountOwner], [50]),
        expectTokenBalances(ctx, [accountOwner], [100]),
      ]);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(2);
      const [indexUpdatedLog, withdrawLog] = logs;
      expect(indexUpdatedLog.name).to.equal('LogIndex');
      expect(withdrawLog.name).to.equal('LogWithdraw');
      expect(withdrawLog.args.account).to.equal(accountOwner);
      expect(withdrawLog.args.destination).to.eq(accountOwner);
      expectBN(withdrawLog.args.amount).to.eq(amount);
    });

    it('Account owner can withdraw full amount', async () => {
      const txResult = await ctx.perpetual.margin.withdraw(
        accountOwner,
        accountOwner,
        new BigNumber(150),
        { from: accountOwner },
      );

      // Check balances
      await Promise.all([
        expectMarginBalances(ctx, txResult, [accountOwner], [0]),
        expectTokenBalances(ctx, [accountOwner], [150]),
      ]);
    });

    it('Account owner can withdraw to a different address', async () => {
      const amount = new BigNumber(100);
      const txResult = await ctx.perpetual.margin.withdraw(
        accountOwner,
        otherUser,
        amount,
        { from: accountOwner },
      );

      // Check balances.
      await Promise.all([
        expectMarginBalances(ctx, txResult, [accountOwner], [50]),
        expectTokenBalances(ctx, [accountOwner, otherUser], [0, 100]),
      ]);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(2);
      const [indexUpdatedLog, withdrawLog] = logs;
      expect(indexUpdatedLog.name).to.equal('LogIndex');
      expect(withdrawLog.name).to.equal('LogWithdraw');
      expect(withdrawLog.args.account).to.equal(accountOwner);
      expect(withdrawLog.args.destination).to.eq(otherUser);
      expectBN(withdrawLog.args.amount).to.eq(amount);
    });

    it('Global operator can make withdrawals', async () => {
      await ctx.perpetual.admin.setGlobalOperator(otherUser, true, { from: ctx.accounts[0] });
      await ctx.perpetual.margin.withdraw(
        accountOwner,
        accountOwner,
        new BigNumber(50),
        { from: otherUser },
      );
      const txResult = await ctx.perpetual.margin.withdraw(
        accountOwner,
        otherUser,
        new BigNumber(100),
        { from: otherUser },
      );

      // Check balances.
      await Promise.all([
        expectMarginBalances(ctx, txResult, [accountOwner], [0]),
        expectTokenBalances(ctx, [accountOwner, otherUser], [50, 100]),
      ]);
    });

    it('Local operator can make withdrawals', async () => {
      await ctx.perpetual.operator.setLocalOperator(otherUser, true, { from: accountOwner });
      await ctx.perpetual.margin.withdraw(
        accountOwner,
        accountOwner,
        new BigNumber(100),
        { from: otherUser },
      );
      const txResult = await ctx.perpetual.margin.withdraw(
        accountOwner,
        otherUser,
        new BigNumber(50),
        { from: otherUser },
      );

      // Check balances.
      await Promise.all([
        expectMarginBalances(ctx, txResult, [accountOwner], [0]),
        expectTokenBalances(ctx, [accountOwner, otherUser], [100, 50]),
      ]);
    });

    it('Owner can make multiple withdrawals', async () => {
      // Two withdrawals
      await ctx.perpetual.margin.withdraw(
        accountOwner,
        accountOwner,
        new BigNumber(30),
        { from: accountOwner },
      );
      const txResult1 = await ctx.perpetual.margin.withdraw(
        accountOwner,
        accountOwner,
        new BigNumber(50),
        { from: accountOwner },
      );

      // Check balances.
      await Promise.all([
        expectMarginBalances(ctx, txResult1, [accountOwner], [70]),
        expectTokenBalances(ctx, [accountOwner], [80]),
      ]);

      // Two more withdrawals.
      await ctx.perpetual.margin.withdraw(
        accountOwner,
        accountOwner,
        new BigNumber(70),
        { from: accountOwner },
      );
      const txResult2 = await ctx.perpetual.margin.withdraw(
        accountOwner,
        accountOwner,
        new BigNumber(0),
        { from: accountOwner },
      );

      // Check balances.
      await Promise.all([
        expectMarginBalances(ctx, txResult2, [accountOwner], [0]),
        expectTokenBalances(ctx, [accountOwner], [150]),
      ]);
    });

    it('Account owner cannot withdraw more than the account balance', async () => {
      await expectThrow(
        ctx.perpetual.margin.withdraw(
          accountOwner,
          accountOwner,
          new BigNumber(151),
          { from: accountOwner },
        ),
        'SafeERC20: low-level call failed',
      );
    });

    it('Non-owner cannot withdraw', async () => {
      await expectThrow(
        ctx.perpetual.margin.withdraw(
          accountOwner,
          accountOwner,
          new BigNumber(100),
          { from: otherUser },
        ),
        'sender does not have permission to withdraw',
      );
    });

    it('Fails if it would leave the account undercollateralized', async () => {
      // Set up test contract behavior.
      await ctx.perpetual.testing.oracle.setPrice(new Price(100));

      // Set initial balances and allowances.
      // Bring the total deposited to 1000.
      const marginAmount = new BigNumber(850);
      await Promise.all([
        mintAndDeposit(ctx, accountOwner, marginAmount),
        mintAndDeposit(ctx, otherUser, marginAmount),
      ]);

      // Open a short position, bringing the account to 1100 margin and -10 position.
      // This trade should put the account right on the collateralization line.
      await sell(ctx, accountOwner, otherUser, new BigNumber(10), new BigNumber(100));

      await expectThrow(
        ctx.perpetual.margin.withdraw(
          accountOwner,
          accountOwner,
          new BigNumber(1),
          { from: accountOwner },
        ),
        'account not collateralized',
      );
    });
  });
});
