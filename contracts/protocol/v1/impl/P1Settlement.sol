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
import { SignedMath } from "../../lib/SignedMath.sol";
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
    using SignedMath for SignedMath.Int;

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
            // turn the current index into a signed integer
            SignedMath.Int memory signedIndex = SignedMath.Int({
                value: index.value,
                isPositive: index.isPositive
            });

            (
                bool fundingPositive,
                uint256 fundingValue
            ) = I_P1Funder(_FUNDER_).getFunding(timeDelta);

            // multiply funding by price
            fundingValue = fundingValue.baseMul(price);

            // affect positive and negative by FP or 1/FP
            if (fundingPositive) {
                signedIndex = signedIndex.add(fundingValue);
            } else {
                signedIndex = signedIndex.sub(fundingValue);
            }

            // store new index
            _INDEX_ = P1Types.Index({
                timestamp: block.timestamp.toUint32(),
                isPositive: signedIndex.isPositive,
                value: signedIndex.value.toUint128()
            });

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

        // get the difference between the newIndex and oldIndex
        SignedMath.Int memory signedIndexDiff = SignedMath.Int({
            isPositive: newIndex.isPositive,
            value: newIndex.value
        });
        if (oldIndex.isPositive) {
            signedIndexDiff = signedIndexDiff.sub(oldIndex.value);
        } else {
            signedIndexDiff = signedIndexDiff.add(oldIndex.value);
        }

        // settlement
        signedIndexDiff.value = signedIndexDiff.value.baseMul(balance.position);
        if (signedIndexDiff.isPositive) {
            _BALANCES_[account] = balance.marginAdd(signedIndexDiff.value);
        } else {
            _BALANCES_[account] = balance.marginSub(signedIndexDiff.value);
        }

        emit LogAccountSettled(
            account,
            signedIndexDiff.isPositive,
            signedIndexDiff.value
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

        // add value of margin
        if (balance.marginIsPositive) {
            positiveValue = balance.margin;
        } else {
            negativeValue = balance.margin;
        }

        // add value of position
        uint256 positionValue = uint256(balance.position).baseMul(context.price);
        if (balance.positionIsPositive) {
            positiveValue = positiveValue.add(positionValue);
        } else {
            negativeValue = negativeValue.add(positionValue);
        }

        return positiveValue.mul(BaseMath.base()) >= negativeValue.mul(context.minCollateral);
    }
}
