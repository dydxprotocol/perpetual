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
        uint256 amount = abi.decode(data, (uint256));

        _verifyTrade(
            maker,
            taker,
            amount,
            price
        );

        P1Types.Balance memory makerBalance = P1Getters(_PERPETUAL_V1_).getAccountBalance(maker);
        bool isBuy = makerBalance.positionIsPositive;

        // When partially deleveraging the maker, maintain the same position/margin ratio.
        uint256 numerator = amount.mul(makerBalance.margin);
        uint256 marginAmount = numerator.div(makerBalance.position);

        // Ensure the collateralization of the maker does not decrease.
        if (isBuy && numerator.mod(makerBalance.position) != 0) {
            marginAmount = marginAmount.add(1);
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
            isBuy: isBuy
        });
    }

    function _verifyTrade(
        address maker,
        address taker,
        uint256 amount,
        uint256 price
    )
        private
        view
    {
        P1Types.Balance memory makerBalance = P1Getters(_PERPETUAL_V1_).getAccountBalance(maker);

        require(
            _isUnderwater(makerBalance, price),
            "Cannot deleverage since maker is not underwater"
        );
        require(
            makerBalance.position >= amount,
            "Maker position is less than the deleverage amount"
        );

        P1Types.Balance memory takerBalance = P1Getters(_PERPETUAL_V1_).getAccountBalance(taker);

        require(
            takerBalance.positionIsPositive != makerBalance.positionIsPositive,
            "Taker position has wrong sign to deleverage this maker"
        );
        require(
            takerBalance.position >= amount,
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
