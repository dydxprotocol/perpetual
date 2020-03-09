import { ADDRESSES } from '../src/lib/Constants';
import { BASE_DECIMALS, address, BaseValue, Price } from '../src/lib/types';
import { expect, expectBN, expectAddressesEqual, expectThrow } from './helpers/Expect';
import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { BigNumber } from '../src';

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
      const newOracle = ctx.perpetual.contracts.testP1Monolith.options.address;
      const originalOracle = await ctx.perpetual.getters.getOracleContract();
      await ctx.perpetual.testing.monolith.setPrice(new Price(1));
      console.log(await ctx.perpetual.testing.monolith.getPrice());
      const txResult = await ctx.perpetual.admin.setOracle(newOracle, { from: admin });

      // Check result
      const oracle = await ctx.perpetual.getters.getOracleContract();
      expect(oracle).to.not.equal(originalOracle);
      expect(oracle).to.equal(newOracle);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogSetOracle');
      expectAddressesEqual(logs[0].args.oracle, oracle);
    });

    it('fails if new oracle returns 0 as price', async () => {
      const newOracle = ctx.perpetual.contracts.testP1Monolith.options.address;
      await expectThrow(
        ctx.perpetual.admin.setOracle(newOracle, { from: admin }),
        'New oracle cannot return a zero price',
      );
    });

    it('fails if new oracle does not have getPrice() function', async () => {
      const funder = ctx.perpetual.contracts.testP1Funder.options.address;
      await expectThrow(
        ctx.perpetual.admin.setOracle(funder, { from: admin }),
      );
      await expectThrow(
        ctx.perpetual.admin.setOracle(ADDRESSES.TEST[0], { from: admin }),
      );
    });

    it('fails if called by non-admin', async () => {
      const newOracle = ctx.perpetual.contracts.testP1Monolith.options.address;
      await ctx.perpetual.testing.monolith.setPrice(new Price(1));
      await expectThrow(
        ctx.perpetual.admin.setOracle(newOracle),
        'Adminable: caller is not admin',
      );
    });
  });

  describe('setFunder()', () => {
    it('sets the Funder', async () => {
      const newFunder = ctx.perpetual.contracts.testP1Monolith.options.address;
      const originalFunder = await ctx.perpetual.getters.getFunderContract();
      const txResult = await ctx.perpetual.admin.setFunder(newFunder, { from: admin });

      // Check result
      const funder = await ctx.perpetual.getters.getFunderContract();
      expect(funder).to.not.equal(originalFunder);
      expect(funder).to.equal(newFunder);

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogSetFunder');
      expectAddressesEqual(logs[0].args.funder, funder);
    });

    it('fails if funder does not have getFunding() function', async () => {
      const oracle = ctx.perpetual.contracts.testP1Oracle.options.address;
      await expectThrow(
        ctx.perpetual.admin.setFunder(oracle, { from: admin }),
      );
      await expectThrow(
        ctx.perpetual.admin.setFunder(ADDRESSES.TEST[0], { from: admin }),
      );
    });

    it('fails if called by non-admin', async () => {
      const newFunder = ctx.perpetual.contracts.testP1Monolith.options.address;
      await expectThrow(
        ctx.perpetual.admin.setFunder(newFunder),
        'Adminable: caller is not admin',
      );
    });
  });

  describe('setMinCollateral()', () => {
    it('sets the collateral requirement', async () => {
      const minCollateral = new BaseValue('1.2');
      const txResult = await ctx.perpetual.admin.setMinCollateral(minCollateral, { from: admin });

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogSetMinCollateral');
      expectBN(logs[0].args.minCollateral).to.equal(minCollateral.toSolidity());
    });

    it('fails if called by non-admin', async () => {
      await expectThrow(
        ctx.perpetual.admin.setMinCollateral(new BaseValue('1.2')),
        'Adminable: caller is not admin',
      );
    });

    it('fails to set the collateral requirement below 100%', async () => {
      const minCollateral = new BaseValue(
        new BigNumber(1)
          .shiftedBy(BASE_DECIMALS)
          .minus(1)
          .shiftedBy(-BASE_DECIMALS),
      );
      await expectThrow(
        ctx.perpetual.admin.setMinCollateral(minCollateral, { from: admin }),
        'The collateral requirement cannot be under 100%',
      );
    });
  });
});
