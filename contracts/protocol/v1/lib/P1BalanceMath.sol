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
import { P1Types } from "./P1Types.sol";
import { BaseMath } from "../../lib/BaseMath.sol";
import { SafeCast } from "../../lib/SafeCast.sol";
import { SignedMath } from "../../lib/SignedMath.sol";


/**
 * @title P1BalanceMath
 * @author dYdX
 *
 * BalanceMath library
 */
library P1BalanceMath {
    using BaseMath for uint256;
    using SafeCast for uint256;
    using SafeMath for uint256;
    using SignedMath for SignedMath.Int;
    using P1BalanceMath for P1Types.Balance;

    // ============ Functions ============

    /**
     * Create a copy of the balance struct
     */
    function copy(
        P1Types.Balance memory balance
    )
        internal
        pure
        returns (P1Types.Balance memory)
    {
        return P1Types.Balance({
            marginIsPositive: balance.marginIsPositive,
            positionIsPositive: balance.positionIsPositive,
            margin: balance.margin,
            position: balance.position
        });
    }

    /**
     * In-place add amount to balance.margin
     */
    function addToMargin(
        P1Types.Balance memory balance,
        uint256 amount
    )
        internal
        pure
    {
        SignedMath.Int memory signedMargin = balance.getMargin();
        signedMargin = signedMargin.add(amount);
        balance.setMargin(signedMargin);
    }

    /**
     * In-place subtract amount from balance.margin
     */
    function subFromMargin(
        P1Types.Balance memory balance,
        uint256 amount
    )
        internal
        pure
    {
        SignedMath.Int memory signedMargin = balance.getMargin();
        signedMargin = signedMargin.sub(amount);
        balance.setMargin(signedMargin);
    }

    /**
     * In-place add amount to balance.position
     */
    function addToPosition(
        P1Types.Balance memory balance,
        uint256 amount
    )
        internal
        pure
    {
        SignedMath.Int memory signedPosition = balance.getPosition();
        signedPosition = signedPosition.add(amount);
        balance.setPosition(signedPosition);
    }

    /**
     * In-place subtract amount from balance.position
     */
    function subFromPosition(
        P1Types.Balance memory balance,
        uint256 amount
    )
        internal
        pure
    {
        SignedMath.Int memory signedPosition = balance.getPosition();
        signedPosition = signedPosition.sub(amount);
        balance.setPosition(signedPosition);
    }

    /**
     * Returns the positive and negative values of the margin and position together, given a price.
     */
    function getPositiveAndNegativeValue(
        P1Types.Balance memory balance,
        uint256 price
    )
        internal
        pure
        returns (uint256, uint256)
    {
        uint256 positiveValue = 0;
        uint256 negativeValue = 0;

        // add value of margin
        if (balance.marginIsPositive) {
            positiveValue = balance.margin;
        } else {
            negativeValue = balance.margin;
        }

        // add value of position
        uint256 positionValue = uint256(balance.position).baseMul(price);
        if (balance.positionIsPositive) {
            positiveValue = positiveValue.add(positionValue);
        } else {
            negativeValue = negativeValue.add(positionValue);
        }

        return (positiveValue, negativeValue);
    }

    // ============ Helper Functions ============

    function getMargin(
        P1Types.Balance memory balance
    )
        internal
        pure
        returns (SignedMath.Int memory)
    {
        return SignedMath.Int({
            value: balance.margin,
            isPositive: balance.marginIsPositive
        });
    }

    function getPosition(
        P1Types.Balance memory balance
    )
        internal
        pure
        returns (SignedMath.Int memory)
    {
        return SignedMath.Int({
            value: balance.position,
            isPositive: balance.positionIsPositive
        });
    }

    function setMargin(
        P1Types.Balance memory balance,
        SignedMath.Int memory signedInt
    )
        internal
        pure
    {
        balance.margin = signedInt.value.toUint120();
        balance.marginIsPositive = signedInt.isPositive;
    }

    function setPosition(
        P1Types.Balance memory balance,
        SignedMath.Int memory signedInt
    )
        internal
        pure
    {
        balance.position = signedInt.value.toUint120();
        balance.positionIsPositive = signedInt.isPositive;
    }
}
