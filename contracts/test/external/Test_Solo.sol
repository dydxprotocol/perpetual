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

import { I_Solo } from "../../external/dydx/I_Solo.sol";


/**
 * @title Test_Solo
 * @author dYdX
 *
 * Interface for calling the Solo margin smart contract.
 */
/* solium-disable-next-line camelcase */
contract Test_Solo is
  I_Solo
{
    // ============ Events ============

    event LogTestOperateCalled(
        I_Solo.AccountInfo[] accounts,
        I_Solo.ActionArgs[] actions
    );

    // ============ Test Data ============

    mapping(address => bool) internal _GLOBAL_OPERATORS_;
    mapping(address => mapping(address => bool)) internal _LOCAL_OPERATORS_;
    mapping(uint256 => address) public _TOKEN_ADDRESSES_;

    // ============ Test Data Setter Functions ============

    function setIsLocalOperator(
        address owner,
        address operator,
        bool approved
    )
        external
        returns (bool)
    {
        return _LOCAL_OPERATORS_[owner][operator] = approved;
    }

    function setIsGlobalOperator(
        address operator,
        bool approved
    )
        external
        returns (bool)
    {
        return _GLOBAL_OPERATORS_[operator] = approved;
    }

    function setTokenAddress(
        uint256 marketId,
        address tokenAddress
    )
        external
    {
        _TOKEN_ADDRESSES_[marketId] = tokenAddress;
    }

    // ============ Getter Functions ============

    /**
     * Return true if a particular address is approved as an operator for an owner's accounts.
     * Approved operators can act on the accounts of the owner as if it were the operator's own.
     *
     * @param  owner     The owner of the accounts
     * @param  operator  The possible operator
     * @return           True if operator is approved for owner's accounts
     */
    function getIsLocalOperator(
        address owner,
        address operator
    )
        external
        view
        returns (bool)
    {
        return _LOCAL_OPERATORS_[owner][operator];
    }

    /**
     * Return true if a particular address is approved as a global operator. Such an address can
     * act on any account as if it were the operator's own.
     *
     * @param  operator  The address to query
     * @return           True if operator is a global operator
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
     * @notice Get the ERC20 token address for a market.
     *
     * @param  marketId  The market to query
     * @return           The token address
     */
    function getMarketTokenAddress(
        uint256 marketId
    )
        external
        view
        returns (address)
    {
        return _TOKEN_ADDRESSES_[marketId];
    }

    // ============ State-Changing Functions ============

    /**
     * @notice The main entry-point to Solo that allows users and contracts to manage accounts.
     *  Takes one or more actions on one or more accounts. The msg.sender must be the owner or
     *  operator of all accounts except for those being liquidated, vaporized, or traded with.
     *  One call to operate() is considered a singular "operation". Account collateralization is
     *  ensured only after the completion of the entire operation.
     *
     * @param  accounts  A list of all accounts that will be used in this operation. Cannot contain
     *                   duplicates. In each action, the relevant account will be referred to by its
     *                   index in the list.
     * @param  actions   An ordered list of all actions that will be taken in this operation. The
     *                   actions will be processed in order.
     */
    function operate(
        I_Solo.AccountInfo[] calldata accounts,
        I_Solo.ActionArgs[] calldata actions
    )
        external
    {
        emit LogTestOperateCalled(accounts, actions);
    }
}
