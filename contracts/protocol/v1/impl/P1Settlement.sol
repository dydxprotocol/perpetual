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
        bool isPositive,
        uint256 amount
    );

    // ============ Functions ============

    function _loadContext()
        internal
        returns (P1Types.Context memory)
    {
        // SLOAD old index
        P1Types.Index memory index = _GLOBAL_INDEX_;

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

            // Get the funding rate, applied over the time delta.
            (
                bool fundingPositive,
                uint256 fundingValue
            ) = I_P1Funder(_FUNDER_).getFunding(timeDelta);
            fundingValue = fundingValue.baseMul(price);

            // Update the index according to the funding rate, applied over the time delta.
            if (fundingPositive) {
                signedIndex = signedIndex.add(fundingValue);
            } else {
                signedIndex = signedIndex.sub(fundingValue);
            }

            // store new index
            index = P1Types.Index({
                timestamp: block.timestamp.toUint32(),
                isPositive: signedIndex.isPositive,
                value: signedIndex.value.toUint128()
            });
            _GLOBAL_INDEX_ = index;

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
        returns (P1Types.Balance[] memory)
    {
        uint256 numAccounts = accounts.length;
        P1Types.Balance[] memory result = new P1Types.Balance[](numAccounts);

        for (uint256 i = 0; i < numAccounts; i++) {
            result[i] = _settleAccount(context, accounts[i]);
        }

        return result;
    }

    function _settleAccount(
        P1Types.Context memory context,
        address account
    )
        internal
        returns (P1Types.Balance memory)
    {
        P1Types.Index memory newIndex = context.index;
        P1Types.Index memory oldIndex = _LOCAL_INDEXES_[account];
        P1Types.Balance memory balance = _BALANCES_[account];

        // do nothing if no settlement is needed
        if (oldIndex.timestamp == newIndex.timestamp) {
            return balance;
        }

        // store a cached copy of the index for this account
        _LOCAL_INDEXES_[account] = newIndex;

        // no need for settlement if balance is zero
        if (balance.position == 0) {
            return balance;
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

        // Settle the account balance by applying the index delta as a credit or debit.
        // By convention, positive funding (index increases) means longs pay shorts
        // and negative funding (index decreases) means shorts pay longs.
        uint256 settlementAmount = signedIndexDiff.value.baseMul(balance.position);
        bool settlementIsPositive = signedIndexDiff.isPositive != balance.positionIsPositive;

        // calculate the new balance of the account with updated margin
        if (settlementIsPositive) {
            balance.addToMargin(settlementAmount);
        } else {
            balance.subFromMargin(settlementAmount);
        }
        _BALANCES_[account] = balance;

        // Log the change to the account balance, which is the negative of the change in the index.
        emit LogAccountSettled(
            account,
            settlementIsPositive,
            settlementAmount
        );

        return balance;
    }

    function _isCollateralized(
        P1Types.Context memory context,
        P1Types.Balance memory balance
    )
        internal
        pure
        returns (bool)
    {
        (uint256 positive, uint256 negative) = balance.getPositiveAndNegativeValue(context.price);
        return positive.mul(BaseMath.base()) >= negative.mul(context.minCollateral);
    }
}
