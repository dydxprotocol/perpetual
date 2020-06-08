import _ from 'lodash';

import {
  address,
  BigNumberable,
} from '../src/lib/types';
import initializePerpetual from './helpers/initializePerpetual';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { expect, expectBN, expectThrow } from './helpers/Expect';
import { expectMarginBalances, mintAndDeposit } from './helpers/balances';

// Mock parameters.
const initialNonNativeBalance = 125e6;
const nonNativeAmount = 25e6;
const marginAmount = 50e18;

let admin: address;
let account: address;
let otherAddress: address;
let proxyAddress: address;
let exchangeWrapperAddress: address;

// The margin token is the token used as margin/collateral in the PerpetualV1 contract.
let marginToken: address;

// The non-native token is some other token not used within the PerpetualV1 contract.
let nonNativeToken: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializePerpetual(ctx);
  admin = ctx.accounts[0];
  // Default account is accounts[1]. Use other accounts.
  account = ctx.accounts[2];
  otherAddress = ctx.accounts[3];
  proxyAddress = ctx.perpetual.contracts.p1CurrencyConverterProxy.options.address;
  exchangeWrapperAddress = ctx.perpetual.testing.exchangeWrapper.address;
  marginToken = ctx.perpetual.contracts.testToken.options.address;
  nonNativeToken = ctx.perpetual.contracts.testToken2.options.address;

  await Promise.all([
    // Set allowance on Perpetual for the proxy.
    ctx.perpetual.currencyConverterProxy.approveMaximumOnPerpetual(),

    // Set allowance on proxy for the account.
    ctx.perpetual.token.setMaximumAllowance(
      nonNativeToken,
      account,
      proxyAddress,
    ),

    // Fund the account owner with non-native token.
    ctx.perpetual.testing.token.mint(
      nonNativeToken,
      account,
      initialNonNativeBalance,
    ),

    // Fund the exchange wrapper with both tokens.
    ctx.perpetual.testing.token.mint(
      marginToken,
      exchangeWrapperAddress,
      1000e18,
    ),
    ctx.perpetual.testing.token.mint(
      nonNativeToken,
      exchangeWrapperAddress,
      1000e6,
    ),
  ]);
}

perpetualDescribe('P1CurrencyConverterProxy', init, (ctx: ITestContext) => {
  describe('deposit()', () => {
    beforeEach(async () => {
      // Set test data.
      await ctx.perpetual.testing.exchangeWrapper.setMakerAmount(marginAmount);
    });

    it('deposits', async () => {
      // Call the function.
      const txResult = await ctx.perpetual.currencyConverterProxy.deposit(
        account,
        exchangeWrapperAddress,
        nonNativeToken,
        nonNativeAmount,
        getTestOrderData(nonNativeAmount),
        { from: account },
      );

      // Check balances.
      await Promise.all([
        expectNonNativeBalances(
          [account],
          [initialNonNativeBalance - nonNativeAmount],
        ),
        expectMarginBalances(ctx, txResult, [account], [marginAmount]),
        expectProxyNoBalances(),
      ]);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      const filteredLogs = logs.filter(log => log.name === 'LogConvertedDeposit');
      expect(filteredLogs.length).to.equal(1);
      const log = filteredLogs[0];
      expect(log.name).to.equal('LogConvertedDeposit');
      expect(log.args.account).to.equal(account);
      expect(log.args.source).to.equal(account);
      expect(log.args.perpetual).to.equal(ctx.perpetual.contracts.perpetualProxy.options.address);
      expect(log.args.exchangeWrapper).to.equal(exchangeWrapperAddress);
      expect(log.args.tokenFrom).to.equal(nonNativeToken);
      expect(log.args.tokenTo).to.equal(marginToken);
      expectBN(log.args.tokenFromAmount).to.equal(nonNativeAmount);
      expectBN(log.args.tokenToAmount).to.equal(marginAmount);
    });

    it('deposits from a sender that is not the account owner', async () => {
      // Set allowance on proxy for the other account.
      await ctx.perpetual.token.setMaximumAllowance(
        nonNativeToken,
        otherAddress,
        proxyAddress,
      );

      // Fund the other account with non-native token.
      await ctx.perpetual.testing.token.mint(
        nonNativeToken,
        otherAddress,
        nonNativeAmount,
      );

      // Call the function.
      const txResult = await ctx.perpetual.currencyConverterProxy.deposit(
        account,
        exchangeWrapperAddress,
        nonNativeToken,
        nonNativeAmount,
        getTestOrderData(nonNativeAmount),
        { from: otherAddress },
      );

      // Check balances.
      await Promise.all([
        expectNonNativeBalances([account, otherAddress], [initialNonNativeBalance, 0]),
        await expectMarginBalances(ctx, txResult, [account], [marginAmount]),
        await expectProxyNoBalances(),
      ]);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      const filteredLogs = logs.filter(log => log.name === 'LogConvertedDeposit');
      expect(filteredLogs.length).to.equal(1);
      const log = filteredLogs[0];
      expect(log.name).to.equal('LogConvertedDeposit');
      expect(log.args.account).to.equal(account);
      expect(log.args.source).to.equal(otherAddress);
      expect(log.args.perpetual).to.equal(ctx.perpetual.contracts.perpetualProxy.options.address);
      expect(log.args.exchangeWrapper).to.equal(exchangeWrapperAddress);
      expect(log.args.tokenFrom).to.equal(nonNativeToken);
      expect(log.args.tokenTo).to.equal(marginToken);
      expectBN(log.args.tokenFromAmount).to.equal(nonNativeAmount);
      expectBN(log.args.tokenToAmount).to.equal(marginAmount);
    });

    it('returns the amount deposited after the conversion (when using eth_call)', async () => {
      const toTokenAmount = await ctx.perpetual.currencyConverterProxy.getDepositConvertedAmount(
        account,
        exchangeWrapperAddress,
        nonNativeToken,
        nonNativeAmount,
        getTestOrderData(nonNativeAmount),
        { from: account },
      );
      expectBN(toTokenAmount).to.equal(marginAmount);
    });
  });

  describe('withdraw()', () => {
    beforeEach(async () => {
      await Promise.all([
        // Add margin funds to the Perpetual account.
        mintAndDeposit(ctx, account, marginAmount),

        // Set test data.
        ctx.perpetual.testing.exchangeWrapper.setMakerAmount(nonNativeAmount),
      ]);
    });

    it('withdraws', async () => {
      // Call the function.
      const txResult = await ctx.perpetual.currencyConverterProxy.withdraw(
        account,
        account,
        exchangeWrapperAddress,
        nonNativeToken,
        marginAmount,
        getTestOrderData(marginAmount),
        { from: account },
      );

      // Check balances.
      await Promise.all([
        expectNonNativeBalances(
          [account],
          [initialNonNativeBalance + nonNativeAmount],
        ),
        expectMarginBalances(ctx, txResult, [account], [0]),
        expectProxyNoBalances(),
      ]);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      const filteredLogs = logs.filter(log => log.name === 'LogConvertedWithdrawal');
      expect(filteredLogs.length).to.equal(1);
      const log = filteredLogs[0];
      expect(log.name).to.equal('LogConvertedWithdrawal');
      expect(log.args.account).to.equal(account);
      expect(log.args.destination).to.equal(account);
      expect(log.args.perpetual).to.equal(ctx.perpetual.contracts.perpetualProxy.options.address);
      expect(log.args.exchangeWrapper).to.equal(exchangeWrapperAddress);
      expect(log.args.tokenFrom).to.equal(marginToken);
      expect(log.args.tokenTo).to.equal(nonNativeToken);
      expectBN(log.args.tokenFromAmount).to.equal(marginAmount);
      expectBN(log.args.tokenToAmount).to.equal(nonNativeAmount);
    });

    it('withdraws to another destination', async () => {
      // Call the function.
      const txResult = await ctx.perpetual.currencyConverterProxy.withdraw(
        account,
        otherAddress,
        exchangeWrapperAddress,
        nonNativeToken,
        marginAmount,
        getTestOrderData(marginAmount),
        { from: account },
      );

      // Check balances.
      await Promise.all([
        expectNonNativeBalances(
          [account, otherAddress],
          [initialNonNativeBalance, nonNativeAmount],
        ),
        expectMarginBalances(ctx, txResult, [account, otherAddress], [0, 0]),
        expectProxyNoBalances(),
      ]);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      const filteredLogs = logs.filter(log => log.name === 'LogConvertedWithdrawal');
      expect(filteredLogs.length).to.equal(1);
      const log = filteredLogs[0];
      expect(log.name).to.equal('LogConvertedWithdrawal');
      expect(log.args.account).to.equal(account);
      expect(log.args.destination).to.equal(otherAddress);
      expect(log.args.perpetual).to.equal(ctx.perpetual.contracts.perpetualProxy.options.address);
      expect(log.args.exchangeWrapper).to.equal(exchangeWrapperAddress);
      expect(log.args.tokenFrom).to.equal(marginToken);
      expect(log.args.tokenTo).to.equal(nonNativeToken);
      expectBN(log.args.tokenFromAmount).to.equal(marginAmount);
      expectBN(log.args.tokenToAmount).to.equal(nonNativeAmount);
    });

    describe('withdrawal permissions', () => {
      it('succeeds if the sender is a local operator', async () => {
        // Set local operator.
        await ctx.perpetual.operator.setLocalOperator(otherAddress, true, { from: account });

        // Call the function.
        const txResult = await ctx.perpetual.currencyConverterProxy.withdraw(
          account,
          account,
          exchangeWrapperAddress,
          nonNativeToken,
          marginAmount,
          getTestOrderData(marginAmount),
          { from: otherAddress },
        );

        // Check balances.
        await Promise.all([
          expectNonNativeBalances(
            [account],
            [initialNonNativeBalance + nonNativeAmount],
          ),
          expectMarginBalances(ctx, txResult, [account], [0]),
          expectProxyNoBalances(),
        ]);
      });

      it('succeeds if the sender is a global operator', async () => {
        // Set global operator.
        await ctx.perpetual.admin.setGlobalOperator(otherAddress, true, { from: admin });

        // Call the function.
        const txResult = await ctx.perpetual.currencyConverterProxy.withdraw(
          account,
          account,
          exchangeWrapperAddress,
          nonNativeToken,
          marginAmount,
          getTestOrderData(marginAmount),
          { from: otherAddress },
        );

        // Check balances.
        await Promise.all([
          expectNonNativeBalances(
            [account],
            [initialNonNativeBalance + nonNativeAmount],
          ),
          expectMarginBalances(ctx, txResult, [account], [0]),
          expectProxyNoBalances(),
        ]);
      });

      it('fails if the sender is not the account owner or operator', async () => {
        // Call the function.
        await expectThrow(
          ctx.perpetual.currencyConverterProxy.withdraw(
            account,
            account,
            exchangeWrapperAddress,
            nonNativeToken,
            marginAmount,
            getTestOrderData(marginAmount),
            { from: otherAddress },
          ),
          'msg.sender cannot operate the account',
        );
      });
    });

    it('returns the amount withdrawn after the conversion (when using eth_call)', async () => {
      const toTokenAmount = await ctx.perpetual.currencyConverterProxy.getWithdrawConvertedAmount(
        account,
        otherAddress,
        exchangeWrapperAddress,
        nonNativeToken,
        marginAmount,
        getTestOrderData(marginAmount),
        { from: account },
      );
      expectBN(toTokenAmount).to.equal(nonNativeAmount);
    });
  });

  /**
   * Check non-native token balances.
   */
  async function expectNonNativeBalances(
    accounts: address[],
    expectedBalances: BigNumberable[],
  ): Promise<void> {
    const actualBalances = await Promise.all(accounts.map((account: address) => {
      return ctx.perpetual.token.getBalance(nonNativeToken, account);
    }));

    for (const i in expectedBalances) {
      const expectedBalance = expectedBalances[i];
      expectBN(actualBalances[i], `accounts[${i}] non-native balance`).to.equal(expectedBalance);
    }
  }

  /**
   * Verify that the proxy contract does not have any token balances.
   */
  async function expectProxyNoBalances(): Promise<void> {
    const balances = await Promise.all([
      ctx.perpetual.token.getBalance(
        marginToken,
        proxyAddress,
      ),
      ctx.perpetual.token.getBalance(
        nonNativeToken,
        proxyAddress,
      ),
    ]);
    expectBN(balances[0], 'proxy margin token balance').to.equal(0);
    expectBN(balances[1], 'proxy non-native token balance').to.equal(0);
  }

  /**
   * Construct a data string for use with the test exchange wrapper.
   */
  function getTestOrderData(
    amount: BigNumberable,
  ): string {
    return ctx.perpetual.testing.exchangeWrapper.testOrderToBytes({ amount });
  }
});
