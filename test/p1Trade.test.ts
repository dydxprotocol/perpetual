import BigNumber from 'bignumber.js';
import _ from 'lodash';

import { expect, expectBN, expectThrow } from './helpers/Expect';
import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import { expectBalances, mintAndDeposit } from './helpers/balances';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { buy, sell } from './helpers/trade';
import { ADDRESSES, INTEGERS } from '../src/lib/Constants';
import { address } from '../src/lib/types';

const depositAmount = new BigNumber('1e18');
const positionAmount = new BigNumber('1e16');

let maker: address;
let taker: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializeWithTestContracts(ctx);
  maker = ctx.accounts[2];
  taker = ctx.accounts[3];

  // Set up initial balances.
  await Promise.all([
    mintAndDeposit(ctx, maker, depositAmount),
    mintAndDeposit(ctx, taker, depositAmount),
  ]);
}

perpetualDescribe('P1Trade', init, (ctx: ITestContext) => {

  describe('trade()', () => {

    it('executes a buy', async () => {
      const marginAmount = depositAmount.div(2);
      const txResult = await buy(ctx, taker, maker, positionAmount, marginAmount);

      await expectBalances(
        ctx,
        [maker, taker],
        [depositAmount.plus(marginAmount), depositAmount.minus(marginAmount)],
        [positionAmount.negated(), positionAmount],
      );

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(2);
      const [indexUpdatedLog, tradeLog] = logs;
      expect(indexUpdatedLog.name).to.equal('LogIndexUpdated');
      expect(tradeLog.name).to.equal('LogTrade');
      expect(tradeLog.args.maker).to.equal(maker);
      expect(tradeLog.args.taker).to.equal(taker);
      expect(tradeLog.args.trader).to.equal(ctx.perpetual.testing.trader.address);
      expectBN(tradeLog.args.marginAmount).to.eq(marginAmount);
      expectBN(tradeLog.args.positionAmount).to.eq(positionAmount);
      expect(tradeLog.args.isBuy).to.eq(true);
    });

    it('executes a sell', async () => {
      const marginAmount = depositAmount.div(2);
      const txResult = await sell(ctx, taker, maker, positionAmount, marginAmount);

      await expectBalances(
        ctx,
        [maker, taker],
        [depositAmount.minus(marginAmount), depositAmount.plus(marginAmount)],
        [positionAmount, positionAmount.negated()],
      );

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(2);
      const [indexUpdatedLog, tradeLog] = logs;
      expect(indexUpdatedLog.name).to.equal('LogIndexUpdated');
      expect(tradeLog.name).to.equal('LogTrade');
      expect(tradeLog.args.maker).to.equal(maker);
      expect(tradeLog.args.taker).to.equal(taker);
      expect(tradeLog.args.trader).to.equal(ctx.perpetual.testing.trader.address);
      expectBN(tradeLog.args.marginAmount).to.eq(marginAmount);
      expectBN(tradeLog.args.positionAmount).to.eq(positionAmount);
      expect(tradeLog.args.isBuy).to.eq(false);
    });

    it('does not execute a trade if maker is equal to taker', async () => {
      const txResult = await buy(ctx, taker, taker, positionAmount, depositAmount.div(2));

      await expectBalances(
        ctx,
        [maker, taker],
        [depositAmount, depositAmount],
        [INTEGERS.ZERO, INTEGERS.ZERO],
      );

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogIndexUpdated');
    });

    it('fails if the specified trader contract is not a global operator', async () => {
      await ctx.perpetual.admin.setGlobalOperator(
        ctx.perpetual.testing.trader.address,
        false,
        { from: ctx.accounts[0] },
      );
      await expectThrow(
        buy(ctx, taker, taker, positionAmount, depositAmount.div(2)),
        'trader is not global operator',
      );
    });

    it('fails if the maker index is out of bounds', async () => {
      await expectThrow(
        ctx.perpetual.contracts.send(
          ctx.perpetual.contracts.perpetualV1.methods.trade(
            [ADDRESSES.TEST[0], ADDRESSES.TEST[1]].sort(),
            [
              {
                makerIndex: 2,
                takerIndex: 0,
                trader: ctx.perpetual.testing.trader.address,
                data: '0x00',
              },
            ],
          ),
        ),
      );
    });

    it('fails if the taker index is out of bounds', async () => {
      await expectThrow(
        ctx.perpetual.contracts.send(
          ctx.perpetual.contracts.perpetualV1.methods.trade(
            [ADDRESSES.TEST[0], ADDRESSES.TEST[1]].sort(),
            [
              {
                makerIndex: 0,
                takerIndex: 2,
                trader: ctx.perpetual.testing.trader.address,
                data: '0x00',
              },
            ],
          ),
        ),
      );
    });
  });

  describe('_verifyAccounts()', () => {

    it('fails if the accounts array is empty', async () => {
      await expectThrow(
        ctx.perpetual.trade.trade(
          [], // accounts
          [], // tradeArgs
        ),
        'Accounts must have non-zero length',
      );
    });

    it('fails if the accounts are not sorted', async () => {
      await expectThrow(
        ctx.perpetual.contracts.send(
          ctx.perpetual.contracts.perpetualV1.methods.trade(
            [ADDRESSES.TEST[0], ADDRESSES.TEST[1]].sort().reverse(),
            [], // tradeArgs
          ),
        ),
        'Accounts must be sorted and unique',
      );
    });

    it('fails if the accounts are not unique', async () => {
      await expectThrow(
        ctx.perpetual.contracts.send(
          ctx.perpetual.contracts.perpetualV1.methods.trade(
            [ADDRESSES.TEST[0], ADDRESSES.TEST[0]],
            [], // tradeArgs
          ),
        ),
        'Accounts must be sorted and unique',
      );
    });
  });
});
