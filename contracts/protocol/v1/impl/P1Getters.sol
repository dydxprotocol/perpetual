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

import { P1Storage } from "./P1Storage.sol";
import { I_P1Funder } from "../intf/I_P1Funder.sol";
import { I_P1Oracle } from "../intf/I_P1Oracle.sol";
import { I_P1Vault } from "../intf/I_P1Vault.sol";
import { P1Types } from "../lib/P1Types.sol";


/**
 * @title P1Getters
 * @author dYdX
 *
 * Getters contract
 */
contract P1Getters is
    P1Storage
{
    // ============ Account Getters ============

    function getAccountBalance(
        bytes32 account
    )
        external
        view
        returns(P1Types.Balance memory)
    {
        return _BALANCES_[account];
    }

    function getAccountIndex(
        bytes32 account
    )
        external
        view
        returns(P1Types.Index memory)
    {
        return _INDEXES_[account];
    }

    // ============ Global Getters ============

    function getIsOperator(
        address operator
    )
        external
        view
        returns(bool)
    {
        return _OPERATORS_[operator];
    }

    function getOracleContract()
        external
        view
        returns(I_P1Oracle)
    {
        return _ORACLE_;
    }

    function getFunderContract()
        external
        view
        returns(I_P1Funder)
    {
        return _FUNDER_;
    }

    function getVaultContract()
        external
        view
        returns(I_P1Vault)
    {
        return _VAULT_;
    }

    function getGlobalIndex()
        external
        view
        returns(P1Types.Index memory)
    {
        return _INDEX_;
    }

    function getOpenInterest()
        external
        view
        returns(uint256)
    {
        return _OPEN_INTEREST_;
    }
}
