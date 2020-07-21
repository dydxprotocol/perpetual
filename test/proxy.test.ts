import { expect, expectThrow } from './helpers/Expect';
import initializePerpetual from './helpers/initializePerpetual';
import { address, BaseValue } from '../src/lib/types';
import { ADDRESSES } from '../src/lib/Constants';
import { ITestContext, perpetualDescribe } from './helpers/perpetualDescribe';

let admin: address;
let rando: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializePerpetual(ctx);
  admin = ctx.accounts[0];
  rando = ctx.accounts[1];
}

perpetualDescribe('Proxy', init, (ctx: ITestContext) => {

  describe('initialize()', () => {
    it('succeeds', async () => {});

    it('fails to do a second time', async () => {
      await expectThrow(
        ctx.perpetual.proxy.initialize(
          ADDRESSES.ZERO,
          ADDRESSES.ZERO,
          ADDRESSES.ZERO,
          new BaseValue(0),
          { from: admin },
        ),
      );
    });
  });

  describe('changeAdmin()', () => {
    it('starts on account 0', async () => {
      await expectAdmin(admin);
    });

    it('succeeds', async () => {
      await ctx.perpetual.proxy.changeAdmin(rando, { from: admin });
      await expectAdmin(rando);
    });

    it('succeeds twice', async () => {
      await ctx.perpetual.proxy.changeAdmin(rando, { from: admin });
      await expectAdmin(rando);
      await ctx.perpetual.proxy.changeAdmin(ctx.accounts[2], { from: rando });
      await expectAdmin(ctx.accounts[2]);
    });

    it('fails to do a second time', async () => {
      await ctx.perpetual.proxy.changeAdmin(rando, { from: admin });
      await expectAdmin(rando);
      await expectThrow(
        ctx.perpetual.proxy.changeAdmin(ctx.accounts[2], { from: admin }),
      );
    });
  });

  describe('upgradeTo()', () => {
    it('succeeds', async () => {
      const expectedImplementation = ctx.perpetual.contracts.perpetualV1.options.address;

      const txResult = await ctx.perpetual.proxy.upgradeTo(
        expectedImplementation,
        { from: admin },
      );

      const actualImplementation = await ctx.perpetual.proxy.getImplementation({ from: admin });
      expect(actualImplementation).to.equal(expectedImplementation);

      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('Upgraded');
    });

    it('fails for non-admin', async () => {
      await expectThrow(
        ctx.perpetual.proxy.upgradeTo(
          ctx.perpetual.contracts.perpetualV1.options.address,
          { from: rando },
        ),
      );
    });
  });

  describe('upgradeToAndCall()', () => {
    // TODO
  });

  async function expectAdmin(address: address) {
    const currentAdmin = await ctx.perpetual.proxy.getAdmin({ from: address });
    expect(currentAdmin).to.equal(address);
  }
});
