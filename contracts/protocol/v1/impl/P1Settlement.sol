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
import { P1Storage } from "./P1Storage.sol";
import { BaseMath } from "../../lib/BaseMath.sol";
import { SafeCast } from "../../lib/SafeCast.sol";
import { I_P1Funder } from "../intf/I_P1Funder.sol";
import { I_P1Oracle } from "../intf/I_P1Oracle.sol";
import { P1BalanceMath } from "../lib/P1BalanceMath.sol";
import { P1Types } from "../lib/P1Types.sol";


/**
 * @title P1Settlement
 * @author dYdX
 *
 * Settlement logic contract
 */
contract P1Settlement is
    P1Storage
{
    using BaseMath for uint256;
    using SafeCast for uint256;
    using SafeMath for uint256;
    using P1BalanceMath for P1Types.Balance;

    // ============ Events ============

    event LogIndexUpdated(
        P1Types.Index index
    );

    event LogAccountSettled(
        address indexed account,
        bool positive,
        uint256 amount
    );

    // ============ Functions ============

    function _loadContext()
        internal
        returns (P1Types.Context memory)
    {
        // SLOAD old index
        P1Types.Index memory index = _INDEX_;

        // get Price (P)
        uint256 price = I_P1Oracle(_ORACLE_).getPrice();

        // get Funding (F)
        uint256 timeDelta = block.timestamp.sub(index.timestamp);
        if (timeDelta > 0) {
            (
                bool fundingPositive,
                uint256 fundingValue
            ) = I_P1Funder(_FUNDER_).getFunding(timeDelta);

            // multiply funding by price, add 1
            fundingValue = fundingValue.baseMul(price).addOne();

            // affect positive and negative by FP or 1/FP
            if (fundingPositive) {
                index.longs = uint256(index.longs).baseDiv(fundingValue).toUint112();
                index.shorts = uint256(index.shorts).baseMul(fundingValue).toUint112();
            } else {
                index.longs = uint256(index.longs).baseMul(fundingValue).toUint112();
                index.shorts = uint256(index.shorts).baseDiv(fundingValue).toUint112();
            }

            // store new index
            index.timestamp = block.timestamp.toUint32();
            _INDEX_ = index;

            emit LogIndexUpdated(index);
        }

        return P1Types.Context({
            price: price,
            minCollateral: _MIN_COLLATERAL_,
            index: index
        });
    }

    function _settleAccounts(
        P1Types.Context memory context,
        address[] memory accounts
    )
        internal
    {
        for (uint256 i = 0; i < accounts.length; i++) {
            _settleAccount(context, accounts[i]);
        }
    }

    function _settleAccount(
        P1Types.Context memory context,
        address account
    )
        internal
    {
        P1Types.Index memory newIndex = context.index;
        P1Types.Index memory oldIndex = _INDEXES_[account];

        // do nothing if no settlement is needed
        if (oldIndex.timestamp == newIndex.timestamp) {
            return;
        }

        _INDEXES_[account] = newIndex;

        P1Types.Balance memory balance = _BALANCES_[account];

        // no need for settlement if balance is zero
        if (balance.position == 0) {
            return;
        }

        // settlement
        uint256 newValue = 0;
        uint256 oldValue = 0;
        if (balance.positionPositive) {
            newValue = newIndex.longs;
            oldValue = oldIndex.longs;
        } else {
            newValue = newIndex.shorts;
            oldValue = oldIndex.shorts;
        }

        bool positiveSettlement;
        uint256 settlementAmount;
        if (newValue > oldValue) {
            positiveSettlement = true;
            settlementAmount = newValue.sub(oldValue).mul(balance.position);
            _BALANCES_[account] = balance.marginAdd(settlementAmount);
        } else {
            positiveSettlement = false;
            settlementAmount = oldValue.sub(newValue).mul(balance.position);
            _BALANCES_[account] = balance.marginSub(settlementAmount);
        }

        emit LogAccountSettled(
            account,
            positiveSettlement,
            settlementAmount
        );
    }

    function _isCollateralized(
        P1Types.Context memory context,
        address account
    )
        internal
        view
        returns (bool)
    {
        P1Types.Balance memory balance = _BALANCES_[account];

        uint256 positiveValue = 0;
        uint256 negativeValue = 0;

        if (balance.margin != 0) {
            if (balance.marginPositive) {
                positiveValue = balance.margin;
            } else {
                negativeValue = balance.margin;
            }
        }

        if (balance.position != 0) {
            uint256 positionValue = uint256(balance.position).baseMul(context.price);
            if (balance.marginPositive) {
                positiveValue = positiveValue.add(positionValue);
            } else {
                negativeValue = negativeValue.add(positionValue);
            }
        }

        return positiveValue.mul(BaseMath.base()) >= negativeValue.mul(context.minCollateral);
    }
}
