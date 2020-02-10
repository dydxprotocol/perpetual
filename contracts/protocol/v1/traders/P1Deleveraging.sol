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
import { BaseMath } from "../../lib/BaseMath.sol";
import { P1Getters } from "../impl/P1Getters.sol";
import { P1Types } from "../lib/P1Types.sol";


/**
 * @title P1Deleveraging
 * @author dYdX
 *
 * P1Deleveraging contract
 */
contract P1Deleveraging {
    using BaseMath for uint256;
    using SafeMath for uint256;

    // ============ Structs ============

    struct TradeData {
        bool isBuy;
        uint256 amount;
        address maker;
        address taker;
    }

    // ============ Events ============

    event LogContractStatusSet(
        bool operational
    );

    event LogDeleveraged(
        address indexed maker,
        address indexed taker,
        uint256 amount,
        bool isBuy
    );

    // ============ Mutable Storage ============

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
        address /* sender */,
        address maker,
        address taker,
        uint256 price,
        bytes calldata data
    )
        external
        returns(P1Types.TradeResult memory)
    {
        require(
            msg.sender == _PERPETUAL_V1_,
            "Sender must be PerpetualV1"
        );

        TradeData memory tradeData = abi.decode(data, (TradeData));

        _verifyTrade(
            tradeData,
            maker,
            taker,
            price
        );

        emit LogDeleveraged(
            tradeData.maker,
            tradeData.taker,
            tradeData.amount,
            tradeData.isBuy
        );

        // When partially deleveraging the maker, maintain the same position/margin ratio.
        P1Types.Balance memory makerBalance = P1Getters(_PERPETUAL_V1_).getAccountBalance(maker);
        uint256 numerator = tradeData.amount.mul(makerBalance.margin);
        uint256 marginAmount = numerator.div(makerBalance.position);

        // Ensure the collateralization of the maker does not decrease.
        if (tradeData.isBuy && numerator.mod(makerBalance.position) != 0) {
            marginAmount = marginAmount.add(1);
        }

        return P1Types.TradeResult({
            marginAmount: marginAmount,
            positionAmount: tradeData.amount,
            isBuy: tradeData.isBuy
        });
    }

    function _verifyTrade(
        TradeData memory tradeData,
        address maker,
        address taker,
        uint256 price
    )
        private
        view
    {
        require(
            tradeData.maker == maker,
            "Trade data maker does not match maker"
        );
        require(
            tradeData.taker == taker,
            "Trade data taker does not match taker"
        );

        P1Types.Balance memory makerBalance = P1Getters(_PERPETUAL_V1_).getAccountBalance(maker);

        require(
            _isUnderwater(makerBalance, price),
            "Cannot deleverage since maker is not underwater"
        );
        require(
            makerBalance.positionIsPositive == tradeData.isBuy,
            "Deleverage operation must reduce maker's position size"
        );
        require(
            makerBalance.position >= tradeData.amount,
            "Maker position is less than the deleverage amount"
        );

        P1Types.Balance memory takerBalance = P1Getters(_PERPETUAL_V1_).getAccountBalance(taker);

        require(
            takerBalance.positionIsPositive != tradeData.isBuy,
            "Taker position has wrong sign to deleverage this maker"
        );
        require(
            takerBalance.position >= tradeData.amount,
            "Taker position is less than the deleverage amount"
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
        uint256 positiveValue = 0;
        uint256 negativeValue = 0;

        // add value of margin
        if (balance.marginIsPositive) {
            positiveValue = balance.margin;
        } else {
            negativeValue = balance.margin;
        }

        // add value of position
        uint256 positionValue = uint256(balance.position).baseMul(price);
        if (balance.positionIsPositive) {
            positiveValue = positiveValue.add(positionValue);
        } else {
            negativeValue = negativeValue.add(positionValue);
        }

        return positiveValue < negativeValue;
    }
}
