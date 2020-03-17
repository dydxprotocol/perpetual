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

import { Storage } from "../lib/Storage.sol";
import { P1Admin } from "./impl/P1Admin.sol";
import { P1FinalSettlement } from "./impl/P1FinalSettlement.sol";
import { P1Getters } from "./impl/P1Getters.sol";
import { P1Margin } from "./impl/P1Margin.sol";
import { P1Operator } from "./impl/P1Operator.sol";
import { P1Trade } from "./impl/P1Trade.sol";
import { P1Types } from "./lib/P1Types.sol";


/**
 * @title PerpetualV1
 * @author dYdX
 *
 * Main Perpetual implementation contract that inherits from other contracts.
 */
contract PerpetualV1 is
    P1FinalSettlement,
    P1Admin,
    P1Getters,
    P1Margin,
    P1Operator,
    P1Trade
{
    // EIP712 Domain Name value
    string constant private EIP712_DOMAIN_NAME = "dYdX.PerpetualV1";

    // EIP712 Domain Version value
    string constant private EIP712_DOMAIN_VERSION = "1.0";

    // Hash of the EIP712 Domain Separator Schema.
    /* solium-disable-next-line indentation */
    bytes32 constant private EIP712_DOMAIN_SEPARATOR_SCHEMA_HASH = keccak256(abi.encodePacked(
        "EIP712Domain(",
        "string name,",
        "string version,",
        "uint256 chainId,",
        "address verifyingContract",
        ")"
    ));

    // Non-colliding storage slot.
    bytes32 internal constant PERPETUAL_V1_INITIALIZE_SLOT =
    bytes32(uint256(keccak256("dYdX.PerpetualV1.initialize")) - 1);

    /**
     * Once-only initializer function that replaces the constructor since this contract is proxied.
     * Uses a non-colliding storage slot to store if this version has been initialized yet.
     */
    function initializeV1(
        uint256 chainId,
        address token,
        address oracle,
        address funder,
        uint256 minCollateral
    )
        external
        onlyAdmin
    {
        // only allow initialization once
        require(
            Storage.load(PERPETUAL_V1_INITIALIZE_SLOT) == 0x0,
            "PerpetualV1 already initialized"
        );
        Storage.store(PERPETUAL_V1_INITIALIZE_SLOT, bytes32(uint256(1)));

        _TOKEN_ = token;
        _ORACLE_ = oracle;
        _FUNDER_ = funder;
        _MIN_COLLATERAL_ = minCollateral;

        _GLOBAL_INDEX_ = P1Types.Index({
            timestamp: uint32(block.timestamp),
            isPositive: false,
            value: 0
        });

        /* solium-disable-next-line indentation */
        _EIP712_DOMAIN_HASH_ = keccak256(abi.encode(
            EIP712_DOMAIN_SEPARATOR_SCHEMA_HASH,
            keccak256(bytes(EIP712_DOMAIN_NAME)),
            keccak256(bytes(EIP712_DOMAIN_VERSION)),
            chainId,
            address(this)
        ));
    }
}
