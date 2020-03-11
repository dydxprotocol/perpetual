import BigNumber from 'bignumber.js';
import _ from 'lodash';

import { expectThrow } from './helpers/Expect';
import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import { expectBalances, mintAndDeposit } from './helpers/balances';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { INTEGERS } from '../src/lib/Constants';
import { BigNumberable, Price, TxResult, address, TradeArg } from '../src/lib/types';
import { TRADER_FLAG_RESULT_2 } from '../src/testing/TestP1Trader';

// Use a large gas value. Had “out of gas” errors with some expectFailure() calls.
const TX_OPTIONS = { gas: 4000000 };

const MIN_COLLATERAL = new BigNumber('1.1');

let ERROR_NON_POSITIVE = 'account has no positive value';
let ERROR_POSITION_SIZE = 'account is undercollateralized and absolute position size increased';
let ERROR_POSITION_SIGN = 'account is undercollateralized and position changed signs';
let ERROR_NEWLY_UNDERCOLLATERLIZED = 'account is undercollateralized and was not previously';
let ERROR_COLLATERALIZATION_DECREASED = 'account is undercollateralized and collateralization decreased';

const depositAmount = new BigNumber('1e18');
const oraclePrice = new Price('10');

// [margin, position] pairs used in the test cases, based on the oracle price.
type Balance = [BigNumberable, BigNumberable];
const borderlinePos: Balance = ['-10000', '1100'];
const borderlineNeg: Balance = ['12100', '-1100'];
const undercollateralizedPos: Balance = ['-10000', '1099'];
const undercollateralizedNeg: Balance = ['12099', '-1100'];

let maker: address;
let riskyAccount: address;
let errorAddress: string;

async function init(ctx: ITestContext): Promise<void> {
  await initializeWithTestContracts(ctx);
  maker = ctx.accounts[2];
  riskyAccount = ctx.accounts[3];

  errorAddress = `: ${riskyAccount.substr(0, 10)}...${riskyAccount.substr(-8)}`.toLowerCase();
  ERROR_NON_POSITIVE += errorAddress;
  ERROR_POSITION_SIZE += errorAddress;
  ERROR_POSITION_SIGN += errorAddress;
  ERROR_NEWLY_UNDERCOLLATERLIZED += errorAddress;
  ERROR_COLLATERALIZATION_DECREASED += errorAddress;

  await mintAndDeposit(ctx, maker, depositAmount),
  await ctx.perpetual.testing.oracle.setPrice(oraclePrice);
}

/**
 * Test cases for _verifyAccountsFinalBalances().
 *
 * In each test case we execute one or more trades between `maker` and `riskyAccount`. We put
 * `riskyAccount` in different initial and final states, and check whether the state change
 * passes verification. The `maker` account should have enough funds to pass the check every time.
 */
perpetualDescribe('P1Trade._verifyAccountsFinalBalances()', init, (ctx: ITestContext) => {

  it('sanity check the helper function', async () => {
    const cases = [
      ['0', '0'],
      ['-123456789', '1234567890000000'],
      ['98765', '-123'],
      ['-123456789', '1234567890000000'],
      ['98765', '-123'],
      ['0', '0'],
    ];
    for (const [margin, position] of cases) {
      const txResult = await tradeToState([margin, position]);
      await expectBalances(ctx, txResult, [riskyAccount], [margin], [position], false, false);
    }
  });

  describe('[0/0, -/+, +/-, +/+] when initial state is well-collateralized', async () => {

    // Well-collateralized initial states [initialMagin, initialPosition]
    const wcStates: Balance[] = [
      ['0', '0'],
      borderlinePos,
      borderlineNeg,
      ['1234567890000000', '1234567890000000'],
    ];

    it('[-> 0/0, 0/+, +/0, +/+] succeeds if final state is well-collateralized', async () => {
      await expectSuccesses(
        wcStates,
        [
          [INTEGERS.ZERO, INTEGERS.ZERO],
          [INTEGERS.ZERO, INTEGERS.ONE],
          [INTEGERS.ONE, INTEGERS.ZERO],
          [INTEGERS.ONE, INTEGERS.ONE],
        ],
      );
    });

    it('[-> 0/-, -/0, -/-] fails if final state is undercollateralized', async () => {
      const minusOne = INTEGERS.ONE.negated();
      await expectFailures(
        wcStates,
        [
          [INTEGERS.ZERO, minusOne],
          [minusOne, INTEGERS.ZERO],
          [minusOne, minusOne],
        ],
        ERROR_NON_POSITIVE,
      );
    });

    it('[-> -/+] succeeds if final state is well-collateralized', async () => {
      await expectSuccesses(wcStates, [borderlinePos]);
    });

    it('[-> -/+] fails if final state is undercollateralized', async () => {
      await expectFailure(undercollateralizedPos, ERROR_POSITION_SIZE);
      await tradeToState(wcStates[1]);
      await expectFailure(undercollateralizedPos, ERROR_COLLATERALIZATION_DECREASED);
      await tradeToState(wcStates[2]);
      await expectFailure(undercollateralizedPos, ERROR_POSITION_SIGN);
      await tradeToState(wcStates[3]);
      await expectFailure(undercollateralizedPos, ERROR_NEWLY_UNDERCOLLATERLIZED);
    });

    it('[-> +/-] succeeds if final state is well-collateralized', async () => {
      await expectSuccesses(wcStates, [borderlineNeg]);
    });

    it('[-> +/-] fails if final state is undercollateralized', async () => {
      await expectFailure(undercollateralizedNeg, ERROR_POSITION_SIZE);
      await tradeToState(wcStates[1]);
      await expectFailure(undercollateralizedNeg, ERROR_POSITION_SIGN);
      await tradeToState(wcStates[2]);
      await expectFailure(undercollateralizedNeg, ERROR_COLLATERALIZATION_DECREASED);
      await tradeToState(wcStates[3]);
      await expectFailure(undercollateralizedNeg, ERROR_POSITION_SIGN);
    });
  });

  describe('[-/+] when initial state is undercollateralized, positive position', async () => {
    it('[-> 0/0, 0/+, +/0, +/+] succeeds if final state is well-collateralized', async () => {
      await expectSuccesses(
        [undercollateralizedPos],
        [
          [INTEGERS.ZERO, INTEGERS.ZERO],
          [INTEGERS.ZERO, INTEGERS.ONE],
          [INTEGERS.ONE, INTEGERS.ZERO],
          [INTEGERS.ONE, INTEGERS.ONE],
        ],
      );
    });

    it('[-> 0/-, -/0, -/-] fails if final state is undercollateralized', async () => {
      const minusOne = INTEGERS.ONE.negated();
      await expectFailures(
        [undercollateralizedPos],
        [
          [INTEGERS.ZERO, minusOne],
          [minusOne, INTEGERS.ZERO],
          [minusOne, minusOne],
        ],
        ERROR_NON_POSITIVE,
      );
    });

    it('[-> -/+, +/-] succeeds if final state is well-collateralized', async () => {
      await expectSuccesses(
        [undercollateralizedPos],
        [
          borderlinePos,
          borderlineNeg,
        ],
      );
    });

    describe('[-> -/+, +/-] when final state is undercollateralized', () => {
      // Initial state is heavily underwater.
      const margin = new BigNumber('-1000000');
      const position = new BigNumber('1000');

      beforeEach(async () => {
        // Same initial state in each case.
        await tradeToInitialState([margin, position]);
      });

      it('fails if collateralizaion worsens', async () => {
        await Promise.all([
          expectFailure([margin.minus(1), position], ERROR_COLLATERALIZATION_DECREASED),
          expectFailure([margin, position.minus(1)], ERROR_COLLATERALIZATION_DECREASED),
        ]);
      });

      it('fails if absolute position size increases', async () => {
        await expectFailure([margin, position.plus(1)], ERROR_POSITION_SIZE);
      });

      it('fails if position sign changes', async () => {
        await expectFailure([new BigNumber(100), position.negated()], ERROR_POSITION_SIGN);
      });

      it('succeeds if balances stay the same', async () => {
        await expectSuccess([margin, position]);
      });

      it('succeeds if collateralizaion stays the same and position is reduced', async () => {
        await expectSuccess([margin.times('0.9'), position.times('0.9')]);
      });

      it('succeeds if collateralizaion improves and position is reduced', async () => {
        await expectSuccess([margin.times('0.9'), position.minus(1)]);
      });
    });
  });

  describe('[+/-] when initial state is undercollateralized, negative position', async () => {
    it('[-> 0/0, 0/+, +/0, +/+] succeeds if final state is well-collateralized', async () => {
      await expectSuccesses(
        [undercollateralizedNeg],
        [
          [INTEGERS.ZERO, INTEGERS.ZERO],
          [INTEGERS.ZERO, INTEGERS.ONE],
          [INTEGERS.ONE, INTEGERS.ZERO],
          [INTEGERS.ONE, INTEGERS.ONE],
        ],
      );
    });

    it('[-> 0/-, -/0, -/-] fails if final state is undercollateralized', async () => {
      const minusOne = INTEGERS.ONE.negated();
      await expectFailures(
        [undercollateralizedNeg],
        [
          [INTEGERS.ZERO, minusOne],
          [minusOne, INTEGERS.ZERO],
          [minusOne, minusOne],
        ],
        ERROR_NON_POSITIVE,
      );
    });

    it('[-> -/+, +/-] succeeds if final state is well-collateralized', async () => {
      await expectSuccesses(
        [undercollateralizedNeg],
        [
          borderlinePos,
          borderlineNeg,
        ],
      );
    });

    describe('[-> -/+, +/-] when final state is undercollateralized', () => {
      // Initial state is heavily underwater.
      const margin = new BigNumber('1000');
      const position = new BigNumber('-10000');

      beforeEach(async () => {
        // Same initial state in each case.
        await tradeToInitialState([margin, position]);
      });

      it('fails if collateralizaion worsens', async () => {
        await expectFailure([margin.minus(1), position], ERROR_COLLATERALIZATION_DECREASED);
      });

      it('fails if absolute position size increases', async () => {
        await expectFailure([margin, position.minus(1)], ERROR_POSITION_SIZE);
      });

      it('fails if position sign changes', async () => {
        await expectFailure([new BigNumber(-1000000), position.negated()], ERROR_POSITION_SIGN);
      });

      it('succeeds if balances stay the same', async () => {
        await expectSuccess([margin, position]);
      });

      it('succeeds if collateralizaion stays the same and position is reduced', async () => {
        await expectSuccess([margin.times('0.9'), position.times('0.9')]);
      });

      it('succeeds if collateralizaion improves and position is reduced', async () => {
        await expectSuccess([margin.times('1.1'), position.plus(1)]);
      });
    });
  });

  // ============ Helper Functions ============

  async function expectSuccesses(
    initialCases: Balance[],
    finalCases: Balance[],
  ): Promise<void> {
    for (const [initialMargin, initialPosition] of initialCases) {
      for (const [finalMargin, finalPosition] of finalCases) {
        await tradeToInitialState([initialMargin, initialPosition]);
        await expectSuccess([finalMargin, finalPosition]);
      }
    }
  }

  async function expectFailures(
    initialCases: Balance[],
    finalCases: Balance[],
    message: string,
  ): Promise<void> {
    for (const [initialMargin, initialPosition] of initialCases) {
      await tradeToInitialState([initialMargin, initialPosition]);

      // Failures can be run in parallel.
      await Promise.all(_.map(finalCases, ([finalMargin, finalPosition]) => {
        return expectFailure([finalMargin, finalPosition], message);
      }));
    }
  }

  async function expectSuccess(
    [finalMargin, finalPosition]: Balance,
  ): Promise<TxResult> {
    return tradeToState([finalMargin, finalPosition]);
  }

  async function expectFailure(
    [finalMargin, finalPosition]: Balance,
    message: string,
  ): Promise<void> {
    return expectThrow(tradeToState([finalMargin, finalPosition]), message);
  }

  /**
   * Wraps tradeToState() to allow entering an undercollateralized state.
   */
  async function tradeToInitialState(
    [finalMargin, finalPosition]: Balance,
  ): Promise<void> {
    const finalMarginBN = new BigNumber(finalMargin);
    const finalPositionBN = new BigNumber(finalPosition);

    if (finalMarginBN.isNegative() && finalPositionBN.isNegative()) {
      throw new Error('Invalid initial state: margin and position are both negative');
    }

    let undercollateralized = false;
    let temporaryOraclePrice: Price;
    if (finalMarginBN.isNegative()) {
      undercollateralized =
        finalPositionBN.times(oraclePrice.value) < finalMarginBN.times(MIN_COLLATERAL).abs();

      // If undercollateralized, temporarily set a very high oracle price.
      temporaryOraclePrice = new Price('10000000000000');
    } else if (finalPositionBN.isNegative()) {
      undercollateralized =
      finalPositionBN.times(oraclePrice.value).times(MIN_COLLATERAL).abs() > finalMarginBN;

      // If undercollateralized, temporarily set a very low oracle price.
      temporaryOraclePrice = new Price('0');
    }

    if (undercollateralized) {
      await ctx.perpetual.testing.oracle.setPrice(temporaryOraclePrice);
    }
    await tradeToState([finalMargin, finalPosition]);
    if (undercollateralized) {
      await ctx.perpetual.testing.oracle.setPrice(oraclePrice);
    }
  }

  /**
   * Creates one or more trades to bring `riskyAccount` to the specified final balances.
   */
  async function tradeToState(
    [finalMargin, finalPosition]: Balance,
  ): Promise<TxResult> {
    const { margin, position } = await ctx.perpetual.getters.getAccountBalance(riskyAccount);
    const marginDiff = new BigNumber(finalMargin).minus(margin);
    const positionDiff = new BigNumber(finalPosition).minus(position);
    await Promise.all([
      ctx.perpetual.testing.trader.setTradeResult(
        {
          isBuy: marginDiff.isNegative(),
          marginAmount: marginDiff.abs(),
          positionAmount: INTEGERS.ZERO,
          traderFlags: TRADER_FLAG_RESULT_2,
        },
        TX_OPTIONS,
      ),
      ctx.perpetual.testing.trader.setSecondTradeResult(
        {
          isBuy: positionDiff.isPositive(),
          marginAmount: INTEGERS.ZERO,
          positionAmount: positionDiff.abs(),
          traderFlags: TRADER_FLAG_RESULT_2,
        },
        TX_OPTIONS,
      ),
    ]);
    const accounts = _.chain([maker, riskyAccount]).map(_.toLower).sort().sortedUniq().value();
    const args: TradeArg = {
      makerIndex: accounts.indexOf(maker.toLowerCase()),
      takerIndex: accounts.indexOf(riskyAccount.toLowerCase()),
      trader: ctx.perpetual.testing.trader.address,
      data: '0x00',
    };
    return ctx.perpetual.trade.trade(accounts, [args, args], TX_OPTIONS);
  }
});
