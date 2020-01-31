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

// ============ Constants ============

export const Networks = {
  MAINNET: 1,
  KOVAN: 42,
};

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
  confirmation?: Promise<TransactionReceipt>;
  gasEstimate?: number;
  gas?: number;
}

export interface TxOptions {
  from?: address;
  gasPrice?: number;
  gas?: number;
  value?: number;
}

export interface SendOptions extends TxOptions {
  confirmations?: number;
  confirmationType?: ConfirmationType;
  gasMultiplier?: number;
}

export interface CallOptions extends TxOptions {
  blockNumber?: number;
}

// ============ Solidity Interfaces ============

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
}

export interface Balance {
  position: BigNumber;
  margin: BigNumber;
}

export interface Index {
  timestamp: BigNumber;
  value: BigNumber;
}

export interface Order {
  isBuy: boolean;
  amount: BigNumber;
  limitPrice: BigNumber;
  stopPrice: BigNumber;
  fee: BigNumber;
  maker: address;
  taker: address;
  expiration: BigNumber;
  salt: BigNumber;
}

export interface SignedOrder extends Order {
  typedSignature: string;
}
