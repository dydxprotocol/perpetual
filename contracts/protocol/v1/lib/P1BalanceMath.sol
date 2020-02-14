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

    // ============ Functions ============

    function marginAdd(
        P1Types.Balance memory balance,
        uint256 amount
    )
        internal
        pure
        returns (P1Types.Balance memory)
    {
        SignedMath.Int memory signedMargin = marginToSignedInt(balance);
        signedMargin = signedMargin.add(amount);
        return signedIntToMargin(balance, signedMargin);
    }

    function marginSub(
        P1Types.Balance memory balance,
        uint256 amount
    )
        internal
        pure
        returns (P1Types.Balance memory)
    {
        SignedMath.Int memory signedMargin = marginToSignedInt(balance);
        signedMargin = signedMargin.sub(amount);
        return signedIntToMargin(balance, signedMargin);
    }

    function positionAdd(
        P1Types.Balance memory balance,
        uint256 amount
    )
        internal
        pure
        returns (P1Types.Balance memory)
    {
        SignedMath.Int memory signedPosition = positionToSignedInt(balance);
        signedPosition = signedPosition.add(amount);
        return signedIntToPosition(balance, signedPosition);
    }

    function positionSub(
        P1Types.Balance memory balance,
        uint256 amount
    )
        internal
        pure
        returns (P1Types.Balance memory)
    {
        SignedMath.Int memory signedPosition = positionToSignedInt(balance);
        signedPosition = signedPosition.sub(amount);
        return signedIntToPosition(balance, signedPosition);
    }

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

    function marginToSignedInt(
        P1Types.Balance memory balance
    )
        private
        pure
        returns (SignedMath.Int memory)
    {
        return SignedMath.Int({
            value: balance.margin,
            isPositive: balance.marginIsPositive
        });
    }

    function signedIntToMargin(
        P1Types.Balance memory balance,
        SignedMath.Int memory signedInt
    )
        private
        pure
        returns (P1Types.Balance memory)
    {
        return P1Types.Balance({
            marginIsPositive: signedInt.isPositive,
            positionIsPositive: balance.positionIsPositive,
            margin: signedInt.value.toUint112(),
            position: balance.position
        });
    }

    function positionToSignedInt(
        P1Types.Balance memory balance
    )
        private
        pure
        returns (SignedMath.Int memory)
    {
        return SignedMath.Int({
            value: balance.position,
            isPositive: balance.positionIsPositive
        });
    }

    function signedIntToPosition(
        P1Types.Balance memory balance,
        SignedMath.Int memory signedInt
    )
        private
        pure
        returns (P1Types.Balance memory)
    {
        return P1Types.Balance({
            marginIsPositive: balance.marginIsPositive,
            positionIsPositive: signedInt.isPositive,
            margin: balance.margin,
            position: signedInt.value.toUint112()
        });
    }
}
