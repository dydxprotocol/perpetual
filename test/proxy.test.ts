import { expect, expectThrow } from './helpers/Expect';
import initializePerpetual from './helpers/initializePerpetual';
import { address } from '../src/lib/types';
import { ADDRESSES, INTEGERS } from '../src/lib/Constants';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';

perpetualDescribe('Proxy', initializePerpetual, (ctx: ITestContext) => {

  describe('initialize()', () => {
    it('succeeds', async () => {});

    it('fails to do a second time', async () => {
      await expectThrow(
        ctx.perpetual.proxy.initialize(
          ADDRESSES.ZERO,
          ADDRESSES.ZERO,
          ADDRESSES.ZERO,
          INTEGERS.ZERO,
          { from: ctx.accounts[0] },
        ),
      );
    });
  });

  describe('changeAdmin()', () => {
    it('starts on account 0', async () => {
      await expectAdmin(ctx.accounts[0]);
    });

    it('succeeds', async () => {
      await ctx.perpetual.proxy.changeAdmin(ctx.accounts[1], { from: ctx.accounts[0] });
      await expectAdmin(ctx.accounts[1]);
    });

    it('succeeds twice', async () => {
      await ctx.perpetual.proxy.changeAdmin(ctx.accounts[1], { from: ctx.accounts[0] });
      await expectAdmin(ctx.accounts[1]);
      await ctx.perpetual.proxy.changeAdmin(ctx.accounts[2], { from: ctx.accounts[1] });
      await expectAdmin(ctx.accounts[2]);
    });

    it('fails to do a second time', async () => {
      await ctx.perpetual.proxy.changeAdmin(ctx.accounts[1], { from: ctx.accounts[0] });
      await expectAdmin(ctx.accounts[1]);
      await expectThrow(
        ctx.perpetual.proxy.changeAdmin(ctx.accounts[2], { from: ctx.accounts[0] }),
      );
    });
  });

  describe('upgradeTo()', () => {
    // TODO
  });

  describe('upgradeToAndCall()', () => {
    // TODO
  });

  async function expectAdmin(address: address) {
    const currentAdmin = await ctx.perpetual.proxy.getAdmin({ from: address });
    expect(currentAdmin).to.equal(address);
  }
});
