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
import { P1Types } from "../lib/P1Types.sol";


/**
 * @title P1Getters
 * @author dYdX
 *
 * @notice Contract for read-only getters.
 */
contract P1Getters is
    P1Storage
{
    // ============ Account Getters ============

    /**
     * @notice Gets the most recently cached balance of an account.
     * @param account The address of the account to query the balances of.
     * @return The balances of the account.
     */
    function getAccountBalance(
        address account
    )
        external
        view
        returns (P1Types.Balance memory)
    {
        return _BALANCES_[account];
    }

    /**
     * @notice Gets the most recently cached index of an account.
     * @param account The address of the account to query the index of.
     * @return The index of the account.
     */
    function getAccountIndex(
        address account
    )
        external
        view
        returns (P1Types.Index memory)
    {
        return _LOCAL_INDEXES_[account];
    }

    function getIsLocalOperator(
        address account,
        address operator
    )
        external
        view
        returns (bool)
    {
        return _LOCAL_OPERATORS_[account][operator];
    }

    // ============ Global Getters ============

    /**
     * @notice Gets the global operator status of an address.
     * @param operator The address of the operator to query the status of.
     * @return True if the address is a global operator, False otherwise.
     */
    function getIsGlobalOperator(
        address operator
    )
        external
        view
        returns (bool)
    {
        return _GLOBAL_OPERATORS_[operator];
    }

    /**
     * @notice Gets the address of the ERC20 margin contract used for margin deposits.
     * @return The address of the ERC20 token.
     */
    function getTokenContract()
        external
        view
        returns (address)
    {
        return _TOKEN_;
    }

    /**
     * @notice Gets the current address of the price oracle contract.
     * @return The address of the price oracle contract.
     */
    function getOracleContract()
        external
        view
        returns (address)
    {
        return _ORACLE_;
    }

    /**
     * @notice Gets the current address of the funder contract.
     * @return The address of the funder contract.
     */
    function getFunderContract()
        external
        view
        returns (address)
    {
        return _FUNDER_;
    }

    /**
     * @notice Gets the most recently cached global index.
     * @return The most recently cached global index.
     */
    function getGlobalIndex()
        external
        view
        returns (P1Types.Index memory)
    {
        return _GLOBAL_INDEX_;
    }

    /**
     * @notice Gets minimum collateralization ratio of the protocol.
     * @dev The minimum collateral is returned as a number with a precision of 18 deecimal places.
     * @return The minimum-acceptable collateralization ratio.
     */
    function getMinCollateral()
        external
        view
        returns (uint256)
    {
        return _MIN_COLLATERAL_;
    }

    /**
     * @notice Gets the status of whether final-settlement was initiated by the Admin.
     * @return True if final-settlement was enabled, False otherwise.
     */
    function getFinalSettlementEnabled()
        external
        view
        returns (bool)
    {
        return _FINAL_SETTLEMENT_ENABLED_;
    }

    // ============ Public Getters ============

    /**
     * @norice Gets whether an address has permissions to operate an account.
     * @param account The account to query.
     * @param operator The address to query.
     * @returns True if the operator has permission to operate the account.
     */
    function hasAccountPermissions(
        address account,
        address operator
    )
        public
        view
        returns (bool)
    {
        return account == operator
            || _GLOBAL_OPERATORS_[operator]
            || _LOCAL_OPERATORS_[account][operator];
    }
}
