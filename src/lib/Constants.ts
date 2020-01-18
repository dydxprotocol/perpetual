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

const ONE_MINUTE_IN_SECONDS = new BigNumber(60);
const ONE_HOUR_IN_SECONDS = ONE_MINUTE_IN_SECONDS.times(60);
const ONE_DAY_IN_SECONDS = ONE_HOUR_IN_SECONDS.times(24);
const ONE_YEAR_IN_SECONDS = ONE_DAY_IN_SECONDS.times(365);

export const INTEGERS = {
  ONE_MINUTE_IN_SECONDS,
  ONE_HOUR_IN_SECONDS,
  ONE_DAY_IN_SECONDS,
  ONE_YEAR_IN_SECONDS,
  ZERO: new BigNumber(0),
  ONE: new BigNumber(1),
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
