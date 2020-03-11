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


/**
 * @title P1Types
 * @author dYdX
 *
 * Types library
 */
library P1Types {
    // ============ Structs ============

    struct Index {
        uint32 timestamp;
        bool isPositive;
        uint128 value;
    }

    struct Balance {
        bool marginIsPositive;
        bool positionIsPositive;
        uint120 margin;
        uint120 position;
    }

    struct Context {
        uint256 price;
        uint256 minCollateral;
        Index index;
    }

    struct TradeResult {
        uint256 marginAmount;
        uint256 positionAmount;
        bool isBuy; // from taker's perspective
        bytes32 traderFlags;
    }
}
