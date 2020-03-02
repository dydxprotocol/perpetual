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
import { Fee, Price } from './types';

const ONE_MINUTE_IN_SECONDS = new BigNumber(60);
const ONE_HOUR_IN_SECONDS = ONE_MINUTE_IN_SECONDS.times(60);
const ONE_DAY_IN_SECONDS = ONE_HOUR_IN_SECONDS.times(24);
const ONE_YEAR_IN_SECONDS = ONE_DAY_IN_SECONDS.times(365);

export const PRICES = {
  NONE: new Price(0),
  ONE: new Price(1),
};

export const FEES = {
  ZERO: new Fee(0),
  ONE_BIP: new Fee('1e-4'),
  ONE_PERCENT: new Fee('1e-2'),
};

export const INTEGERS = {
  ONE_MINUTE_IN_SECONDS,
  ONE_HOUR_IN_SECONDS,
  ONE_DAY_IN_SECONDS,
  ONE_YEAR_IN_SECONDS,
  ZERO: new BigNumber(0),
  ONE: new BigNumber(1),
  ONES_255: new BigNumber(
    '115792089237316195423570985008687907853269984665640564039457584007913129639935',
  ), // 2**256-1
};

export const ADDRESSES = {
  ZERO: '0x0000000000000000000000000000000000000000',
  TEST: [
    '0x06012c8cf97bead5deae237070f9587f8e7a266d',
    '0x22012c8cf97bead5deae237070f9587f8e7a266d',
    '0x33012c8cf97bead5deae237070f9587f8e7a266d',
    '0x44012c8cf97bead5deae237070f9587f8e7a266d',
    '0x55012c8cf97bead5deae237070f9587f8e7a266d',
    '0x66012c8cf97bead5deae237070f9587f8e7a266d',
    '0x77012c8cf97bead5deae237070f9587f8e7a266d',
    '0x88012c8cf97bead5deae237070f9587f8e7a266d',
    '0x99012c8cf97bead5deae237070f9587f8e7a266d',
    '0xaa012c8cf97bead5deae237070f9587f8e7a266d',
  ],
};

// ============ P1Constants.sol ============

export const TRADER_FLAG_ORDERS = new BigNumber(1);
export const TRADER_FLAG_LIQUIDATION = new BigNumber(2);
export const TRADER_FLAG_DELEVERAGING = new BigNumber(4);

// ============ P1Orders.sol ============

export const ORDER_FLAGS = {
  IS_BUY: 1,
  IS_DECREASE_ONLY: 2,
  IS_NEGATIVE_LIMIT_FEE: 4,
};
