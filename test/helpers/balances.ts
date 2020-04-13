import BigNumber from 'bignumber.js';

import { ITestContext } from './perpetualDescribe';
import { expectBN } from './Expect';
import { INTEGERS } from '../../src/lib/Constants';
import { address, Balance, BigNumberable, TxResult } from '../../src/lib/types';

export async function expectBalances(
  ctx: ITestContext,
  txResult: TxResult,
  accounts: address[],
  expectedMargins: BigNumberable[],
  expectedPositions: BigNumberable[],
  fullySettled: boolean = true,
  positionsSumToZero: boolean = true,
): Promise<void> {
  await Promise.all([
    expectMarginBalances(ctx, txResult, accounts, expectedMargins, fullySettled),
    expectPositions(ctx, txResult, accounts, expectedPositions, positionsSumToZero),
  ]);
}

/**
 * Verify that the account margin balances match the expected values.
 *
 * A final solvency check may be performed to verify that the total margin balance is equal to the
 * token balance actually owned by the contract.
 */
export async function expectMarginBalances(
  ctx: ITestContext,
  txResult: TxResult,
  accounts: address[],
  expectedMargins: BigNumberable[],
  fullySettled: boolean = true,
): Promise<void> {
  const actualMargins = await Promise.all(accounts.map((account: address) => {
    return ctx.perpetual.getters.getAccountBalance(account).then(balance => balance.margin);
  }));
  const eventBalances = getBalanceEvents(ctx, txResult, accounts);

  for (const i in expectedMargins) {
    const expectedMargin = new BigNumber(expectedMargins[i]);
    expectBN(actualMargins[i], `accounts[${i}] actual margin`).eq(expectedMargin);
    if (eventBalances[i]) {
      expectBN(eventBalances[i].margin, `accounts[${i}] event margin`).eq(expectedMargin);
    }
  }

  // Contract solvency check
  if (fullySettled) {
    const accountSumMargin = actualMargins.reduce((a, b) => a.plus(b), INTEGERS.ZERO);
    const perpetualTokenBalance = await ctx.perpetual.testing.token.getBalance(
      ctx.perpetual.testing.token.address,
      ctx.perpetual.contracts.perpetualV1.options.address,
    );
    expectBN(accountSumMargin, 'sum of margins equals token balance').eq(perpetualTokenBalance);
  }
}

/**
 * Verify that the account position balances match the expected values.
 *
 * If sumToZero is set to true (the default) then a check will be performed to ensure the position
 * balances sum to zero. This should always be the case when (for example) the prvoided accounts
 * represent all accounts on the contract with positions.
 */
export async function expectPositions(
  ctx: ITestContext,
  txResult: TxResult,
  accounts: address[],
  expectedPositions: BigNumberable[],
  sumToZero: boolean = true,
) {
  const actualPositions = await Promise.all(accounts.map((account: address) => {
    return ctx.perpetual.getters.getAccountBalance(account).then(balance => balance.position);
  }));
  const eventBalances = getBalanceEvents(ctx, txResult, accounts);

  for (const i in expectedPositions) {
    const expectedPosition = new BigNumber(expectedPositions[i]);
    expectBN(actualPositions[i], `accounts[${i}] actual position`).eq(expectedPosition);
    if (eventBalances[i]) {
      expectBN(eventBalances[i].position, `accounts[${i}] event position`).eq(expectedPosition);
    }
  }

  if (sumToZero) {
    const accountSumPosition = actualPositions.reduce((a, b) => a.plus(b), INTEGERS.ZERO);
    expectBN(accountSumPosition).eq(INTEGERS.ZERO);
  }
}

/**
 * Verify that the account test token balances match the expected values.
 */
export async function expectTokenBalances(
  ctx: ITestContext,
  accounts: address[],
  expectedBalances: BigNumberable[],
): Promise<void> {
  const balances = await Promise.all(accounts.map((account: address) =>
    ctx.perpetual.testing.token.getBalance(
      ctx.perpetual.testing.token.address,
      account,
    ),
  ));
  for (const i in expectedBalances) {
    expectBN(balances[i], `accounts[${i}] token balance`).to.eq(expectedBalances[i]);
  }
}

/**
 * Check that the contract has a surplus (or deficit) relative to the current margin balances.
 *
 * The surplus/deficit could be due to unsettled interest or due to rounding errors in settlement.
 */
export async function expectContractSurplus(
  ctx: ITestContext,
  accounts: address[],
  expectedSurplus: BigNumberable,
): Promise<void> {
  const marginBalances = await Promise.all(accounts.map((account: address) => {
    return ctx.perpetual.getters.getAccountBalance(account).then(balance => balance.margin);
  }));
  const accountSumMargin = marginBalances.reduce((a, b) => a.plus(b), INTEGERS.ZERO);
  const perpetualTokenBalance = await ctx.perpetual.testing.token.getBalance(
    ctx.perpetual.testing.token.address,
    ctx.perpetual.contracts.perpetualV1.options.address,
  );
  const actualSurplus = perpetualTokenBalance.minus(accountSumMargin);
  expectBN(actualSurplus, 'contract margin token surplus').eq(expectedSurplus);
}

/**
 * Mint test token to an account and deposit it in the perpetual.
 */
export async function mintAndDeposit(
  ctx: ITestContext,
  account: address,
  amount: BigNumberable,
): Promise<void> {
  const amountBN = new BigNumber(amount);
  await ctx.perpetual.testing.token.mint(
    ctx.perpetual.testing.token.address,
    account,
    amountBN,
  );
  await ctx.perpetual.testing.token.setMaximumPerpetualAllowance(
    ctx.perpetual.testing.token.address,
    account,
  );
  await ctx.perpetual.margin.deposit(account, amountBN, { from: account });
}

function getBalanceEvents(
  ctx: ITestContext,
  txResult: TxResult,
  accounts: address[],
): Balance[] {
  // If no transaction, return no events
  if (!txResult) {
    return [];
  }

  const logs = ctx.perpetual.logs.parseLogs(txResult)
    .filter((log: any) => ['LogTrade', 'LogWithdaw', 'LogDeposit'].includes(log.name));

  const result = [];
  for (const i in accounts) {
    const account = accounts[i].toLowerCase();
    let balance = null;

    for (let j = logs.length - 1; j >= 0; j -= 1) {
      const log = logs[j];
      if (log.args.account && log.args.account.toLowerCase() === account) {
        balance = log.args.balance;
        break;
      }
      if (log.args.maker && log.args.maker.toLowerCase() === account) {
        balance = log.args.makerBalance;
        break;
      }
      if (log.args.taker && log.args.taker.toLowerCase() === account) {
        balance = log.args.takerBalance;
        break;
      }
    }
    result[i] = balance;
  }
  return result;
}
