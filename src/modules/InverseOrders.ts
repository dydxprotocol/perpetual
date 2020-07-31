import BigNumber from 'bignumber.js';
import Web3 from 'web3';

import {
  Balance,
  BigNumberable,
  Fee,
  Order,
  Price,
} from '../lib/types';
import { Contracts } from './Contracts';
import { Orders } from './Orders';

const EIP712_DOMAIN_NAME = 'P1InverseOrders';

/**
 * Module for handling orders in an inverse perpetual market.
 *
 * Inverse perpetual:
 * - When isBuy is true, the maker is buying base currency (margin) and selling quote (position).
 * - The fill amount is denoted in quote currency (position).
 * - Prices are denoted in quote currency per unit of base currency (position per margin).
 * - The fee is paid (or received) in base currency (margin).
 */
export class InverseOrders extends Orders {
  constructor(
    contracts: Contracts,
    web3: Web3,
  ) {
    super(contracts, web3, EIP712_DOMAIN_NAME, contracts.p1InverseOrders);
  }

  /**
   * Estimate the maker's collateralization after executing a sequence of orders.
   *
   * The `maker` of every order must be the same. This function does not make any on-chain calls,
   * so all information must be passed in, including the oracle price and remaining amounts
   * on the orders. Orders are assumed to be filled at the limit price and limit fee.
   *
   * Returns the ending collateralization ratio for the account, or BigNumber(Infinity) if the
   * account does not end with any negative balances.
   *
   * @param  initialBalance  The initial margin and position balances of the maker account.
   * @param  oraclePrice     The price at which to calculate collateralization.
   * @param  orders          A sequence of orders, with the same maker, to be hypothetically filled.
   * @param  fillAmounts     The corresponding fill amount for each order, denominated in the token
   *                         spent by the maker--quote currency when buying, and base when selling.
   */
  public getAccountCollateralizationAfterMakingOrders(
    initialBalance: Balance,
    oraclePrice: Price,
    orders: Order[],
    makerTokenFillAmounts: BigNumber[],
  ): BigNumber {
    const runningBalance: Balance = initialBalance.copy();

    // For each order, determine the effect on the balance by following the smart contract math.
    for (let i = 0; i < orders.length; i += 1) {
      const order = orders[i];

      const fillAmount = order.isBuy
        ? makerTokenFillAmounts[i]
        : makerTokenFillAmounts[i].times(order.limitPrice.value);

      // Assume orders are filled at the limit price and limit fee.
      const { marginDelta, positionDelta } = this.getBalanceUpdatesAfterFillingOrder(
        fillAmount,
        order.limitPrice,
        order.limitFee,
        order.isBuy,
      );

      runningBalance.margin = runningBalance.margin.plus(marginDelta);
      runningBalance.position = runningBalance.position.plus(positionDelta);
    }

    return runningBalance.getCollateralization(oraclePrice);
  }

  /**
   * Calculate the effect of filling an order on the maker's balances.
   */
  public getBalanceUpdatesAfterFillingOrder(
    fillAmount: BigNumberable,
    fillPrice: Price,
    fillFee: Fee,
    isBuy: boolean,
  ): {
    marginDelta: BigNumber,
    positionDelta: BigNumber,
  } {
    const positionAmount = new BigNumber(fillAmount).dp(0, BigNumber.ROUND_DOWN);
    const feeFactor = (isBuy ? fillFee.negated() : fillFee).value.plus(1);
    const marginAmount = positionAmount
      .times(feeFactor)
      .dividedBy(fillPrice.value)
      .dp(0, BigNumber.ROUND_DOWN);
    return {
      marginDelta: isBuy ? marginAmount : marginAmount.negated(),
      positionDelta: isBuy ? positionAmount.negated() : positionAmount,
    };
  }

  public getFeeForOrder(
    amount: BigNumber,
    isTaker: boolean = true,
  ): Fee {
    if (!isTaker) {
      return Fee.fromBips('-2.5');
    }

    // WETH-PUSD: Small order size is 1000 USD.
    //
    // TODO: Address fees more generally on a per-market basis.
    const isSmall = amount.lt('1000e6');
    return isSmall
      ? Fee.fromBips('50.0')
      : Fee.fromBips('7.5');
  }
}
