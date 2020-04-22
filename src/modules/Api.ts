import { default as axios } from 'axios';
import BigNumber from 'bignumber.js';
import {
  address,
  SigningMethod,
  ApiMarketName,
  BigNumberable,
  Order,
  SignedOrder,
  Fee,
  Price,
  ApiOrder,
  ApiSide,
  ApiMarketMessage,
  ApiAccount,
  ApiOptions,
  ApiOrderOnOrderbook,
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

  public async placePerpetualOrder({
    order: {
      side,
      amount,
      price,
      maker,
      taker,
      expiration = new BigNumber(FOUR_WEEKS_IN_SECONDS),
      limitFee,
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
      salt: generatePseudoRandom256BitNumber(),
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
    fillOrKill: boolean,
    postOnly: boolean,
    cancelId: string,
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

    const response = await axios({
      data,
      method: 'post',
      url: `${this.endpoint}/v2/orders`,
      timeout: this.timeout,
    });

    return response.data;
  }

  public async cancelOrder({
    orderId,
    makerAccountOwner,
  }: {
    orderId: string,
    makerAccountOwner: address,
  }): Promise<{ order: ApiOrder }> {
    const signature = await this.perpetualOrders.signCancelOrderByHash(
      orderId,
      makerAccountOwner,
      SigningMethod.Hash,
    );

    const response = await axios({
      url: `${this.endpoint}/v2/orders/${orderId}`,
      method: 'delete',
      headers: {
        authorization: `Bearer ${signature}`,
      },
      timeout: this.timeout,
    });

    return response.data;
  }

  public async getMarkets():
    Promise<{ markets: { [market: string]: ApiMarketMessage } }> {
    const response = await axios({
      url: `${this.endpoint}/v1/perpetual-markets`,
      method: 'get',
      timeout: this.timeout,
    });
    return response.data;
  }

  public async getAccountBalances({
    accountOwner,
  }: {
    accountOwner: address,
  }): Promise<ApiAccount> {
    const response = await axios({
      url: `${this.endpoint}/v1/perpetual-accounts/${accountOwner}`,
      method: 'get',
      timeout: this.timeout,
    });

    return response.data;
  }

  public async getOrderbook({
    market,
  }: {
    market: ApiMarketName,
  }): Promise<{ bids: ApiOrderOnOrderbook[], asks: ApiOrderOnOrderbook[] }> {
    const response = await axios({
      url: `${this.endpoint}/v1/orderbook/${market}`,
      method: 'get',
      timeout: this.timeout,
    });

    return response.data;
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
