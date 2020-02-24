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
import { P1Constants } from "../P1Constants.sol";
import { BaseMath } from "../../lib/BaseMath.sol";
import { Math } from "../../lib/Math.sol";
import { P1Getters } from "../impl/P1Getters.sol";
import { P1BalanceMath } from "../lib/P1BalanceMath.sol";
import { P1Types } from "../lib/P1Types.sol";


/**
 * @title P1Liquidation
 * @author dYdX
 *
 * P1Liquidation contract
 */
contract P1Liquidation is
    P1Constants
{
    using SafeMath for uint256;
    using Math for uint256;
    using P1BalanceMath for P1Types.Balance;

    // ============ Structs ============

    struct TradeData {
        uint256 amount;

        // If true, the trade will revert if the maker position is less than the amount.
        bool allOrNothing;
    }

    // ============ Events ============

    event LogLiquidated(
        address indexed maker,
        address indexed taker,
        uint256 amount,
        bool isBuy
    );

    // ============ Immutable Storage ============

    // address of the perpetual contract
    address public _PERPETUAL_V1_;

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
        bytes32 /* traderFlags */
    )
        external
        returns(P1Types.TradeResult memory)
    {
        require(
            msg.sender == _PERPETUAL_V1_,
            "Sender must be PerpetualV1"
        );
        require(
            sender == taker,
            "Cannot liquidate since the sender is not the taker (i.e. liquidator)"
        );

        TradeData memory tradeData = abi.decode(data, (TradeData));
        P1Types.Balance memory makerBalance = P1Getters(_PERPETUAL_V1_).getAccountBalance(maker);

        _verifyTrade(tradeData, makerBalance, price);

        uint256 amount = Math.min(tradeData.amount, makerBalance.position);
        bool isBuy = makerBalance.positionIsPositive;

        // When partially liquidating the maker, maintain the same position/margin ratio.
        // Ensure the collateralization of the maker does not decrease.
        uint256 marginAmount;
        if (isBuy) {
            marginAmount = uint256(makerBalance.margin).getFractionRoundUp(amount, makerBalance.position);
        } else {
            marginAmount = uint256(makerBalance.margin).getFraction(amount, makerBalance.position);
        }

        emit LogLiquidated(
            maker,
            taker,
            amount,
            isBuy
        );

        return P1Types.TradeResult({
            marginAmount: marginAmount,
            positionAmount: amount,
            isBuy: isBuy,
            traderFlags: TRADER_FLAG_LIQUIDATION
        });
    }

    function _verifyTrade(
        TradeData memory tradeData,
        P1Types.Balance memory makerBalance,
        uint256 price
    )
        private
        view
    {
        require(
            _isUndercollateralized(makerBalance, price),
            "Cannot liquidate since maker is not undercollateralized"
        );
        require(
            !tradeData.allOrNothing || makerBalance.position >= tradeData.amount,
            "allOrNothing is set and maker position is less than amount"
        );
    }

    function _isUndercollateralized(
        P1Types.Balance memory balance,
        uint256 price
    )
        private
        view
        returns (bool)
    {
        (uint256 positive, uint256 negative) = balance.getPositiveAndNegativeValue(price);
        uint256 minCollateral = P1Getters(_PERPETUAL_V1_).getMinCollateral();
        return positive.mul(BaseMath.base()) < negative.mul(minCollateral);
    }
}
