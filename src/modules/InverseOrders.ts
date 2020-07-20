import BigNumber from 'bignumber.js';
import Web3 from 'web3';

import {
  BigNumberable,
  Fee,
  Price,
} from '../lib/types';
import { Contracts } from './Contracts';
import { Orders } from './Orders';

const EIP712_DOMAIN_NAME = 'P1InverseOrders';

export class InverseOrders extends Orders {
  constructor(
    contracts: Contracts,
    web3: Web3,
  ) {
    super(contracts, web3, EIP712_DOMAIN_NAME, contracts.p1InverseOrders);
  }

  /**
   * Calculate the effect of filling an order on the maker's balances.
   *
   * Inverse perpetual:
   * - When isBuy is true, the maker is buying base currency (margin) and selling position.
   * - The fill amount is denoted in margin and price is denoted in position per margin.
   * - The fee is paid (or received) in margin and denoted in position per margin.
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
    const amount = new BigNumber(fillAmount);
    const feeFactor = (isBuy ? fillFee.negated() : fillFee).value.plus(1);
    const marginAmount = amount.times(feeFactor);
    const positionAmount = amount.times(fillPrice.value);
    const marginDelta = isBuy ? marginAmount : marginAmount.negated();
    const positionDelta = isBuy ? positionAmount.negated() : positionAmount;
    return {
      marginDelta,
      positionDelta,
    };
  }
}
