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

import { BaseMath } from "../protocol/lib/BaseMath.sol";
import { Math } from "../protocol/lib/Math.sol";
import { Require } from "../protocol/lib/Require.sol";
import { SafeCast } from "../protocol/lib/SafeCast.sol";
import { SignedMath } from "../protocol/lib/SignedMath.sol";
import { Storage } from "../protocol/lib/Storage.sol";
import { TypedSignature } from "../protocol/lib/TypedSignature.sol";
// import { P1BalanceMath } from "../protocol/v1/lib/P1BalanceMath.sol";


/**
 * @title Test_Lib
 * @author dYdX
 *
 * Exposes library functions for testing.
 */
/* solium-disable-next-line camelcase */
contract Test_Lib {

    // ============ BaseMath.sol ============

    function base()
        external
        pure
        returns (uint256)
    {
        return BaseMath.base();
    }

    function baseMul(
        uint256 value,
        uint256 basedValue
    )
        external
        pure
        returns (uint256)
    {
        return BaseMath.baseMul(value, basedValue);
    }

    // ============ Math.sol ============

    function getFraction(
        uint256 target,
        uint256 numerator,
        uint256 denominator
    )
        external
        pure
        returns (uint256)
    {
        return Math.getFraction(target, numerator, denominator);
    }

    function getFractionRoundUp(
        uint256 target,
        uint256 numerator,
        uint256 denominator
    )
        external
        pure
        returns (uint256)
    {
        return Math.getFractionRoundUp(target, numerator, denominator);
    }

    function min(
        uint256 a,
        uint256 b
    )
        external
        pure
        returns (uint256)
    {
        return Math.min(a, b);
    }

    function max(
        uint256 a,
        uint256 b
    )
        external
        pure
        returns (uint256)
    {
        return Math.max(a, b);
    }

    // ============ Require.sol ============

    function that(
        bool must,
        string calldata reason,
        address addr
    )
        external
        pure
    {
        Require.that(must, reason, addr);
    }

    // ============ SafeCast.sol ============

    function toUint128(
        uint256 value
    )
        external
        pure
        returns (uint128)
    {
        return SafeCast.toUint128(value);
    }

    function toUint120(
        uint256 value
    )
        external
        pure
        returns (uint120)
    {
        return SafeCast.toUint120(value);
    }

    function toUint32(
        uint256 value
    )
        external
        pure
        returns (uint32)
    {
        return SafeCast.toUint32(value);
    }

    // ============ SignedMath.sol ============


    function add(
        SignedMath.Int calldata sint,
        uint256 value
    )
        external
        pure
        returns (SignedMath.Int memory)
    {
        return SignedMath.add(sint, value);
    }

    function sub(
        SignedMath.Int calldata sint,
        uint256 value
    )
        external
        pure
        returns (SignedMath.Int memory)
    {
        return SignedMath.sub(sint, value);
    }

    // ============ Storage.sol ============

    function load(
        bytes32 slot
    )
        external
        view
        returns (bytes32)
    {
        Storage.load(slot);
    }

    function store(
        bytes32 slot,
        bytes32 value
    )
        external
    {
        Storage.store(slot, value);
    }

    // ============ TypedSignature.sol ============

    function recover(
        bytes32 hash,
        bytes calldata signatureBytes
    )
        external
        pure
        returns (address)
    {
        TypedSignature.Signature memory signature = abi.decode(
            signatureBytes,
            (TypedSignature.Signature)
        );
        return TypedSignature.recover(hash, signature);
    }
}
