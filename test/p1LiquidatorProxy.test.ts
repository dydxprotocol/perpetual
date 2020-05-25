import BigNumber from 'bignumber.js';
import _ from 'lodash';

import initializePerpetual from './helpers/initializePerpetual';
import { expectBalances, mintAndDeposit } from './helpers/balances';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { buy } from './helpers/trade';
import { expect, expectBN, expectBaseValueEqual, expectThrow } from './helpers/Expect';
import {
  BigNumberable,
  BaseValue,
  Price,
  TxResult,
  address,
} from '../src/lib/types';

const initialPrice = new Price(100);
const longUndercollateralizedPrice = new Price(52);
const longUnderwaterPrice = new Price(48);
const shortUndercollateralizedPrice = new Price(140);
const shortUnderwaterPrice = new Price(160);
const positionSize = new BigNumber(100);
const halfPosition = positionSize.div(2);
const ERROR_MAX_POSITION = 'Cannot liquidate if it would put liquidator past the specified maxPosition';

let admin: address;
let long: address;
let short: address;
let neutral: address;
let insuranceFund: address;
let rando: address;
let smallLong: address;
let smallShort: address;

interface LiquidateOptions {
  liquidator: address;
  liquidatee: address;
  sender?: address;
  isBuy: boolean;
  maxPosition: BigNumberable;
}

interface ExpectedLogOptions {
  liquidator: address;
  liquidatee: address;
  isBuy: boolean;
  feeAmount: BigNumberable;
  liquidationAmount: BigNumberable;
}

async function init(ctx: ITestContext): Promise<void> {
  await initializePerpetual(ctx);
  admin = ctx.accounts[0];
  long = ctx.accounts[1];
  short = ctx.accounts[2];
  neutral = ctx.accounts[3];
  insuranceFund = ctx.accounts[4];
  rando = ctx.accounts[5];
  smallLong = ctx.accounts[6];
  smallShort = ctx.accounts[7];

  // Set up initial balances:
  // +------------+--------+----------+-------------------+
  // | account    | margin | position | collateralization |
  // |------------+--------+----------+-------------------|
  // | long       |  -5000 |      100 |              200% |
  // | short      |  15000 |     -100 |              150% |
  // | smallLong  |      0 |       50 |              INF% |
  // | smallShort |  10000 |      -50 |              200% |
  // | netral     |  20000 |        0 |              INF% |
  // +------------+--------+----------+-------------------+
  await Promise.all([
    ctx.perpetual.testing.oracle.setPrice(initialPrice),
    ctx.perpetual.liquidatorProxy.setInsuranceFund(insuranceFund, { from: admin }),
    ctx.perpetual.liquidatorProxy.approveMaximumOnPerpetual(),
    mintAndDeposit(ctx, long, new BigNumber(5000)),
    mintAndDeposit(ctx, short, new BigNumber(5000)),
    mintAndDeposit(ctx, smallLong, new BigNumber(5000)),
    mintAndDeposit(ctx, smallShort, new BigNumber(5000)),
    mintAndDeposit(ctx, neutral, new BigNumber(20000)),
  ]);
  await buy(ctx, long, short, positionSize, positionSize.times(initialPrice.value));
  await buy(ctx, smallLong, smallShort, 50, new BigNumber(50).times(initialPrice.value));

  // Check initial balances
  const [
    longBal,
    shortBal,
    smallLongBal,
    smallShortBal,
    neutralBal,
  ] = await Promise.all([
    ctx.perpetual.getters.getAccountBalance(long),
    ctx.perpetual.getters.getAccountBalance(short),
    ctx.perpetual.getters.getAccountBalance(smallLong),
    ctx.perpetual.getters.getAccountBalance(smallShort),
    ctx.perpetual.getters.getAccountBalance(neutral),
  ]);
  expectBN(longBal.margin).to.equal(-5000);
  expectBN(shortBal.margin).to.equal(15000);
  expectBN(smallLongBal.margin).to.equal(0);
  expectBN(smallShortBal.margin).to.equal(10000);
  expectBN(neutralBal.margin).to.equal(20000);
  expectBN(longBal.position).to.equal(positionSize);
  expectBN(shortBal.position).to.equal(positionSize.negated());
  expectBN(smallLongBal.position).to.equal(halfPosition);
  expectBN(smallShortBal.position).to.equal(halfPosition.negated());
  expectBN(neutralBal.position).to.equal(0);
}

perpetualDescribe('P1LiquidatorProxy', init, (ctx: ITestContext) => {
  describe('setInsuranceFund()', () => {
    it('Succeeds', async () => {
      await ctx.perpetual.liquidatorProxy.setInsuranceFund(
        rando,
        { from: admin },
      );
      const newInsuranceFund = await ctx.perpetual.liquidatorProxy.getInsuranceFund();
      expect(newInsuranceFund).to.equal(rando);
    });

    it('Fails for non-owner', async () => {
      await expectThrow(
        ctx.perpetual.liquidatorProxy.setInsuranceFund(
          rando,
          { from: rando },
        ),
        'Ownable: caller is not the owner',
      );
    });
  });

  describe('setInsuranceFee()', () => {
    const newFee = new BaseValue(0.5);

    it('Succeeds', async () => {
      await ctx.perpetual.liquidatorProxy.setInsuranceFee(
        newFee,
        { from: admin },
      );
      const newInsuranceFee = await ctx.perpetual.liquidatorProxy.getInsuranceFee();
      expectBaseValueEqual(newInsuranceFee, newFee);
    });

    it('Fails to set above 50%', async () => {
      await expectThrow(
        ctx.perpetual.liquidatorProxy.setInsuranceFee(
          new BaseValue(0.51),
          { from: admin },
        ),
        'insuranceFee cannot be greater than 50%',
      );
    });

    it('Fails for non-owner', async () => {
      await expectThrow(
        ctx.perpetual.liquidatorProxy.setInsuranceFee(
          newFee,
          { from: rando },
        ),
        'Ownable: caller is not the owner',
      );
    });
  });

  describe('liquidate()', () => {
    describe('Basic Cases', () => {
      it('Succeeds partially liquidating a long position', async () => {
        const feeAmount = 10;

        await ctx.perpetual.testing.oracle.setPrice(longUndercollateralizedPrice);
        const txResult = await liquidate({
          liquidatee: long,
          liquidator: neutral,
          isBuy: true,
          maxPosition: halfPosition,
        });
        await expectFinalBalances(
          txResult,
          [long, neutral],
          [-2500, 17500 - feeAmount],
          [halfPosition, halfPosition],
          feeAmount,
        );
        expectLogs(txResult, {
          feeAmount,
          liquidatee: long,
          liquidator: neutral,
          isBuy: true,
          liquidationAmount: halfPosition,
        });
      });

      it('Succeeds partially liquidating a short position', async () => {
        const feeAmount = 50;

        await ctx.perpetual.testing.oracle.setPrice(shortUndercollateralizedPrice);
        const txResult = await liquidate({
          liquidatee: short,
          liquidator: neutral,
          isBuy: false,
          maxPosition: halfPosition.negated(),
        });
        await expectFinalBalances(
          txResult,
          [short, neutral],
          [7500, 27500 - feeAmount],
          [halfPosition.negated(), halfPosition.negated()],
          feeAmount,
        );
        expectLogs(txResult, {
          feeAmount,
          liquidatee: short,
          liquidator: neutral,
          isBuy: false,
          liquidationAmount: halfPosition,
        });
      });

      it('Succeeds fully liquidating an undercollateralized long position', async () => {
        const feeAmount = 20;

        await ctx.perpetual.testing.oracle.setPrice(longUndercollateralizedPrice);
        const txResult = await liquidate({
          liquidatee: long,
          liquidator: neutral,
          isBuy: true,
          maxPosition: positionSize,
        });
        await expectFinalBalances(
          txResult,
          [long, neutral],
          [0, 15000 - feeAmount],
          [0, positionSize],
          feeAmount,
        );
        expectLogs(txResult, {
          feeAmount,
          liquidatee: long,
          liquidator: neutral,
          isBuy: true,
          liquidationAmount: positionSize,
        });
      });

      it('Succeeds fully liquidating an undercollateralized short position', async () => {
        const feeAmount = 100;

        await ctx.perpetual.testing.oracle.setPrice(shortUndercollateralizedPrice);
        const txResult = await liquidate({
          liquidatee: short,
          liquidator: neutral,
          isBuy: false,
          maxPosition: positionSize.negated(),
        });
        await expectFinalBalances(
          txResult,
          [short, neutral],
          [0, 35000 - feeAmount],
          [0, positionSize.negated()],
          feeAmount,
        );
        expectLogs(txResult, {
          feeAmount,
          liquidatee: short,
          liquidator: neutral,
          isBuy: false,
          liquidationAmount: positionSize,
        });
      });

      it('Succeeds fully liquidating a long position using a high maxPositionSize', async () => {
        const feeAmount = 20;

        await ctx.perpetual.testing.oracle.setPrice(longUndercollateralizedPrice);
        const txResult = await liquidate({
          liquidatee: long,
          liquidator: neutral,
          isBuy: true,
          maxPosition: positionSize.times(2),
        });
        await expectFinalBalances(
          txResult,
          [long, neutral],
          [0, 15000 - feeAmount],
          [0, positionSize],
          feeAmount,
        );
        expectLogs(txResult, {
          feeAmount,
          liquidatee: long,
          liquidator: neutral,
          isBuy: true,
          liquidationAmount: positionSize,
        });
      });

      it('Succeeds fully liquidating a short position using a high maxPositionSize', async () => {
        const feeAmount = 100;

        await ctx.perpetual.testing.oracle.setPrice(shortUndercollateralizedPrice);
        const txResult = await liquidate({
          liquidatee: short,
          liquidator: neutral,
          isBuy: false,
          maxPosition: positionSize.negated().times(2),
        });
        await expectFinalBalances(
          txResult,
          [short, neutral],
          [0, 35000 - feeAmount],
          [0, positionSize.negated()],
          feeAmount,
        );
        expectLogs(txResult, {
          feeAmount,
          liquidatee: short,
          liquidator: neutral,
          isBuy: false,
          liquidationAmount: positionSize,
        });
      });

      it('Succeeds partially liquidating an underwater long position', async () => {
        const feeAmount = 0;

        await ctx.perpetual.testing.oracle.setPrice(longUnderwaterPrice);
        const txResult = await liquidate({
          liquidatee: long,
          liquidator: neutral,
          isBuy: true,
          maxPosition: halfPosition,
        });
        await expectFinalBalances(
          txResult,
          [long, neutral],
          [-2500, 17500 - feeAmount],
          [halfPosition, halfPosition],
          feeAmount,
        );
        expectLogs(txResult, {
          feeAmount,
          liquidatee: long,
          liquidator: neutral,
          isBuy: true,
          liquidationAmount: halfPosition,
        });
      });

      it('Succeeds partially liquidating an underwater short position', async () => {
        const feeAmount = 0;

        await ctx.perpetual.testing.oracle.setPrice(shortUnderwaterPrice);
        const txResult = await liquidate({
          liquidatee: short,
          liquidator: neutral,
          isBuy: false,
          maxPosition: halfPosition.negated(),
        });
        await expectFinalBalances(
          txResult,
          [short, neutral],
          [7500, 27500 - feeAmount],
          [halfPosition.negated(), halfPosition.negated()],
          feeAmount,
        );
        expectLogs(txResult, {
          feeAmount,
          liquidatee: short,
          liquidator: neutral,
          isBuy: false,
          liquidationAmount: halfPosition,
        });
      });
    });

    describe('Account Permissions', () => {
      it('Succeeds for localOperator', async () => {
        const feeAmount = 10;

        await Promise.all([
          ctx.perpetual.operator.setLocalOperator(rando, true, { from: neutral }),
          ctx.perpetual.testing.oracle.setPrice(longUndercollateralizedPrice),
        ]);
        const txResult = await liquidate({
          liquidatee: long,
          liquidator: neutral,
          sender: rando,
          isBuy: true,
          maxPosition: halfPosition,
        });
        await expectFinalBalances(
          txResult,
          [long, neutral],
          [-2500, 17500 - feeAmount],
          [halfPosition, halfPosition],
          feeAmount,
        );
        expectLogs(txResult, {
          feeAmount,
          liquidatee: long,
          liquidator: neutral,
          isBuy: true,
          liquidationAmount: halfPosition,
        });
      });

      it('Succeeds for globalOperator', async () => {
        const feeAmount = 10;

        await Promise.all([
          ctx.perpetual.admin.setGlobalOperator(rando, true, { from: admin }),
          ctx.perpetual.testing.oracle.setPrice(longUndercollateralizedPrice),
        ]);
        const txResult = await liquidate({
          liquidatee: long,
          liquidator: neutral,
          sender: rando,
          isBuy: true,
          maxPosition: halfPosition,
        });
        await expectFinalBalances(
          txResult,
          [long, neutral],
          [-2500, 17500 - feeAmount],
          [halfPosition, halfPosition],
          feeAmount,
        );
        expectLogs(txResult, {
          feeAmount,
          liquidatee: long,
          liquidator: neutral,
          isBuy: true,
          liquidationAmount: halfPosition,
        });
      });

      it('Fails for random account', async () => {
        await expectThrow(
          liquidate({
            liquidatee: long,
            liquidator: neutral,
            sender: rando,
            isBuy: true,
            maxPosition: halfPosition,
          }),
          'msg.sender cannot operate the liquidator account',
        );
      });
    });

    describe('Failures', () => {
      it('Fails if isBuy=true for a short', async () => {
        await expectThrow(
          liquidate({
            liquidatee: short,
            liquidator: neutral,
            isBuy: true,
            maxPosition: -50,
          }),
          ERROR_MAX_POSITION,
        );
      });

      it('Fails if isBuy=false for a long', async () => {
        await expectThrow(
          liquidate({
            liquidatee: long,
            liquidator: neutral,
            isBuy: false,
            maxPosition: 50,
          }),
          ERROR_MAX_POSITION,
        );
      });

      it('Fails if already at maxPosition for a long', async () => {
        await expectThrow(
          liquidate({
            liquidatee: long,
            liquidator: short,
            isBuy: true,
            maxPosition: positionSize.negated(),
          }),
          ERROR_MAX_POSITION,
        );
        await expectThrow(
          liquidate({
            liquidatee: long,
            liquidator: neutral,
            isBuy: true,
            maxPosition: 0,
          }),
          ERROR_MAX_POSITION,
        );
        await expectThrow(
          liquidate({
            liquidatee: long,
            liquidator: smallLong,
            isBuy: true,
            maxPosition: halfPosition,
          }),
          ERROR_MAX_POSITION,
        );
      });

      it('Fails if already at maxPosition for a short', async () => {
        await expectThrow(
          liquidate({
            liquidatee: short,
            liquidator: long,
            isBuy: false,
            maxPosition: positionSize,
          }),
          ERROR_MAX_POSITION,
        );
        await expectThrow(
          liquidate({
            liquidatee: short,
            liquidator: neutral,
            isBuy: false,
            maxPosition: 0,
          }),
          ERROR_MAX_POSITION,
        );
        await expectThrow(
          liquidate({
            liquidatee: short,
            liquidator: smallShort,
            isBuy: false,
            maxPosition: halfPosition.negated(),
          }),
          ERROR_MAX_POSITION,
        );
      });

      it('Fails if already past maxPosition for a long', async () => {
        await expectThrow(
          liquidate({
            liquidatee: long,
            liquidator: short,
            isBuy: true,
            maxPosition: positionSize.negated().minus(1),
          }),
          ERROR_MAX_POSITION,
        );
        await expectThrow(
          liquidate({
            liquidatee: long,
            liquidator: neutral,
            isBuy: true,
            maxPosition: -1,
          }),
          ERROR_MAX_POSITION,
        );
        await expectThrow(
          liquidate({
            liquidatee: long,
            liquidator: smallLong,
            isBuy: true,
            maxPosition: halfPosition.minus(1),
          }),
          ERROR_MAX_POSITION,
        );
      });

      it('Fails if already past maxPosition for a short', async () => {
        await expectThrow(
          liquidate({
            liquidatee: short,
            liquidator: long,
            isBuy: false,
            maxPosition: positionSize.plus(1),
          }),
          ERROR_MAX_POSITION,
        );
        await expectThrow(
          liquidate({
            liquidatee: short,
            liquidator: neutral,
            isBuy: false,
            maxPosition: 1,
          }),
          ERROR_MAX_POSITION,
        );
        await expectThrow(
          liquidate({
            liquidatee: short,
            liquidator: smallShort,
            isBuy: false,
            maxPosition: halfPosition.negated().plus(1),
          }),
          ERROR_MAX_POSITION,
        );
      });
    });

    it('Succeeds even if the insurance fund is undercollateralized', async () => {
      await Promise.all([
        mintAndDeposit(ctx, insuranceFund, new BigNumber(20000)),
        mintAndDeposit(ctx, rando, new BigNumber(20000)),
      ]);
      await buy(
        ctx,
        insuranceFund,
        rando,
        positionSize.times(4),
        positionSize.times(4).times(initialPrice.value),
      );

      await ctx.perpetual.testing.oracle.setPrice(longUndercollateralizedPrice);
      expect(await ctx.perpetual.getters.getNetAccountIsLiquidatable(insuranceFund)).to.be.true;

      const feeAmount = 20;
      const txResult = await liquidate({
        liquidatee: long,
        liquidator: neutral,
        isBuy: true,
        maxPosition: positionSize,
      });
      await expectFinalBalances(
        txResult,
        [long, neutral, insuranceFund],
        [0, 15000 - feeAmount, -20000 + feeAmount],
        [0, positionSize, positionSize.times(4)],
      );
      expectLogs(txResult, {
        feeAmount,
        liquidatee: long,
        liquidator: neutral,
        isBuy: true,
        liquidationAmount: positionSize,
      });

      expect(await ctx.perpetual.getters.getNetAccountIsLiquidatable(insuranceFund)).to.be.true;
    });
  });

  async function liquidate(options?: LiquidateOptions) {
    return ctx.perpetual.liquidatorProxy.liquidate(
      options.liquidatee,
      options.liquidator,
      options.isBuy,
      new BigNumber(options.maxPosition),
      { from: options.sender || options.liquidator },
    );
  }

  function expectLogs(
    txResult: TxResult,
    expected: ExpectedLogOptions,
  ): void {
    const logs = ctx.perpetual.logs.parseLogs(txResult);
    const filteredLogs = _.filter(logs, { name: 'LogLiquidatorProxyUsed' });
    expect(filteredLogs.length).to.equal(1);
    const log = filteredLogs[0];
    expect(log.args.liquidatee).to.equal(expected.liquidatee);
    expect(log.args.liquidator).to.equal(expected.liquidator);
    expectBN(log.args.liquidationAmount).to.equal(expected.liquidationAmount);
    expect(log.args.isBuy).to.equal(expected.isBuy);
    expectBN(log.args.feeAmount).to.equal(expected.feeAmount);
  }

  async function expectFinalBalances(
    txResult: TxResult,
    accounts: address[],
    expectedMargins: BigNumberable[],
    expectedPositions: BigNumberable[],
    feeAmount?: BigNumberable,
  ): Promise<void> {
    const allAccounts = [...accounts];
    const allMargins = [...expectedMargins];
    const allPositions = [...expectedPositions];
    if (feeAmount) {
      allAccounts.push(insuranceFund);
      allMargins.push(feeAmount);
      allPositions.push(0);
    }
    return expectBalances(
      ctx,
      txResult,
      allAccounts,
      allMargins,
      allPositions,
      false,
      false,
    );
  }
});
