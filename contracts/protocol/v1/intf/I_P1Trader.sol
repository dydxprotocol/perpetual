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

import { P1Types } from "../lib/P1Types.sol";


/**
 * @title I_P1Trader
 * @author dYdX
 *
 * Interface that PerpetualV1 Traders must implement.
 */
interface I_P1Trader {

    /**
     * Returns the result of the trade between the maker and the taker.
     */
    function trade(
        address sender,
        address maker,
        address taker,
        uint256 price,
        bytes calldata data,
        bytes32 traderFlags
    )
        external
        returns(P1Types.TradeResult memory);
}
