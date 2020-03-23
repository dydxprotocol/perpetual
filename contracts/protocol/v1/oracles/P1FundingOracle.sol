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

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Ownable } from "@openzeppelin/contracts/ownership/Ownable.sol";
import { BaseMath } from "../../lib/BaseMath.sol";
import { Math } from "../../lib/Math.sol";
import { SignedMath } from "../../lib/SignedMath.sol";
import { I_P1Funder } from "../intf/I_P1Funder.sol";


/**
 * @title P1FundingOracle
 * @author dYdX
 *
 * Oracle providing the funding rate for a perpetual market.
 */
contract P1FundingOracle is
    Ownable,
    I_P1Funder
{
    using BaseMath for uint256;
    using SafeMath for uint256;
    using SignedMath for SignedMath.Int;

    // ============ Structs ============

    struct Bounds {
        uint256 maxAbsValue_fixed36;
        uint256 maxAbsDiffPerUpdate_fixed36;
        uint256 maxAbsDiffPerSecond_fixed36;
    }

    // ============ Events ============

    event LogFundingRateUpdated(
        SignedMath.Int fundingRate
    );

    // ============ Immutable Storage ============

    Bounds public _BOUNDS_;

    // ============ Mutable Storage ============

    // The funding rate, denoted in units per second, with 36 decimals of precision.
    SignedMath.Int private _FUNDING_RATE_;
    uint256 private _UPDATED_TIMESTAMP_;

    // ============ Functions ============

    constructor(
        Bounds memory bounds
    )
        public
    {
        _BOUNDS_ = bounds;
        _FUNDING_RATE_ = SignedMath.Int({
            value: 0,
            isPositive: true
        });
        _UPDATED_TIMESTAMP_ = block.timestamp;
        emit LogFundingRateUpdated(_FUNDING_RATE_);
    }

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
        returns (bool, uint256)
    {
        // Note: Funding interest does not compound, as the interest affects margin balances but
        // is calculated based on position balances.
        uint256 fundingAmount = _FUNDING_RATE_.value.baseMul(timeDelta);
        return (_FUNDING_RATE_.isPositive, fundingAmount);
    }

    /**
     * Set the funding rate.
     *
     * The funding rate is denoted in units per second, with 36 decimals of precision.
     */
    function setFundingRate(
        SignedMath.Int calldata newRate
    )
        external
        onlyOwner
        returns (SignedMath.Int memory)
    {
        SignedMath.Int memory boundedNewRate = _boundRate(newRate);
        _FUNDING_RATE_ = boundedNewRate;
        _UPDATED_TIMESTAMP_ = block.timestamp;
        emit LogFundingRateUpdated(boundedNewRate);
        return boundedNewRate;
    }

    /**
     * Apply the contract-defined bounds and return the bounded rate.
     */
    function _boundRate(
        SignedMath.Int memory newRate
    )
        private
        view
        returns (SignedMath.Int memory)
    {
        // Get bounding params from storage.
        uint256 maxAbsValue_fixed36 = _BOUNDS_.maxAbsValue_fixed36;
        uint256 maxAbsDiffPerUpdate_fixed36 = _BOUNDS_.maxAbsDiffPerUpdate_fixed36;
        uint256 maxAbsDiffPerSecond_fixed36 = _BOUNDS_.maxAbsDiffPerSecond_fixed36;

        // Get the old rate and the maximum allowed change in the rate.
        SignedMath.Int memory oldRate = _FUNDING_RATE_;
        uint256 timeDelta = block.timestamp.sub(_UPDATED_TIMESTAMP_);
        uint256 maxDiff_fixed36 = Math.min(
            maxAbsDiffPerUpdate_fixed36,
            maxAbsDiffPerSecond_fixed36.mul(timeDelta)
        );

        // Calculate and return the bounded rate.
        if (newRate.gt(oldRate)) {
            SignedMath.Int memory upperBound = SignedMath.min(
                oldRate.add(maxDiff_fixed36),
                SignedMath.Int({ value: maxAbsValue_fixed36, isPositive: true })
            );
            return SignedMath.min(
                newRate,
                upperBound
            );
        } else {
            SignedMath.Int memory lowerBound = SignedMath.max(
                oldRate.sub(maxDiff_fixed36),
                SignedMath.Int({ value: maxAbsValue_fixed36, isPositive: false })
            );
            return SignedMath.max(
                newRate,
                lowerBound
            );
        }
    }
}
