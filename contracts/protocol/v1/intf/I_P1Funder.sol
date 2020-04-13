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
 * @notice Interface for an oracle providing the funding rate for a perpetual market.
 */
interface I_P1Funder {

    /**
     * @notice Returns the signed funding percentage that has accrued according to the amount of
     * time that has passed.
     * @dev The funding percentage is a unitless rate with 18 decimals of precision.
     * @param timeDelta The number of seeconds that has passed since the previous update.
     * @return A boolean and an unsigned integer. The boolean is True if the funding rate is
     * positive (False otherwise) and the unsigned integer is the absolute value of the funding
     * rate.
     */
    function getFunding(
        uint256 timeDelta
    )
        external
        view
        returns (bool, uint256);
}
