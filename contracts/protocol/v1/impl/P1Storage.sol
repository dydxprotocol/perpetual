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

import { I_P1Funder } from "../intf/I_P1Funder.sol";
import { I_P1Oracle } from "../intf/I_P1Oracle.sol";
import { I_P1Vault } from "../intf/I_P1Vault.sol";
import { P1Types } from "../lib/P1Types.sol";


/**
 * @title P1Storage
 * @author dYdX
 *
 * Storage contract
 */
contract P1Storage {
    mapping(bytes32 => P1Types.Balance) internal _BALANCES_;
    mapping(bytes32 => P1Types.Index) internal _INDEXES_;

    mapping(address => bool) internal _OPERATORS_;

    I_P1Oracle public _ORACLE_;
    I_P1Funder public _FUNDER_;
    I_P1Vault public _VAULT_;

    P1Types.Index public _INDEX_;
    uint256 internal _OPEN_INTEREST_;
}
