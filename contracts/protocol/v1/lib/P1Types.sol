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
 * Library for common types used in PerpetualV1 contracts.
 */
library P1Types {
    // ============ Structs ============

    // Used for the Global Index and Cached Index per account.
    // Used to settle funding paymennts on a per-account basis.
    struct Index {
        uint32 timestamp;
        bool isPositive;
        uint128 value;
    }

    // Used to track the signed Margin Balance and Position Balance values for each account.
    struct Balance {
        bool marginIsPositive;
        bool positionIsPositive;
        uint120 margin;
        uint120 position;
    }

    // Used to cache commonly-used variables that are relatively expensive to obtain once.
    struct Context {
        uint256 price;
        uint256 minCollateral;
        Index index;
    }

    // Used by P1Trader contracts to return the result of a trade.
    struct TradeResult {
        uint256 marginAmount;
        uint256 positionAmount;
        bool isBuy; // From taker's perspective.
        bytes32 traderFlags;
    }
}
