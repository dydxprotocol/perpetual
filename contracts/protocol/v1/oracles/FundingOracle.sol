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

import { Ownable } from "@openzeppelin/contracts/ownership/Ownable.sol";
import { BaseMath } from "../../lib/BaseMath.sol";
import { I_P1Funder } from "../intf/I_P1Funder.sol";


/**
 * @title FundingOracle
 * @author dYdX
 *
 * Oracle providing the funding rate for a perpetual market.
 */
contract FundingOracle is
    Ownable,
    I_P1Funder
{
    using BaseMath for uint256;

    // The funding rate, denoted in units per second, with 36 decimals of precision.
    bool private _FUNDING_IS_POSITIVE_ = true;
    uint256 private _FUNDING_RATE_ = 0;

    /**
     * Returns the signed funding percentage according to the amount of time that has passed.
     *
     * The funding percentage is a unitless rate with 18 decimals of precision.
     */
    function getFunding(
        uint256 timestamp
    )
        external
        view
        returns (bool, uint256)
    {
        // TODO: Estimate error.
        uint256 funding = _FUNDING_RATE_.baseMul(timestamp);
        return (_FUNDING_IS_POSITIVE_, funding);
    }

    function setFundingRate(
        bool isPositive,
        uint256 fundingRate
    )
        external
        onlyOwner
    {
        // TODO: Apply bounds.
        _FUNDING_IS_POSITIVE_ = isPositive;
        _FUNDING_RATE_ = fundingRate;
    }
}
