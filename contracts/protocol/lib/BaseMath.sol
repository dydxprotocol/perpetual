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


/**
 * @title BaseMath
 * @author dYdX
 *
 * @dev Arithmetic for fixed-point numbers with 18 decimals of precision.
 */
library BaseMath {
    using SafeMath for uint256;

    // The number One in the BaseMath system.
    uint256 constant internal BASE = 10 ** 18;

    /**
     * Getter since constants can't be gotten directly from libraries.
     */
    function base()
        internal
        pure
        returns (uint256)
    {
        return BASE;
    }

    /**
     * Multiplies a value by a base value (result rounded down)
     */
    function baseMul(
        uint256 value,
        uint256 basedValue
    )
        internal
        pure
        returns (uint256)
    {
        return value.mul(basedValue).div(BASE);
    }

    /**
     * Multiplies a value by a base value (result rounded up).
     */
    function baseMulRoundUp(
        uint256 value,
        uint256 basedValue
    )
        internal
        pure
        returns (uint256)
    {
        if (value == 0 || basedValue == 0) {
            return 0;
        }
        return value.mul(basedValue).sub(1).div(BASE).add(1);
    }
}
