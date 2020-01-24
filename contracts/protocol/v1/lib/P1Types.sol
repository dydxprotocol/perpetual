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
 * Types contract
 */
contract P1Types {
    // ============ Structs ============

    struct Index {
        uint112 positive;
        uint112 negative;
        uint32 timestamp;
    }

    struct Balance {
        int128 margin;
        int128 position;
    }

    struct TradeArg {
        uint256 accountId1;
        uint256 accountId2;
        bytes data;
    }
}
