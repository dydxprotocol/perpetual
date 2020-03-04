import { ADDRESSES } from '../src/lib/Constants';
import { address } from '../src/lib/types';
import { expect, expectAddressesEqual, expectThrow } from './helpers/Expect';
import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';

let admin: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializeWithTestContracts(ctx);
  admin = ctx.accounts[0];
}

perpetualDescribe('P1Getters', init, (ctx: ITestContext) => {

  describe('setGlobalOperator()', () => {
    it('sets the Global Operator', async () => {
      const operator = ADDRESSES.TEST[0];
      const txResult = await ctx.perpetual.admin.setGlobalOperator(operator, true, { from: admin });

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogSetGlobalOperator');
      expectAddressesEqual(logs[0].args.operator, operator);
      expect(logs[0].args.approved).to.equal(true);
    });

    it('fails if called by non-admin', async () => {
      await expectThrow(
        ctx.perpetual.admin.setGlobalOperator(ADDRESSES.TEST[0], true),
        'Adminable: caller is not admin',
      );
    });
  });

  describe('setOracle()', () => {
    it('sets the Oracle', async () => {
      const oracle = ADDRESSES.TEST[0];
      const txResult = await ctx.perpetual.admin.setOracle(oracle, { from: admin });

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogSetOracle');
      expectAddressesEqual(logs[0].args.oracle, oracle);
    });

    it('fails if called by non-admin', async () => {
      await expectThrow(
        ctx.perpetual.admin.setOracle(ADDRESSES.TEST[0]),
        'Adminable: caller is not admin',
      );
    });
  });

  describe('setFunder()', () => {
    it('sets the Funder', async () => {
      const funder = ADDRESSES.TEST[0];
      const txResult = await ctx.perpetual.admin.setFunder(funder, { from: admin });

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogSetFunder');
      expectAddressesEqual(logs[0].args.funder, funder);
    });

    it('fails if called by non-admin', async () => {
      await expectThrow(
        ctx.perpetual.admin.setFunder(ADDRESSES.TEST[0]),
        'Adminable: caller is not admin',
      );
    });
  });
});
