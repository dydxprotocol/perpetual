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

/**
 * To publish a contract with the published npm package, include it here
 */

import { default as PerpetualProxy } from '../build/contracts/PerpetualProxy.json';
import { default as PerpetualV1 } from '../build/contracts/PerpetualV1.json';
import { default as P1FundingOracle } from '../build/contracts/P1FundingOracle.json';
import { default as P1MakerOracle } from '../build/contracts/P1MakerOracle.json';
import { default as P1Orders } from '../build/contracts/P1Orders.json';
import { default as P1Deleveraging } from '../build/contracts/P1Deleveraging.json';
import { default as P1Liquidation } from '../build/contracts/P1Liquidation.json';
import { default as ERC20 } from '../build/contracts/ERC20.json';

export default {
  PerpetualProxy,
  PerpetualV1,
  P1FundingOracle,
  P1MakerOracle,
  P1Orders,
  P1Deleveraging,
  P1Liquidation,
  ERC20,
};
