import BigNumber from 'bignumber.js';
import _ from 'lodash';

import initializePerpetual from './helpers/initializePerpetual';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import {
  address,
} from '../src/lib/types';
import {
  expectMarginBalances,
  expectTokenBalances,
} from './helpers/balances';
import {
  expect,
  expectThrow,
} from './helpers/Expect';

// Test parameters.
const amount = new BigNumber(1.25e18);

// Accounts and addresses.
let admin: address;
let account: address;
let otherAddress: address;
let perpetualAddress: address;
let wethAddress: address;
let proxyAddress: address;

function init(useWeth: boolean = false) {
  return async (ctx: ITestContext): Promise<void> => {
    // Accounts and addresses.
    admin = ctx.accounts[0];
    account = ctx.accounts[2];
    otherAddress = ctx.accounts[3];
    perpetualAddress = ctx.perpetual.contracts.perpetualProxy.options.address;
    wethAddress = ctx.perpetual.contracts.weth.options.address;
    proxyAddress = ctx.perpetual.wethProxy.address;

    await initializePerpetual(ctx, { token: useWeth ? wethAddress : undefined });
    await Promise.all([
      // Set allowance on Perpetual for the proxy.

      ctx.perpetual.wethProxy.approveMaximumOnPerpetual(),

      // Check initial balances.
      expectTokenBalances(
        ctx,
        [account, perpetualAddress, wethAddress, proxyAddress],
        [0, 0, 0, 0],
      ),
    ]);
  };
}

perpetualDescribe('P1WethProxy (with a Perpetual using WETH)', init(true), (ctx: ITestContext) => {

  describe('deposit()', () => {

    it('succeeds', async () => {
      const initialEthBalance = new BigNumber(await ctx.perpetual.web3.eth.getBalance(account));
      const txResult = await ctx.perpetual.wethProxy.depositEth(
        account,
        amount,
        { from: account },
      );
      const finalEthBalance = new BigNumber(await ctx.perpetual.web3.eth.getBalance(account));

      // Check amount of ETH spent.
      // Expect a small amount of “error” due to tx gas expenses.
      const ethSpent = initialEthBalance.minus(finalEthBalance);
      const balanceDiffError = ethSpent.minus(amount).dividedBy(amount).abs();
      expect(balanceDiffError.lt(0.001), `ETH spent: ${ethSpent}`).to.be.true;

      // Check balances.
      await expectTokenBalances(
        ctx,
        [account, perpetualAddress, wethAddress, proxyAddress],
        [0, amount, 0, 0],
        wethAddress,
      );
      await expectMarginBalances(ctx, txResult, [account], [amount]);
    });

    it('succeeds depositing to another account', async () => {
      const initialEthBalance = new BigNumber(await ctx.perpetual.web3.eth.getBalance(account));
      const txResult = await ctx.perpetual.wethProxy.depositEth(
        otherAddress,
        amount,
        { from: account },
      );
      const finalEthBalance = new BigNumber(await ctx.perpetual.web3.eth.getBalance(account));

      // Check amount of ETH spent.
      // Expect a small amount of “error” due to tx gas expenses.
      const ethSpent = initialEthBalance.minus(finalEthBalance);
      const balanceDiffError = ethSpent.minus(amount).dividedBy(amount).abs();
      expect(balanceDiffError.lt(0.001), `ETH spent: ${ethSpent}`).to.be.true;

      // Check balances.
      await expectTokenBalances(
        ctx,
        [account, perpetualAddress, wethAddress, proxyAddress, otherAddress],
        [0, amount, 0, 0, 0],
        wethAddress,
      );
      await expectMarginBalances(ctx, txResult, [otherAddress], [amount]);
    });
  });

  describe('withdraw()', () => {

    beforeEach(async () => {
      // Create WETH and deposit it to the perpetual.
      await Promise.all([
        ctx.perpetual.weth.wrap(amount, { from: account }),
        ctx.perpetual.weth.setMaximumPerpetualAllowance(ctx.perpetual.weth.address, account),
      ]);
      await ctx.perpetual.margin.deposit(account, amount, { from: account });
    });

    it('succeeds for the account owner', async () => {
      // Call the function.
      const initialEthBalance = new BigNumber(await ctx.perpetual.web3.eth.getBalance(account));
      const txResult = await ctx.perpetual.wethProxy.withdrawEth(
        account,
        account,
        amount,
        { from: account },
      );
      const finalEthBalance = new BigNumber(await ctx.perpetual.web3.eth.getBalance(account));

      // Check amount of ETH received.
      // Expect a small amount of “error” due to tx gas expenses.
      const ethReceived = finalEthBalance.minus(initialEthBalance);
      const balanceDiffError = ethReceived.minus(amount).dividedBy(amount).abs();
      expect(balanceDiffError.lt(0.001), `ETH received: ${ethReceived}`).to.be.true;

      // Check balances.
      await expectTokenBalances(
        ctx,
        [account, perpetualAddress, wethAddress, proxyAddress, otherAddress],
        [0, 0, 0, 0, 0],
        wethAddress,
      );
      await expectMarginBalances(ctx, txResult, [account], [0]);
    });

    it('succeeds for a local operator of the account', async () => {
      // Set up.
      await ctx.perpetual.operator.setLocalOperator(otherAddress, true, { from: account });

      // Call the function.
      const initialEthBalance = new BigNumber(await ctx.perpetual.web3.eth.getBalance(account));
      const txResult = await ctx.perpetual.wethProxy.withdrawEth(
        account,
        account,
        amount,
        { from: otherAddress },
      );
      const finalEthBalance = new BigNumber(await ctx.perpetual.web3.eth.getBalance(account));

      // Check amount of ETH received.
      // Expect a small amount of “error” due to tx gas expenses.
      const ethReceived = finalEthBalance.minus(initialEthBalance);
      const balanceDiffError = ethReceived.minus(amount).dividedBy(amount).abs();
      expect(balanceDiffError.lt(0.001), `ETH received: ${ethReceived}`).to.be.true;

      // Check balances.
      await expectTokenBalances(
        ctx,
        [account, perpetualAddress, wethAddress, proxyAddress, otherAddress],
        [0, 0, 0, 0, 0],
        wethAddress,
      );
      await expectMarginBalances(ctx, txResult, [account], [0]);
    });

    it('succeeds for a global operator', async () => {
      // Set up.
      await ctx.perpetual.admin.setGlobalOperator(otherAddress, true, { from: admin });

      // Call the function.
      const initialEthBalance = new BigNumber(await ctx.perpetual.web3.eth.getBalance(account));
      const txResult = await ctx.perpetual.wethProxy.withdrawEth(
        account,
        account,
        amount,
        { from: otherAddress },
      );
      const finalEthBalance = new BigNumber(await ctx.perpetual.web3.eth.getBalance(account));

      // Check amount of ETH received.
      // Expect a small amount of “error” due to tx gas expenses.
      const ethReceived = finalEthBalance.minus(initialEthBalance);
      const balanceDiffError = ethReceived.minus(amount).dividedBy(amount).abs();
      expect(balanceDiffError.lt(0.001), `ETH received: ${ethReceived}`).to.be.true;

      // Check balances.
      await expectTokenBalances(
        ctx,
        [account, perpetualAddress, wethAddress, proxyAddress, otherAddress],
        [0, 0, 0, 0, 0],
        wethAddress,
      );
      await expectMarginBalances(ctx, txResult, [account], [0]);
    });

    it('succeeds withdrawing to a destination other than the sender', async () => {
      // Call the function.
      const initialEthBalance = new BigNumber(
        await ctx.perpetual.web3.eth.getBalance(otherAddress),
      );
      const txResult = await ctx.perpetual.wethProxy.withdrawEth(
        account,
        otherAddress,
        amount,
        { from: account },
      );
      const finalEthBalance = new BigNumber(await ctx.perpetual.web3.eth.getBalance(otherAddress));

      // Check amount of ETH received.
      // Expect a small amount of “error” due to tx gas expenses.
      const ethReceived = finalEthBalance.minus(initialEthBalance);
      const balanceDiffError = ethReceived.minus(amount).dividedBy(amount).abs();
      expect(balanceDiffError.lt(0.001), `ETH received: ${ethReceived}`).to.be.true;

      // Check balances.
      await expectTokenBalances(
        ctx,
        [account, perpetualAddress, wethAddress, proxyAddress, otherAddress],
        [0, 0, 0, 0, 0],
        wethAddress,
      );
      await expectMarginBalances(ctx, txResult, [account], [0]);
    });

    it('fails for an account without withdraw permissions', async () => {
      await expectThrow(
        ctx.perpetual.wethProxy.withdrawEth(account, account, amount, { from: otherAddress }),
        'Sender does not have withdraw permissions for the account',
      );
    });

    it('fails if the amount is greater than the margin token balance', async () => {
      await expectThrow(
        ctx.perpetual.wethProxy.withdrawEth(account, account, amount.plus(1), { from: account }),
        'SafeERC20: low-level call failed',
      );
    });
  });

  describe('fallback function', () => {

    it('reverts when called by anyone but the WETH contract', async () => {
      await expectThrow(
        ctx.perpetual.web3.eth.sendTransaction({ to: proxyAddress, value: amount.toFixed() }),
        'Cannot receive ETH',
      );
    });
  });
});

perpetualDescribe('P1WethProxy (with a Perpetual NOT using WETH)', init(), (ctx: ITestContext) => {

  it('fails to deposit', async () => {
    await expectThrow(
      ctx.perpetual.wethProxy.depositEth(account, amount, { from: account }),
      'The perpetual does not use WETH for margin deposits',
    );
  });

  it('fails to withdraw', async () => {
    await expectThrow(
      ctx.perpetual.wethProxy.withdrawEth(account, account, amount, { from: account }),
      'The perpetual does not use WETH for margin deposits',
    );
  });
});
