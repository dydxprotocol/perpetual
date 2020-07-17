import { Price } from '../src/lib/types';
import {
  expectBaseValueEqual,
  expectThrow,
} from './helpers/Expect';
import initializePerpetual from './helpers/initializePerpetual';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';

const oraclePrice = new Price(500.125);

async function init(ctx: ITestContext): Promise<void> {
  await initializePerpetual(ctx);
  await ctx.perpetual.testing.makerOracle.setPrice(oraclePrice);
  await ctx.perpetual.admin.setOracle(
    ctx.perpetual.contracts.p1OracleInverter.options.address,
    { from: ctx.accounts[0] },
  );
}

perpetualDescribe('P1OracleInverter', init, (ctx: ITestContext) => {

  describe('getPrice', () => {

    it('succeeds', async () => {
      // Price should be inverted and then multiplied by a factor of 0.01.
      const price = await ctx.perpetual.priceOracle.getPrice();
      expectBaseValueEqual(price, new Price('0.000019995001249687'));
    });

    it('fails if msg.sender is not the authorized reader', async () => {
      await expectThrow(
        ctx.perpetual.priceOracle.getPrice({ from: ctx.accounts[0] }),
        'P1OracleInverter: Sender not authorized to get price',
      );
    });

    it('fails if underlying oracle price is zero', async () => {
      await ctx.perpetual.testing.makerOracle.setPrice(new Price(0));
      await expectThrow(
        ctx.perpetual.priceOracle.getPrice(),
        'Oracle would return zero price',
      );
    });
  });
});
