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
import { SafeCast } from "../../lib/SafeCast.sol";
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
    using SafeCast for uint256;
    using SafeMath for uint256;
    using SignedMath for SignedMath.Int;

    // ============ Constants ============

    uint256 private constant FLAG_IS_POSITIVE = 1 << 80;

    uint256 private constant SECONDS_PER_YEAR = 365 days;

    // ============ Structs ============

    /**
     * The funding rate is stored as an APR (assumes 365 days/year), fixed-point with 18 decimals.
     *
     * A uint80 is used so that the full Bounds struct fits in a storage slot. This is able to
     * support daily rates up to around 331213%.
     */
    struct FundingRate {
        uint32 timestamp;
        bool isPositive;
        uint80 value;
    }

    struct Bounds {
        uint80 maxAbsValue;
        uint80 maxAbsDiffPerUpdate;
        uint80 maxAbsDiffPerSecond;
    }

    // ============ Events ============

    event LogFundingRateUpdated(
        bytes32 fundingRate
    );

    // ============ Immutable Storage ============

    Bounds public _BOUNDS_;

    // ============ Mutable Storage ============

    // The funding rate, denoted in units per second, with 36 decimals of precision.
    FundingRate private _FUNDING_RATE_;

    // ============ Functions ============

    constructor(
        Bounds memory bounds
    )
        public
    {
        _BOUNDS_ = bounds;
        _FUNDING_RATE_ = FundingRate({
            timestamp: block.timestamp.toUint32(),
            isPositive: true,
            value: 0
        });
        emit LogFundingRateUpdated(_fundingRateToBytes32(_FUNDING_RATE_));
    }

    /**
     * Returns the signed funding amount according to the amount of time that has passed.
     *
     * The returned funding amount is a unitless rate, as a fixed-point number with 18 decimals.
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
        //
        // Note: Funding rate will be rounded toward zero.
        uint256 value = uint256(_FUNDING_RATE_.value);
        uint256 fundingAmount = Math.getFraction(value, timeDelta, SECONDS_PER_YEAR);
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
        returns (FundingRate memory)
    {
        SignedMath.Int memory boundedNewRate = _boundRate(newRate);
        FundingRate memory boundedNewRateWithTimestamp = FundingRate({
            timestamp: block.timestamp.toUint32(),
            isPositive: boundedNewRate.isPositive,
            value: boundedNewRate.value.toUint80()
        });
        _FUNDING_RATE_ = boundedNewRateWithTimestamp;
        emit LogFundingRateUpdated(_fundingRateToBytes32(boundedNewRateWithTimestamp));
        return boundedNewRateWithTimestamp;
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
        Bounds memory bounds = _BOUNDS_;
        uint256 maxAbsValue = uint256(bounds.maxAbsValue);
        uint256 maxAbsDiffPerUpdate = uint256(bounds.maxAbsDiffPerUpdate);
        uint256 maxAbsDiffPerSecond = uint256(bounds.maxAbsDiffPerSecond);

        // Get the old rate from storage.
        FundingRate memory oldRateWithTimestamp = _FUNDING_RATE_;
        SignedMath.Int memory oldRate = SignedMath.Int({
            value: oldRateWithTimestamp.value, // upcast as uint256
            isPositive: oldRateWithTimestamp.isPositive
        });

        // Get the maximum allowed change in the rate.
        uint256 timeDelta = block.timestamp.sub(oldRateWithTimestamp.timestamp);
        uint256 maxDiff = Math.min(
            maxAbsDiffPerUpdate,
            maxAbsDiffPerSecond.mul(timeDelta)
        );

        // Calculate and return the bounded rate.
        if (newRate.gt(oldRate)) {
            SignedMath.Int memory upperBound = SignedMath.min(
                oldRate.add(maxDiff),
                SignedMath.Int({ value: maxAbsValue, isPositive: true })
            );
            return SignedMath.min(
                newRate,
                upperBound
            );
        } else {
            SignedMath.Int memory lowerBound = SignedMath.max(
                oldRate.sub(maxDiff),
                SignedMath.Int({ value: maxAbsValue, isPositive: false })
            );
            return SignedMath.max(
                newRate,
                lowerBound
            );
        }
    }

    /**
     * Returns a compressed bytes32 representation of the funding rate for logging.
     */
    function _fundingRateToBytes32(
        FundingRate memory fundingRate
    )
        private
        pure
        returns (bytes32)
    {
        uint256 result =
            fundingRate.value
            | (fundingRate.isPositive ? FLAG_IS_POSITIVE : 0)
            | (uint256(fundingRate.timestamp) << 88);
        return bytes32(result);
    }
}
