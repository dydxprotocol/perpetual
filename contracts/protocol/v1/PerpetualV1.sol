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

pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import { P1Admin } from "./impl/P1Admin.sol";
import { P1Getters } from "./impl/P1Getters.sol";
import { P1Initializer } from "./impl/P1Initializer.sol";
import { P1Margin } from "./impl/P1Margin.sol";
import { P1Trade } from "./impl/P1Trade.sol";
import { I_PerpetualV1 } from "./intf/I_PerpetualV1.sol";


/**
 * @title PerpetualV1
 * @author dYdX
 *
 * Main contract that inherits from other contracts
 */
contract PerpetualV1 is
    I_PerpetualV1,
    P1Admin,
    P1Getters,
    P1Initializer,
    P1Margin,
    P1Trade
{
}
