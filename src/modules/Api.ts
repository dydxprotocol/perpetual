import { default as axios } from 'axios';
import BigNumber from 'bignumber.js';
import {
  ApiAccount,
  ApiFundingRates,
  ApiHistoricalFundingRates,
  ApiIndexPrice,
  ApiMarketMessage,
  ApiMarketName,
  ApiOptions,
  ApiOrder,
  ApiOrderOnOrderbook,
  ApiSide,
  BigNumberable,
  Fee,
  Order,
  Price,
  SignedOrder,
  SigningMethod,
  address,
  RequestMethod,
} from '../lib/types';
import { Orders } from './Orders';

const FOUR_WEEKS_IN_SECONDS = 60 * 60 * 24 * 28;
const DEFAULT_API_ENDPOINT = 'https://api.dydx.exchange';
const DEFAULT_API_TIMEOUT = 10000;

export class Api {
  private endpoint: String;
  private perpetualOrders: Orders;
  private timeout: number;

  constructor(
    perpetualOrders: Orders,
    apiOptions: ApiOptions = {},
  ) {
    this.endpoint = apiOptions.endpoint || DEFAULT_API_ENDPOINT;
    this.timeout = apiOptions.timeout || DEFAULT_API_TIMEOUT;
    this.perpetualOrders = perpetualOrders;
  }

  // ============ Managing Orders ============

  public async placePerpetualOrder({
    order: {
      side,
      amount,
      price,
      maker,
      taker,
      expiration = new BigNumber(FOUR_WEEKS_IN_SECONDS),
      limitFee,
      salt,
    },
    market,
    fillOrKill,
    postOnly,
    clientId,
    cancelId,
    cancelAmountOnRevert,
  }: {
    order: {
      side: ApiSide,
      amount: BigNumberable,
      price: BigNumberable,
      maker: address,
      taker: address,
      expiration: BigNumberable,
      limitFee?: BigNumberable,
      salt?: BigNumberable,
    },
    market: ApiMarketName,
    fillOrKill?: boolean,
    postOnly?: boolean,
    clientId?: string,
    cancelId?: string,
    cancelAmountOnRevert?: boolean,
  }): Promise<{ order: ApiOrder }> {
    const order: SignedOrder = await this.createPerpetualOrder({
      market,
      side,
      amount,
      price,
      maker,
      taker,
      expiration,
      postOnly,
      limitFee,
      salt,
    });

    return this.submitPerpetualOrder({
      order,
      market,
      fillOrKill,
      postOnly,
      cancelId,
      clientId,
      cancelAmountOnRevert,
    });
  }

  /**
   * Creates but does not place a signed perpetualOrder
   */
  async createPerpetualOrder({
    market,
    side,
    amount,
    price,
    maker,
    taker,
    expiration,
    postOnly,
    limitFee,
    salt,
  }: {
    market: ApiMarketName,
    side: ApiSide,
    amount: BigNumberable,
    price: BigNumberable,
    maker: address,
    taker: address,
    expiration: BigNumberable,
    postOnly: boolean,
    limitFee?: BigNumberable,
    salt?: BigNumberable,
  }): Promise<SignedOrder> {
    if (!Object.values(ApiMarketName).includes(market)) {
      throw new Error(`market: ${market} is invalid`);
    }
    if (!Object.values(ApiSide).includes(side)) {
      throw new Error(`side: ${side} is invalid`);
    }

    const amountNumber: BigNumber = new BigNumber(amount);
    const perpetualLimitFee: Fee = limitFee
      ? new Fee(limitFee)
      : this.perpetualOrders.getFeeForOrder(amountNumber, !postOnly);

    const realExpiration: BigNumber = getRealExpiration(expiration);
    const order: Order = {
      maker,
      taker,
      limitFee: perpetualLimitFee,
      isBuy: side === ApiSide.BUY,
      isDecreaseOnly: false,
      amount: amountNumber,
      limitPrice: new Price(price),
      triggerPrice: new Price('0'),
      expiration: realExpiration,
      salt: salt ? new BigNumber(salt) : generatePseudoRandom256BitNumber(),
    };

    const typedSignature: string = await this.perpetualOrders.signOrder(
      order,
      SigningMethod.Hash,
    );

    return {
      ...order,
      typedSignature,
    };
  }

  /**
   * Submits an already signed perpetualOrder
   */
  public async submitPerpetualOrder({
    order,
    market,
    fillOrKill = false,
    postOnly = false,
    cancelId,
    clientId,
    cancelAmountOnRevert,
  }: {
    order: SignedOrder,
    market: ApiMarketName,
    fillOrKill?: boolean,
    postOnly?: boolean,
    cancelId?: string,
    clientId?: string,
    cancelAmountOnRevert?: boolean,
  }): Promise<{ order: ApiOrder }> {
    const jsonOrder = jsonifyPerpetualOrder(order);

    const data: any = {
      fillOrKill,
      postOnly,
      clientId,
      cancelId,
      cancelAmountOnRevert,
      market,
      order: jsonOrder,
    };

    return this.axiosRequest({
      data,
      method: RequestMethod.POST,
      url: `${this.endpoint}/v2/orders`,
    });
  }

  public async cancelOrder({
    orderId,
    maker,
  }: {
    orderId: string,
    maker: address,
  }): Promise<{ order: ApiOrder }> {
    const signature = await this.perpetualOrders.signCancelOrderByHash(
      orderId,
      maker,
      SigningMethod.Hash,
    );

    return this.axiosRequest({
      url: `${this.endpoint}/v2/orders/${orderId}`,
      method: RequestMethod.DELETE,
      headers: {
        authorization: `Bearer ${signature}`,
      },
    });
  }

  // ============ Getters ============

  public async getMarkets():
    Promise<{ markets: ApiMarketMessage[] }> {
    return this.axiosRequest({
      url: `${this.endpoint}/v1/perpetual-markets`,
      method: RequestMethod.GET,
    });
  }

  public async getAccountBalances({
    accountOwner,
  }: {
    accountOwner: address,
  }): Promise<ApiAccount> {
    return this.axiosRequest({
      url: `${this.endpoint}/v1/perpetual-accounts/${accountOwner}`,
      method: RequestMethod.GET,
    });
  }

  public async getOrderbook({
    market,
  }: {
    market: ApiMarketName,
  }): Promise<{ bids: ApiOrderOnOrderbook[], asks: ApiOrderOnOrderbook[] }> {
    return this.axiosRequest({
      url: `${this.endpoint}/v1/orderbook/${market}`,
      method: RequestMethod.GET,
    });
  }

  // ============ Funding Getters ============

  /**
   * Get the current and predicted funding rates.
   *
   * IMPORTANT: The `current` value returned by this function is not active until it has been mined
   * on-chain, which may not happen for some period of time after the start of the hour. To get the
   * funding rate that is currently active on-chain, use the getMarkets() function.
   *
   * The `current` rate is updated each hour, on the hour. The `predicted` rate is updated each
   * minute, on the minute, and may be null if no premiums have been calculated since the last
   * funding rate update.
   *
   * Params:
   * - markets (optional): Limit results to the specified markets.
   */
  public async getFundingRates({
    markets,
  }: {
    markets?: ApiMarketName[],
  } = {}): Promise<{ [market: string]: ApiFundingRates }> {
    return this.axiosRequest({
      url: `${this.endpoint}/v1/funding-rates`,
      method: RequestMethod.GET,
      params: { markets },
    });
  }

  /**
   * Get historical funding rates. The most recent funding rates are returned first.
   *
   * Params:
   * - markets (optional): Limit results to the specified markets.
   * - limit (optional): The maximum number of funding rates. The default, and maximum, is 100.
   * - startingBefore (optional): Return funding rates effective before this date.
   */
  public async getHistoricalFundingRates({
    markets,
    limit,
    startingBefore,
  }: {
    markets?: ApiMarketName[],
    limit?: number,
    startingBefore?: Date,
  } = {}): Promise<{ [market: string]: ApiHistoricalFundingRates }> {
    return this.axiosRequest({
      url: `${this.endpoint}/v1/historical-funding-rates`,
      method: RequestMethod.GET,
      params: {
        markets,
        limit,
        startingBefore: startingBefore && startingBefore.toISOString(),
      },
    });
  }

  /**
   * Get the index price used in the funding rate calculation.
   *
   * Params:
   * - markets (optional): Limit results to the specified markets.
   */
  public async getFundingIndexPrice({
    markets,
  }: {
    markets?: ApiMarketName[],
  } = {}): Promise<{ [market: string]: ApiIndexPrice }> {
    return this.axiosRequest({
      url: `${this.endpoint}/v1/index-price`,
      method: RequestMethod.GET,
      params: { markets },
    });
  }

  private async axiosRequest(
    {
      url,
      method,
      headers,
      data,
      params,
    }: {
      url: string,
      method: RequestMethod,
      headers?: any,
      data?: any,
      params?: any,
    }): Promise<any> {
    try {
      const response = await axios({
        url,
        method,
        headers,
        data,
        params,
        timeout: this.timeout,
      });

      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(error.response.data.errors[0].msg);
      } else {
        const newError = new Error(error.message);
        newError.stack = error.stack;
        throw new Error;
      }
    }
  }
}

function generatePseudoRandom256BitNumber(): BigNumber {
  const MAX_DIGITS_IN_UNSIGNED_256_INT = 78;

  // BigNumber.random returns a pseudo-random number between 0 & 1 with a passed in number of
  // decimal places.
  // Source: https://mikemcl.github.io/bignumber.js/#random
  const randomNumber = BigNumber.random(MAX_DIGITS_IN_UNSIGNED_256_INT);
  const factor = new BigNumber(10).pow(MAX_DIGITS_IN_UNSIGNED_256_INT - 1);
  const randomNumberScaledTo256Bits = randomNumber.times(factor).integerValue();
  return randomNumberScaledTo256Bits;
}

function jsonifyPerpetualOrder(order: SignedOrder) {
  return {
    isBuy: order.isBuy,
    isDecreaseOnly: order.isDecreaseOnly,
    amount: order.amount.toFixed(0),
    limitPrice: order.limitPrice.value.toString(),
    triggerPrice: order.triggerPrice.value.toString(),
    limitFee: order.limitFee.value.toString(),
    maker: order.maker,
    taker: order.taker,
    expiration: order.expiration.toFixed(0),
    typedSignature: order.typedSignature,
    salt: order.salt.toFixed(0),
  };
}

function getRealExpiration(expiration: BigNumberable): BigNumber {
  return new BigNumber(expiration).eq(0) ?
    new BigNumber(0)
    : new BigNumber(Math.round(new Date().getTime() / 1000)).plus(
      new BigNumber(expiration),
    );
}
