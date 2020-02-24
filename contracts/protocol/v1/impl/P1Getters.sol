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
 * Getters contract
 */
contract P1Getters is
    P1Storage
{
    // ============ Account Getters ============

    function getAccountBalance(
        address account
    )
        external
        view
        returns (P1Types.Balance memory)
    {
        return _BALANCES_[account];
    }

    function getAccountIndex(
        address account
    )
        external
        view
        returns (P1Types.Index memory)
    {
        return _INDEXES_[account];
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

    function getIsGlobalOperator(
        address operator
    )
        external
        view
        returns (bool)
    {
        return _GLOBAL_OPERATORS_[operator];
    }

    function getTokenContract()
        external
        view
        returns (address)
    {
        return _TOKEN_;
    }

    function getOracleContract()
        external
        view
        returns (address)
    {
        return _ORACLE_;
    }

    function getFunderContract()
        external
        view
        returns (address)
    {
        return _FUNDER_;
    }

    function getGlobalIndex()
        external
        view
        returns (P1Types.Index memory)
    {
        return _INDEX_;
    }

    function getOpenInterest()
        external
        view
        returns (uint256)
    {
        return _TOTAL_POSITION_;
    }

    function getTotalMargin()
        external
        view
        returns (uint256)
    {
        return _TOTAL_MARGIN_;
    }

    function getMinCollateral()
        external
        view
        returns (uint256)
    {
        return _MIN_COLLATERAL_;
    }

    // ============ Public Getters ============

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
