import { BaseValue } from '../src';
import { expectBN, expectBaseValueEqual } from './helpers/Expect';
import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';

perpetualDescribe('Perpetual', initializeWithTestContracts, (ctx: ITestContext) => {

  describe('initial state', () => {
    it('has proper index', async () => {
      const index = await ctx.perpetual.getters.getGlobalIndex();
      const { timestamp } = await ctx.perpetual.web3.eth.getBlock('latest');
      expectBaseValueEqual(index.baseValue, new BaseValue(0));
      expectBN(index.timestamp).lte(timestamp as any);
    });

    it('has empty balances', async () => {
      const balance = await ctx.perpetual.getters.getAccountBalance(ctx.accounts[0]);
      expectBN(balance.margin).eq(0);
      expectBN(balance.position).eq(0);
    });

    // TODO
  });

  // TODO
});
