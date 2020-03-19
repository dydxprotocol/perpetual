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
 * @title I_P1Funder
 * @author dYdX
 *
 * Interface for an oracle providing the funding rate for a perpetual market.
 */
interface I_P1Funder {

    /**
     * Returns the signed funding percentage according to the amount of time that has passed.
     *
     * The funding percentage is a unitless rate with 18 decimals of precision.
     */
    function getFunding(
        uint256 timeDelta
    )
        external
        view
        returns (bool, uint256);
}
