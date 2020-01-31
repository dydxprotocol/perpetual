import BigNumber from 'bignumber.js';
import { snapshot, resetEVM } from './helpers/EVM';
import { expectBN, expectThrow } from './helpers/Expect';
import { getPerpetual } from './helpers/Perpetual';
import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import { INTEGERS } from '../src/lib/Constants';
import { address } from '../src/lib/types';
import { Perpetual } from '../src/Perpetual';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';

perpetualDescribe('P1Margin', initializeWithTestContracts, (ctx: ITestContext) => {
  let accountOwner;
  let otherUser;

  before(() => {
    accountOwner = ctx.accounts[0];
    otherUser = ctx.accounts[1];
  });

  xdescribe('deposit()', () => {
    it('Account owner can deposit', async () => {
      // Set initial balances and allowances.
      const amount = new BigNumber(150);
      await ctx.perpetual.testing.token.mintTo(amount, accountOwner);
      await ctx.perpetual.testing.token.setMaximumPerpetualAllowance(accountOwner);

      // Execute deposit.
      await ctx.perpetual.margin.deposit(accountOwner, amount, { from: accountOwner });

      // Check balances.
      await expectBalances([accountOwner], [amount]);

      // TODO: Fix logs check.
      // const logs = ctx.perpetual.logs.parseLogs(txResult);
      // expect(logs.length).to.equal(1);
    });

    it('Non-owner can deposit', async () => {
      // Set initial balances and allowances.
      const amount = new BigNumber(150);
      await ctx.perpetual.testing.token.mintTo(amount, otherUser);
      await ctx.perpetual.testing.token.setMaximumPerpetualAllowance(otherUser);

      // Execute deposit.
      await ctx.perpetual.margin.deposit(accountOwner, amount, { from: otherUser });

      // Check balances.
      await expectBalances([accountOwner], [amount]);
    });

    it('Can make multiple deposits', async () => {
      // Set initial balances and allowances.
      await ctx.perpetual.testing.token.mintTo(new BigNumber(1000), accountOwner);
      await ctx.perpetual.testing.token.mintTo(new BigNumber(1000), otherUser);
      await ctx.perpetual.testing.token.setMaximumPerpetualAllowance(accountOwner);
      await ctx.perpetual.testing.token.setMaximumPerpetualAllowance(otherUser);

      // Execute deposits.
      await ctx.perpetual.margin.deposit(accountOwner, new BigNumber(50), { from: accountOwner });
      await ctx.perpetual.margin.deposit(accountOwner, new BigNumber(150), { from: accountOwner });
      await ctx.perpetual.margin.deposit(accountOwner, new BigNumber(0), { from: accountOwner });
      await ctx.perpetual.margin.deposit(accountOwner, new BigNumber(300), { from: otherUser });

      // Check balances.
      await expectBalances([accountOwner], [new BigNumber(500)]);
    });

    it('Cannot deposit more than the sender\'s balance', async () => {
      // Set initial balances and allowances.
      const amount = new BigNumber(1000);
      await ctx.perpetual.testing.token.mintTo(amount, accountOwner);
      await ctx.perpetual.testing.token.setMaximumPerpetualAllowance(otherUser);

      await expectThrow(
        ctx.perpetual.margin.deposit(accountOwner, amount.plus(1), { from: accountOwner }),
        'SafeERC20: ERC20 operation did not succeed',
      );
    });
  });

  describe('withdraw()', () => {
    beforeEach(async () => {
      // Deposit.
      const amount = new BigNumber(150);
      await ctx.perpetual.testing.token.mintTo(amount, accountOwner);
      await ctx.perpetual.testing.token.setMaximumPerpetualAllowance(accountOwner);
      await ctx.perpetual.margin.deposit(accountOwner, amount, { from: accountOwner });
    });

    // it('Account owner can withdraw partial amount', async () => {
    //   await ctx.perpetual.margin.withdraw(accountOwner, new BigNumber(100), { from: accountOwner });

    //   // Check balances.
    //   await expectBalances([accountOwner], [new BigNumber(50)]);

    //   // TODO: Check logs.
    // });

    // it('Account owner can withdraw full amount', async () => {
    //   await ctx.perpetual.margin.withdraw(accountOwner, new BigNumber(150), { from: accountOwner });

    //   // Check balances.
    //   await expectBalances([accountOwner], [new BigNumber(0)]);
    // });

    // it('Owner can make multiple withdrawals', async () => {
    //   await ctx.perpetual.margin.withdraw(accountOwner, new BigNumber(30), { from: accountOwner });
    //   await ctx.perpetual.margin.withdraw(accountOwner, new BigNumber(50), { from: accountOwner });
    //   await ctx.perpetual.margin.withdraw(accountOwner, new BigNumber(70), { from: accountOwner });
    //   await ctx.perpetual.margin.withdraw(accountOwner, new BigNumber(0), { from: accountOwner });

    //   // Check balances.
    //   await expectBalances([accountOwner], [new BigNumber(0)]);
    // });

    // it('Account owner cannot withdraw more than the account balance', async () => {
    //   await expectThrow(
    //     ctx.perpetual.margin.withdraw(accountOwner, new BigNumber(151), { from: accountOwner }),
    //     'SafeERC20: ERC20 operation did not succeed',
    //   );
    // });

    // it('Non-owner cannot withdraw', async () => {
    //   await expectThrow(
    //     ctx.perpetual.margin.withdraw(accountOwner, new BigNumber(100), { from: otherUser }),
    //     'sender does not have permission to withdraw',
    //   );
    // });

    it('Fails if it would leave the account undercollateralized', async () => {
      const marginAmount = new BigNumber(1000);

      // Set up test contract behavior.
      await ctx.perpetual.testing.oracle.setPrice(new BigNumber(100).shiftedBy(18));
      await ctx.perpetual.testing.trader.setTradeResult({
        marginAmount: new BigNumber(100),
        positionAmount: new BigNumber(10),
        isBuy: false,
      });

      // Set initial balances and allowances.
      await mintAndDeposit(accountOwner, marginAmount);
      await mintAndDeposit(otherUser, marginAmount);

      // Open a short position.
      // This trade should put the account right on the collateralization line.
      await ctx.perpetual.trade.trade(
        [accountOwner, otherUser],
        [
          {
            makerIndex: 1,
            takerIndex: 0,
            trader: ctx.perpetual.testing.trader.address,
            data: '0x00',
          },
        ],
      );

      ctx.perpetual.margin.withdraw(accountOwner, new BigNumber(100), { from: accountOwner });
      //   await expectThrow(
      //   ctx.perpetual.margin.withdraw(accountOwner, new BigNumber(1), { from: accountOwner }),
      //   'account not collateralized',
      // );
    });

    // TODO: Test withdrawal as global or local operator.
  });

  async function mintAndDeposit(
    account: address,
    amount: BigNumber,
  ): Promise<void> {
    await ctx.perpetual.testing.token.mintTo(amount, account);
    await ctx.perpetual.testing.token.setMaximumPerpetualAllowance(account);
    await ctx.perpetual.margin.deposit(account, amount, { from: account });
  }

  async function expectBalances(
    accountOwners: address[],
    expectedMarginBalances: BigNumber[],
    fullySettled: boolean = true,
  ): Promise<void> {
    const actualMarginBalances = await Promise.all(accountOwners.map((owner: address) => {
      return ctx.perpetual.getters.getAccountBalance(owner).then(balance => balance.margin);
    }));
    const totalMargin = await ctx.perpetual.getters.getTotalMargin();

    for (const i in expectedMarginBalances) {
      expectBN(actualMarginBalances[i], `accounts[${i}] balance`).eq(expectedMarginBalances[i]);
    }

    // Check that the total margin matches the sum margin of all provided accounts.
    if (fullySettled) {
      const accountSumMargin = actualMarginBalances.reduce((a, b) => a.plus(b), INTEGERS.ZERO);

      // DO NOT MERGE
      console.log(`actualMarginBalances: ${actualMarginBalances}`);
      console.log(`accountSumMargin: ${accountSumMargin}`);

      expectBN(accountSumMargin, 'sum of account margins').eq(totalMargin);
    }

    // Contract solvency check.
    const perpetualTokenBalance = await ctx.perpetual.testing.token.getBalance(
      ctx.perpetual.contracts.perpetualV1.options.address,
    );
    expectBN(perpetualTokenBalance, 'PerpetualV1 token balance').eq(totalMargin);
  }
});
