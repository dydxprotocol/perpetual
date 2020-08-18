import { Price } from '../src/lib/types';
import {
  expectBaseValueEqual,
  expectThrow,
} from './helpers/Expect';
import initializePerpetual from './helpers/initializePerpetual';
import { ITestContext, perpetualDescribe } from './helpers/perpetualDescribe';

const aggregatorPrice = 1622490475;
const expectedOraclePrice = new Price('16.22490475');

async function init(ctx: ITestContext): Promise<void> {
  await initializePerpetual(
    ctx,
    { oracle: ctx.perpetual.contracts.p1ChainlinkOracle.options.address },
  );
  await ctx.perpetual.testing.chainlinkAggregator.setAnswer(aggregatorPrice);
}

perpetualDescribe('P1ChainlinkOracle', init, (ctx: ITestContext) => {

  describe('getPrice', () => {

    it('succeeds', async () => {
      const price = await ctx.perpetual.priceOracle.getPrice();
      expectBaseValueEqual(price, expectedOraclePrice);

      await ctx.perpetual.testing.chainlinkAggregator.setAnswer(aggregatorPrice + 1000);
      const price2 = await ctx.perpetual.priceOracle.getPrice();
      expectBaseValueEqual(price2, expectedOraclePrice.plus(1e-5));
    });

    it('fails if msg.sender is not the authorized reader', async () => {
      await expectThrow(
        ctx.perpetual.priceOracle.getPrice({ from: ctx.accounts[0] }),
        'P1ChainlinkOracle: Sender not authorized to get price',
      );
    });

    it('fails if aggregator returns zero', async () => {
      await ctx.perpetual.testing.chainlinkAggregator.setAnswer(0);
      await expectThrow(
        ctx.perpetual.priceOracle.getPrice(),
        'P1ChainlinkOracle: Invalid answer from aggregator',
      );
    });

    it('fails if aggregator returns a negative number', async () => {
      await ctx.perpetual.testing.chainlinkAggregator.setAnswer(-1);
      await expectThrow(
        ctx.perpetual.priceOracle.getPrice(),
        'P1ChainlinkOracle: Invalid answer from aggregator',
      );

      await ctx.perpetual.testing.chainlinkAggregator.setAnswer('-10000000000000000');
      await expectThrow(
        ctx.perpetual.priceOracle.getPrice(),
        'P1ChainlinkOracle: Invalid answer from aggregator',
      );
    });
  });
});
