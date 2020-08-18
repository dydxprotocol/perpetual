import { BaseValue, Price } from '../src/lib/types';
import { ADDRESSES } from '../src/lib/Constants';
import {
  expect,
  expectBaseValueEqual,
  expectThrow,
} from './helpers/Expect';
import initializePerpetual from './helpers/initializePerpetual';
import { ITestContext, perpetualDescribe } from './helpers/perpetualDescribe';

const oraclePrice = new Price(100);

async function init(ctx: ITestContext): Promise<void> {
  await Promise.all([
    initializePerpetual(
      ctx,
      { oracle: ctx.perpetual.contracts.p1MakerOracle.options.address },
    ),
    ctx.perpetual.testing.makerOracle.setPrice(oraclePrice),
  ]);
}

perpetualDescribe('P1MakerOracle', init, (ctx: ITestContext) => {

  describe('setRoute', () => {
    it('succeeds', async () => {
      const proxyAddress = ctx.perpetual.contracts.perpetualProxy.options.address;
      const makerOracleAddress = ctx.perpetual.testing.makerOracle.address;
      const nullAddress = ADDRESSES.ZERO;

      await ctx.perpetual.makerPriceOracle.setRoute(
        proxyAddress,
        nullAddress,
        { from: ctx.accounts[0] },
      );
      expect(await ctx.perpetual.makerPriceOracle.getRoute(proxyAddress)).to.eq(nullAddress);

      await ctx.perpetual.makerPriceOracle.setRoute(
        proxyAddress,
        makerOracleAddress,
        { from: ctx.accounts[0] },
      );
      expect(await ctx.perpetual.makerPriceOracle.getRoute(proxyAddress)).to.eq(makerOracleAddress);
    });

    it('fails if not owner', async () => {
      await expectThrow(
        ctx.perpetual.makerPriceOracle.setRoute(
          ADDRESSES.ZERO,
          ADDRESSES.ZERO,
          { from: ctx.accounts[9] },
        ),
        'Ownable: caller is not the owner',
      );
    });
  });

  describe('setAdjustment', () => {
    it('succeeds', async () => {
      await ctx.perpetual.makerPriceOracle.setAdjustment(
        ctx.perpetual.testing.makerOracle.address,
        new BaseValue(0),
        { from: ctx.accounts[0] },
      );
      const price0 = await ctx.perpetual.priceOracle.getPrice();

      await ctx.perpetual.makerPriceOracle.setAdjustment(
        ctx.perpetual.testing.makerOracle.address,
        new BaseValue(1),
        { from: ctx.accounts[0] },
      );
      const price1 = await ctx.perpetual.priceOracle.getPrice();

      await ctx.perpetual.makerPriceOracle.setAdjustment(
        ctx.perpetual.testing.makerOracle.address,
        new BaseValue(2),
        { from: ctx.accounts[0] },
      );
      const price2 = await ctx.perpetual.priceOracle.getPrice();

      expectBaseValueEqual(price0, oraclePrice);
      expectBaseValueEqual(price0, price1);
      expectBaseValueEqual(price1, price2.div(2));
    });

    it('fails if not owner', async () => {
      await expectThrow(
        ctx.perpetual.makerPriceOracle.setAdjustment(
          ADDRESSES.ZERO,
          new BaseValue(1),
          { from: ctx.accounts[9] },
        ),
        'Ownable: caller is not the owner',
      );
    });
  });

  describe('getPrice', () => {
    it('succeeds if valid', async () => {
      const price = await ctx.perpetual.priceOracle.getPrice();
      expectBaseValueEqual(price, oraclePrice);
    });

    it('fails if not valid', async () => {
      await ctx.perpetual.testing.makerOracle.setValidity(false);
      await expectThrow(
        ctx.perpetual.priceOracle.getPrice(),
        'Median/invalid-price-feed',
      );
    });

    it('fails if msg.sender is not PerpetualV1', async () => {
      await expectThrow(
        ctx.perpetual.priceOracle.getPrice({ from: ctx.accounts[0] }),
        'Sender not authorized to get price',
      );
    });

    it('fails if about to return zero', async () => {
      await ctx.perpetual.testing.makerOracle.setPrice(Price.fromSolidity(100));
      await ctx.perpetual.makerPriceOracle.setAdjustment(
        ctx.perpetual.testing.makerOracle.address,
        new BaseValue('0.001'),
        { from: ctx.accounts[0] },
      );
      await expectThrow(
        ctx.perpetual.priceOracle.getPrice(),
        'Oracle would return zero price',
      );
    });
  });
});
