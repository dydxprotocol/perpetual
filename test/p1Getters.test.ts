import BigNumber from 'bignumber.js';

import { INTEGERS } from '../src/lib/Constants';
import { expect, expectBN } from './helpers/Expect';
import { address } from '../src/lib/types';
import { mintAndDeposit } from './helpers/balances';
import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { buy } from './helpers/trade';

// Tolerance when comparing blockchain timestamp against local timestamp.
const TIMESTAMP_THRESHOLD_MS = 30000;

perpetualDescribe('P1Getters', initializeWithTestContracts, (ctx: ITestContext) => {
  let account: address;
  let otherAccount: address;

  before(() => {
    // Default account is accounts[1]. Use other accounts.
    account = ctx.accounts[5];
    otherAccount = ctx.accounts[6];
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

  it('getMinCollateral()', async () => {
    const minCollateral = await ctx.perpetual.getters.getMinCollateral();
    expectBN(minCollateral).to.equal('1100000000000000000');
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

  describe('with account balances', () => {
    let marginAmount;
    let positionAmount;

    beforeEach(async () => {
      marginAmount = new BigNumber('1e18');
      positionAmount = new BigNumber('1e16');
      await Promise.all([
        await mintAndDeposit(ctx, account, marginAmount),
        await mintAndDeposit(ctx, otherAccount, marginAmount),
      ]);
      await buy(ctx, account, otherAccount, positionAmount, marginAmount.div(2));
    });

    it('getAccountBalance()', async () => {
      const balance = await ctx.perpetual.getters.getAccountBalance(account);
      expectBN(balance.margin).to.equal(marginAmount.div(2));
      expectBN(balance.position).to.equal(positionAmount);
    });

    it('getAccountIndex()', async () => {
      const index = await ctx.perpetual.getters.getAccountIndex(account);
      expectBN(index.value).to.equal(INTEGERS.ZERO);
      const timeDelta = index.timestamp.times(1000).minus(Date.now()).abs();
      expectBN(timeDelta).to.be.lessThan(TIMESTAMP_THRESHOLD_MS);
    });

    it('getGlobalIndex()', async () => {
      const index = await ctx.perpetual.getters.getGlobalIndex();
      expectBN(index.value).to.equal(INTEGERS.ZERO);
      const timeDelta = index.timestamp.times(1000).minus(Date.now()).abs();
      expectBN(timeDelta).to.be.lessThan(TIMESTAMP_THRESHOLD_MS);
    });

    it('getOpenInterest()', async () => {
      const totalPosition = await ctx.perpetual.getters.getOpenInterest();
      // TODO: This should be the actual open interest.
      expectBN(totalPosition).to.equal(INTEGERS.ZERO);
    });

    it('getTotalMargin()', async () => {
      const totalMargin = await ctx.perpetual.getters.getTotalMargin();
      expectBN(totalMargin).to.equal(marginAmount.times(2));
    });
  });
});
