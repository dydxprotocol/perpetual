import BigNumber from 'bignumber.js';

import { expect, expectBN, expectBaseValueEqual } from './helpers/Expect';
import { BaseValue, address, Price } from '../src/lib/types';
import { mintAndDeposit } from './helpers/balances';
import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { buy } from './helpers/trade';

// Tolerance when comparing blockchain timestamp against local timestamp.
const TIMESTAMP_THRESHOLD_MS = 30000;

const marginAmount = new BigNumber('1e17');
const positionAmount = new BigNumber('1e15');

let admin: address;
let account: address;
let otherAccount: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializeWithTestContracts(ctx);

  // Default account is accounts[1]. Use other accounts.
  admin = ctx.accounts[0];
  account = ctx.accounts[5];
  otherAccount = ctx.accounts[6];

  // Set up initial balances.
  await Promise.all([
    await mintAndDeposit(ctx, account, marginAmount),
    await mintAndDeposit(ctx, otherAccount, marginAmount),
  ]);
  await buy(ctx, account, otherAccount, positionAmount, marginAmount.div(2));
}

perpetualDescribe('P1Getters', init, (ctx: ITestContext) => {

  it('getAccountBalance()', async () => {
    const balance = await ctx.perpetual.getters.getAccountBalance(account);
    expectBN(balance.margin).to.equal(marginAmount.div(2));
    expectBN(balance.position).to.equal(positionAmount);
  });

  it('getAccountIndex()', async () => {
    const index = await ctx.perpetual.getters.getAccountIndex(account);
    expectBaseValueEqual(index.baseValue, new BaseValue(0));
    const timeDelta = index.timestamp.times(1000).minus(Date.now()).abs();
    expectBN(timeDelta).to.be.lessThan(TIMESTAMP_THRESHOLD_MS);
  });

  it('getIsLocalOperator()', async () => {
    const isOperator = await ctx.perpetual.getters.getIsLocalOperator(account, otherAccount);
    expect(isOperator).to.equal(false);
  });

  it('getIsGlobalOperator()', async () => {
    let isOperator = await ctx.perpetual.getters.getIsGlobalOperator(account);
    expect(isOperator).to.equal(false);
    isOperator = await ctx.perpetual.getters.getIsGlobalOperator(
      ctx.perpetual.contracts.p1Orders.options.address,
    );
    expect(isOperator).to.equal(true);
  });

  it('getTokenContract()', async () => {
    const contractAddress = await ctx.perpetual.getters.getTokenContract();
    expect(contractAddress).to.equal(ctx.perpetual.contracts.testToken.options.address);
  });

  it('getOracleContract()', async () => {
    const contractAddress = await ctx.perpetual.getters.getOracleContract();
    expect(contractAddress).to.equal(ctx.perpetual.contracts.testP1Oracle.options.address);
  });

  it('getFunderContract()', async () => {
    const contractAddress = await ctx.perpetual.getters.getFunderContract();
    expect(contractAddress).to.equal(ctx.perpetual.contracts.testP1Funder.options.address);
  });

  it('getGlobalIndex()', async () => {
    const index = await ctx.perpetual.getters.getGlobalIndex();
    expectBaseValueEqual(index.baseValue, new BaseValue(0));
    const timeDelta = index.timestamp.times(1000).minus(Date.now()).abs();
    expectBN(timeDelta).to.be.lessThan(TIMESTAMP_THRESHOLD_MS);
  });

  it('getMinCollateral()', async () => {
    const minCollateral = await ctx.perpetual.getters.getMinCollateral();
    expectBaseValueEqual(minCollateral, new BaseValue('1.1'));
  });

  it('hasAccountPermissions()', async () => {
    let hasPermissions = await ctx.perpetual.getters.hasAccountPermissions(account, otherAccount);
    expect(hasPermissions).to.equal(false);
    hasPermissions = await ctx.perpetual.getters.hasAccountPermissions(account, account);
    expect(hasPermissions).to.equal(true);
    const ordersContract = ctx.perpetual.contracts.p1Orders.options.address;
    hasPermissions = await ctx.perpetual.getters.hasAccountPermissions(account, ordersContract);
    expect(hasPermissions).to.equal(true);
  });

  it('getFinalSettlementEnabled()', async () => {
    let enabled = await ctx.perpetual.getters.getFinalSettlementEnabled();
    expect(enabled).to.equal(false);
    await ctx.perpetual.admin.enableFinalSettlement(new Price(0), new Price(0), { from: admin });
    enabled = await ctx.perpetual.getters.getFinalSettlementEnabled();
    expect(enabled).to.equal(true);
  });
});
