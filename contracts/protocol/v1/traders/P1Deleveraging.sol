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
import { Ownable } from "@openzeppelin/contracts/ownership/Ownable.sol";
import { P1TraderConstants } from "./P1TraderConstants.sol";
import { Math } from "../../lib/Math.sol";
import { P1Getters } from "../impl/P1Getters.sol";
import { I_P1Oracle } from "../intf/I_P1Oracle.sol";
import { P1BalanceMath } from "../lib/P1BalanceMath.sol";
import { P1Types } from "../lib/P1Types.sol";


/**
 * @title P1Deleveraging
 * @author dYdX
 *
 * P1Deleveraging contract
 */
contract P1Deleveraging is
    Ownable,
    P1TraderConstants
{
    using SafeMath for uint256;
    using Math for uint256;
    using P1BalanceMath for P1Types.Balance;

    // ============ Structs ============

    struct TradeData {
        uint256 amount;

        // If true, the trade will revert if the maker or taker position is less than the amount.
        bool allOrNothing;
    }

    // ============ Events ============

    event LogDeleveraged(
        address indexed maker,
        address indexed taker,
        uint256 amount,
        bool isBuy
    );

    event LogMarkedForDeleveraging(
        address indexed account
    );

    event LogUnmarkedForDeleveraging(
        address indexed account
    );

    // ============ Immutable Storage ============

    // address of the perpetual contract
    address public _PERPETUAL_V1_;

    // Waiting period for non-admin to deleverage an account after marking it.
    uint256 constant public DELEVERAGING_TIMELOCK_S = 1800; // 30 minutes

    // ============ Mutable Storage ============

    // account => timestamp at which an account was marked as underwater
    //
    // After an account has been marked for the timelock period, it can be deleveraged by anybody.
    // The contract admin can deleverage underwater accounts at any time.
    mapping (address => uint256) public _MARKED_TIMESTAMP_;

    // ============ Constructor ============

    constructor (
        address perpetualV1
    )
        public
    {
        _PERPETUAL_V1_ = perpetualV1;
    }

    function trade(
        address sender,
        address maker,
        address taker,
        uint256 price,
        bytes calldata data,
        bytes32 traderFlags
    )
        external
        returns(P1Types.TradeResult memory)
    {
        address perpetual = _PERPETUAL_V1_;
        require(
            msg.sender == perpetual,
            "msg.sender must be PerpetualV1"
        );
        require(
            traderFlags & TRADER_FLAG_ORDERS == 0,
            "cannot deleverage after execution of an order, in the same tx"
        );

        _verifyPermissions(
            sender,
            maker
        );

        TradeData memory tradeData = abi.decode(data, (TradeData));
        P1Types.Balance memory makerBalance = P1Getters(perpetual).getAccountBalance(maker);
        P1Types.Balance memory takerBalance = P1Getters(perpetual).getAccountBalance(taker);

        _verifyTrade(
            tradeData,
            makerBalance,
            takerBalance,
            price
        );

        uint256 amount = Math.min(
            tradeData.amount,
            Math.min(makerBalance.position, takerBalance.position)
        );
        bool isBuy = makerBalance.positionIsPositive;

        // When partially deleveraging the maker, maintain the same position/margin ratio.
        // Ensure the collateralization of the maker does not decrease.
        uint256 marginAmount;
        if (isBuy) {
            marginAmount = uint256(makerBalance.margin).getFractionRoundUp(amount, makerBalance.position);
        } else {
            marginAmount = uint256(makerBalance.margin).getFraction(amount, makerBalance.position);
        }

        if (amount == makerBalance.position && _isMarked(maker)) {
            _unmark(maker);
        }

        emit LogDeleveraged(
            maker,
            taker,
            amount,
            isBuy
        );

        return P1Types.TradeResult({
            marginAmount: marginAmount,
            positionAmount: amount,
            isBuy: isBuy,
            traderFlags: TRADER_FLAG_DELEVERAGING
        });
    }

    /**
     * Mark an account as underwater.
     *
     * An account must be marked for a period of time before any non-admin is allowed to
     * deleverage that account.
     */
    function mark(
        address account
    )
        external
    {
        require(
            _isAccountUnderwater(account),
            "Cannot mark since account is not underwater"
        );
        _MARKED_TIMESTAMP_[account] = block.timestamp;
        emit LogMarkedForDeleveraging(account);
    }

    function unmark(
        address account
    )
        external
    {
        require(
            !_isAccountUnderwater(account),
            "Cannot unmark since account is underwater"
        );
        _unmark(account);
    }

    function _unmark(
        address account
    )
        private
    {
        _MARKED_TIMESTAMP_[account] = 0;
        emit LogUnmarkedForDeleveraging(account);
    }

    function _isMarked(
        address account
    )
        private
        view
        returns (bool)
    {
        return _MARKED_TIMESTAMP_[account] != 0;
    }

    function _verifyPermissions(
        address sender,
        address maker
    )
        private
        view
    {
        // The contract admin may deleverage underwater accounts at any time.
        if (sender != owner()) {
            uint256 markedTimestamp = _MARKED_TIMESTAMP_[maker];
            require(
                markedTimestamp != 0,
                "Cannot deleverage since account is not marked"
            );
            uint256 timeDelta = block.timestamp.sub(markedTimestamp);
            require(
                timeDelta >= DELEVERAGING_TIMELOCK_S,
                "Cannot deleverage since account has not been marked for the timelock period"
            );
        }
    }

    function _verifyTrade(
        TradeData memory tradeData,
        P1Types.Balance memory makerBalance,
        P1Types.Balance memory takerBalance,
        uint256 price
    )
        private
        pure
    {
        require(
            _isUnderwater(makerBalance, price),
            "Cannot deleverage since maker is not underwater"
        );
        require(
            !tradeData.allOrNothing || makerBalance.position >= tradeData.amount,
            "allOrNothing is set and maker position is less than amount"
        );
        require(
            takerBalance.positionIsPositive != makerBalance.positionIsPositive,
            "Taker position has wrong sign to deleverage this maker"
        );
        require(
            !tradeData.allOrNothing || takerBalance.position >= tradeData.amount,
            "allOrNothing is set and taker position is less than amount"
        );
    }

    function _isUnderwater(
        P1Types.Balance memory balance,
        uint256 price
    )
        private
        pure
        returns (bool)
    {
        (uint256 positive, uint256 negative) = balance.getPositiveAndNegativeValue(price);
        return positive < negative;
    }

    function _isAccountUnderwater(
        address account
    )
        private
        view
        returns (bool)
    {
        address perpetual = _PERPETUAL_V1_;
        P1Types.Balance memory balance = P1Getters(perpetual).getAccountBalance(account);
        address oracle = P1Getters(perpetual).getOracleContract();
        uint256 price = I_P1Oracle(oracle).getPrice();
        return _isUnderwater(balance, price);
    }
}
