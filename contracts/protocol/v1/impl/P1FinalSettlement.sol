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
import { P1Storage } from "./P1Storage.sol";
import { P1Types } from "../lib/P1Types.sol";


/**
 * @title P1FinalSettlement
 * @author dYdX
 *
 * Admin logic contract
 */
contract P1FinalSettlement is
    P1Storage
{
    // ============ Events ============

    event LogWithdrawFinalSettlement(
        address indexed account,
        uint256 amount
    );

    // ============ Modifiers ============

    /**
    * @dev Modifier to ensure the function is not run after final settlement has been enabled.
    */
    modifier noFinalSettlement() {
        require(
            !_FINAL_SETTLEMENT_ENABLED_,
            "Not permitted during final settlement"
        );
        _;
    }

    /**
    * @dev Modifier to ensure the function is only run after final settlement has been enabled.
    */
    modifier onlyFinalSettlement() {
        require(
            _FINAL_SETTLEMENT_ENABLED_,
            "Only permitted during final settlement"
        );
        _;
    }

    // ============ Functions ============

    function withdrawFinalSettlement()
        external
        onlyFinalSettlement
        nonReentrant
    {
        uint256 amount = 0;
        // TODO: math.

        SafeERC20.safeTransfer(
            IERC20(_TOKEN_),
            msg.sender,
            amount
        );

        _BALANCES_[msg.sender].margin = 0;
        _BALANCES_[msg.sender].position = 0;

        emit LogWithdrawFinalSettlement(
            msg.sender,
            amount
        );
    }
}
