/*

    Copyright 2020 dYdX Trading Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

import BigNumber from 'bignumber.js';
import {
  HttpProvider,
  IpcProvider,
  WebsocketProvider,
  Log,
  EventLog,
} from 'web3-core';
import {
  TransactionReceipt,
} from 'web3-eth';

// ============ Types ============

export type address = string;
export type TypedSignature = string;
export type Provider = HttpProvider | IpcProvider | WebsocketProvider;
export type BigNumberable = BigNumber | number | string;

// ============ Enums ============

export enum ConfirmationType {
  Hash = 0,
  Confirmed = 1,
  Both = 2,
  Simulate = 3,
}

export enum SigningMethod {
  Compatibility = 'Compatibility',   // picks intelligently between UnsafeHash and Hash
  UnsafeHash = 'UnsafeHash',         // raw hash signed
  Hash = 'Hash',                     // hash prepended according to EIP-191
  TypedData = 'TypedData',           // order hashed according to EIP-712
  MetaMask = 'MetaMask',             // order hashed according to EIP-712 (MetaMask-only)
  MetaMaskLatest = 'MetaMaskLatest', // ... according to latest version of EIP-712 (MetaMask-only)
  CoinbaseWallet = 'CoinbaseWallet', // ... according to latest version of EIP-712 (CoinbaseWallet)
}

export enum OrderStatus {
  Null = 0,
  Approved = 1,
  Canceled = 2,
}

export interface OrderState {
  status: OrderStatus;
  filledAmount: BigNumber;
}

export enum SoloBridgeTransferMode {
  SOME_TO_PERPETUAL = 0,
  SOME_TO_SOLO = 1,
  ALL_TO_PERPETUAL = 2,
}

// ============ Constants ============

export const Networks = {
  MAINNET: 1,
  KOVAN: 42,
};

// ============ Initialization Options ============

export interface PerpetualOptions {
  defaultAccount?: address;
  sendOptions?: SendOptions;
  apiOptions?: ApiOptions;
  accounts?: EthereumAccount[];
}

export interface ApiOptions {
  endpoint?: string;
  timeout?: number;
}

// ============ Interfaces ============

export interface EthereumAccount {
  address?: string;
  privateKey: string;
}

export interface TxResult {
  transactionHash?: string;
  transactionIndex?: number;
  blockHash?: string;
  blockNumber?: number;
  from?: string;
  to?: string;
  contractAddress?: string;
  cumulativeGasUsed?: number;
  gasUsed?: number;
  logs?: Log[];
  events?: {
    [eventName: string]: EventLog;
  };
  status?: boolean;
  nonce?: number; // non-standard field, returned only through dYdX Sender service
  confirmation?: Promise<TransactionReceipt>;
  gasEstimate?: number;
  gas?: number;
}

export interface TxOptions {
  from?: address;
  value?: number | string;
}

export interface NativeSendOptions extends TxOptions {
  gasPrice?: number | string;
  gas?: number | string;
  nonce?: string | number;
}

export interface SendOptions extends NativeSendOptions {
  confirmations?: number;
  confirmationType?: ConfirmationType;
  gasMultiplier?: number;
}

export interface CallOptions extends TxOptions {
  blockNumber?: number;
}

export interface PosAndNegValues {
  positiveValue: BigNumber;
  negativeValue: BigNumber;
}

// ============ Solidity Interfaces ============

export interface SignedIntStruct {
  value: string;
  isPositive: boolean;
}

export interface BalanceStruct {
  marginIsPositive: boolean;
  positionIsPositive: boolean;
  margin: string;
  position: string;
}

export interface FundingRateStruct {
  timestamp: BigNumber;
  isPositive: boolean;
  value: BigNumber;
}

export interface TradeArg {
  makerIndex: number;
  takerIndex: number;
  trader: address;
  data: string;
}

export interface TradeResult {
  marginAmount: BigNumber;
  positionAmount: BigNumber;
  isBuy: boolean;
  traderFlags: BigNumber;
}

export interface FundingRateBounds {
  maxAbsValue: FundingRate;
  maxAbsDiffPerSecond: FundingRate;
}

export interface LoggedFundingRate {
  timestamp: BigNumber;
  baseValue: BaseValue;
}

export interface Index {
  timestamp: BigNumber;
  baseValue: BaseValue;
}

export interface Order {
  isBuy: boolean;
  isDecreaseOnly: boolean;
  amount: BigNumber;
  limitPrice: Price;
  triggerPrice: Price;
  limitFee: Fee;
  maker: address;
  taker: address;
  expiration: BigNumber;
  salt: BigNumber;
}

export interface SignedOrder extends Order {
  typedSignature: string;
}

export interface MakerOracleMessage {
  price: Price;
  timestamp: BigNumber;
  signature: string;
}

export interface SoloBridgeTransfer {
  account: address;
  perpetual: address;
  soloAccountNumber: BigNumberable;
  soloMarketId: BigNumberable;
  amount: BigNumberable;
  transferMode: SoloBridgeTransferMode;
  expiration?: BigNumberable;
  salt?: BigNumberable;
}

export interface SignedSoloBridgeTransfer extends SoloBridgeTransfer {
  typedSignature: string;
}

// ============ Helper Functions ============

export function bnToSoliditySignedInt(value: BigNumberable): SignedIntStruct {
  const bn = new BigNumber(value);
  return {
    value: bn.abs().toFixed(0),
    isPositive: bn.isPositive(),
  };
}

export function bnFromSoliditySignedInt(struct: SignedIntStruct): BigNumber {
  if (struct.isPositive) {
    return new BigNumber(struct.value);
  }
  return new BigNumber(struct.value).negated();
}

// ============ Classes ============

export class Balance {
  public margin: BigNumber;
  public position: BigNumber;

  constructor(margin: BigNumberable, position: BigNumberable) {
    this.margin = new BigNumber(margin);
    this.position = new BigNumber(position);
  }

  static fromSolidity(struct: BalanceStruct): Balance {
    const marginBN = new BigNumber(struct.margin);
    const positionBN = new BigNumber(struct.position);
    return new Balance(
      struct.marginIsPositive ? marginBN : marginBN.negated(),
      struct.positionIsPositive ? positionBN : positionBN.negated(),
    );
  }

  public toSolidity(): BalanceStruct {
    return {
      marginIsPositive: this.margin.isPositive(),
      positionIsPositive: this.position.isPositive(),
      margin: this.margin.abs().toFixed(0),
      position: this.position.abs().toFixed(0),
    };
  }

  public copy(): Balance {
    return new Balance(this.margin, this.position);
  }

  /**
   * Get the positive and negative values (in terms of margin-token) of the balance,
   * given an oracle price.
   */
  public getPositiveAndNegativeValues(price: Price): PosAndNegValues {
    let positiveValue = new BigNumber(0);
    let negativeValue = new BigNumber(0);

    const marginValue = this.margin.abs();
    if (this.margin.isPositive()) {
      positiveValue = marginValue;
    } else {
      negativeValue = marginValue;
    }

    const positionValue = this.position.times(price.value).abs();
    if (this.position.isPositive()) {
      positiveValue = positiveValue.plus(positionValue);
    } else {
      negativeValue = negativeValue.plus(positionValue);
    }

    return { positiveValue, negativeValue };
  }

  /**
   * Get the collateralization ratio of the balance, given an oracle price.
   *
   * Returns BigNumber(Infinity) if there are no negative balances.
   */
  public getCollateralization(price: Price): BigNumber {
    const values = this.getPositiveAndNegativeValues(price);

    if (values.negativeValue.isZero()) {
      return new BigNumber(Infinity);
    }

    return values.positiveValue.div(values.negativeValue);
  }
}

// From BaseMath.sol.
export const BASE_DECIMALS = 18;

/**
 * A value that is represented on the smart contract by an integer shifted by `BASE` decimal places.
 */
export class BaseValue {
  readonly value: BigNumber;

  constructor(value: BigNumberable) {
    this.value = new BigNumber(value);
  }

  public toSolidity(): string {
    return this.value.abs().shiftedBy(BASE_DECIMALS).toFixed(0);
  }

  public toSoliditySignedInt(): SignedIntStruct {
    return {
      value: this.toSolidity(),
      isPositive: this.isPositive(),
    };
  }

  static fromSolidity(solidityValue: BigNumberable, isPositive: boolean = true): BaseValue {
    // Help to detect errors in the parsing and typing of Solidity data.
    if (typeof isPositive !== 'boolean') {
      throw new Error('Error in BaseValue.fromSolidity: isPositive was not a boolean');
    }

    let value = new BigNumber(solidityValue).shiftedBy(-BASE_DECIMALS);
    if (!isPositive) {
      value = value.negated();
    }
    return new BaseValue(value);
  }

  /**
   * Return the BaseValue, rounded down to the nearest Solidity-representable value.
   */
  public roundedDown(): BaseValue {
    return new BaseValue(this.value.decimalPlaces(BASE_DECIMALS, BigNumber.ROUND_DOWN));
  }

  public times(value: BigNumberable): BaseValue {
    return new BaseValue(this.value.times(value));
  }

  public div(value: BigNumberable): BaseValue {
    return new BaseValue(this.value.div(value));
  }

  public plus(value: BigNumberable): BaseValue {
    return new BaseValue(this.value.plus(value));
  }

  public minus(value: BigNumberable): BaseValue {
    return new BaseValue(this.value.minus(value));
  }

  public abs(): BaseValue {
    return new BaseValue(this.value.abs());
  }

  public negated(): BaseValue {
    return new BaseValue(this.value.negated());
  }

  public isPositive(): boolean {
    return this.value.isPositive();
  }

  public isNegative(): boolean {
    return this.value.isNegative();
  }
}

export class Price extends BaseValue {
}

export class Fee extends BaseValue {
  static fromBips(value: BigNumberable): Fee {
    return new Fee(new BigNumber('1e-4').times(value));
  }
}

export class FundingRate extends BaseValue {
  /**
   * Given a daily rate, returns funding rate represented as a per-second rate.
   *
   * Note: Funding interest does not compound, as the interest affects margin balances but
   * is calculated based on position balances.
   */
  static fromEightHourRate(rate: BigNumberable): FundingRate {
    return new FundingRate(new BigNumber(rate).div(8 * 60 * 60));
  }
}

export enum ApiOrderStatus {
  PENDING = 'PENDING',
  OPEN = 'OPEN',
  FILLED = 'FILLED',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  CANCELED = 'CANCELED',
  UNTRIGGERED = 'UNTRIGGERED',
}

export enum ApiOrderType {
  PERPETUAL_CROSS = 'PERPETUAL_CROSS',
  PERPETUAL_STOP_LIMIT = 'PERPETUAL_STOP_LIMIT',
}

export enum ApiMarketName {
  PBTC_USDC = 'PBTC-USDC',
}

export enum ApiSide {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum ApiOrderCancelReason {
  EXPIRED = 'EXPIRED',
  UNDERCOLLATERALIZED = 'UNDERCOLLATERALIZED',
  CANCELED_ON_CHAIN = 'CANCELED_ON_CHAIN',
  USER_CANCELED = 'USER_CANCELED',
  SELF_TRADE = 'SELF_TRADE',
  FAILED = 'FAILED',
  COULD_NOT_FILL = 'COULD_NOT_FILL',
  POST_ONLY_WOULD_CROSS = 'POST_ONLY_WOULD_CROSS',
}

export interface ApiOrder {
  uuid: string;
  id: string;
  status: ApiOrderStatus;
  accountOwner: string;
  accountNumber: string;
  orderType: ApiOrderType;
  fillOrKill: boolean;
  market: ApiMarketName;
  side: ApiSide;
  baseAmount: string;
  quoteAmount: string;
  filledAmount: string;
  price: string;
  cancelReason: ApiOrderCancelReason;
}

export interface ApiOrderOnOrderbook {
  id: string;
  uuid: string;
  amount: string;
  price: string;
}

export interface ApiBalance {
  margin: string;
  position: string;
  indexValue: string;
  indexTimestamp: string;
  pendingMargin: string;
  pendingPosition: string;
}

export interface ApiMarketMessage {
  createdAt: string;
  updatedAt: string;
  market: ApiMarketName;
  oraclePrice: string;
  fundingRate: string;
  globalIndexValue: string;
  globalIndexTimeStamp: string;
}

export interface ApiAccount {
  owner: string;
  uuid: string;
  balances: {
    [market: string]: ApiBalance,
  };
}

// ============ Funding API ============

export interface ApiFundingRate {
  market: ApiMarketName;
  effectiveAt: string;
  fundingRate: string;
  fundingRate8Hr: string;
  averagePremiumComponent: string;
  averagePremiumComponent8Hr: string;
}

// Per-market response from /funding-rates
export interface ApiFundingRates {
  current: ApiFundingRate;
  predicted: ApiFundingRate | null;
}

// Per-market response from /historical-funding-rates
export interface ApiHistoricalFundingRates {
  history: ApiFundingRate[];
}

// Per-market response from /index-price
export interface ApiIndexPrice {
  price: string;
}

export enum RequestMethod {
  GET = 'get',
  POST = 'post',
  DELETE = 'delete',
}
