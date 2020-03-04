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

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { P1Getters } from "./P1Getters.sol";
import { P1Settlement } from "./P1Settlement.sol";
import { P1Storage } from "./P1Storage.sol";
import { P1BalanceMath } from "../lib/P1BalanceMath.sol";
import { P1Types } from "../lib/P1Types.sol";


/**
 * @title P1Margin
 * @author dYdX
 *
 * Margin logic contract
 */
contract P1Margin is
    P1Storage,
    P1Getters,
    P1Settlement
{
    using P1BalanceMath for P1Types.Balance;

    // ============ Events ============

    event LogDeposit(
        address indexed account,
        uint256 amount
    );

    event LogWithdraw(
        address indexed account,
        uint256 amount
    );

    // ============ Functions ============

    function deposit(
        address account,
        uint256 amount
    )
        public
        nonReentrant
    {
        P1Types.Context memory context = _loadContext();
        _settleAccount(context, account);

        SafeERC20.safeTransferFrom(
            IERC20(_TOKEN_),
            msg.sender,
            address(this),
            amount
        );

        _BALANCES_[account] = _BALANCES_[account].marginAdd(amount);
        emit LogDeposit(account, amount);
    }

    function withdraw(
        address account,
        uint256 amount
    )
        public
        nonReentrant
    {
        require(
            hasAccountPermissions(account, msg.sender),
            "sender does not have permission to withdraw"
        );

        P1Types.Context memory context = _loadContext();
        _settleAccount(context, account);

        SafeERC20.safeTransfer(
            IERC20(_TOKEN_),
            msg.sender,
            amount
        );

        _BALANCES_[account] = _BALANCES_[account].marginSub(amount);

        require(
            _isCollateralized(context, account),
            "account not collateralized"
        );

        emit LogWithdraw(account, amount);
    }
}
