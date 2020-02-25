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
import { P1Settlement } from "./P1Settlement.sol";
import { P1Storage } from "./P1Storage.sol";
import { I_P1Trader } from "../intf/I_P1Trader.sol";
import { P1BalanceMath } from "../lib/P1BalanceMath.sol";
import { P1Types } from "../lib/P1Types.sol";


/**
 * @title P1Trade
 * @author dYdX
 *
 * Trade logic contract
 */
contract P1Trade is
    P1Storage,
    P1Settlement
{
    using SafeMath for uint120;
    using P1BalanceMath for P1Types.Balance;

    // ============ Structs ============

    struct TradeArg {
        uint256 takerIndex;
        uint256 makerIndex;
        address trader;
        bytes data;
    }

    // ============ Events ============

    event LogTrade(
        address indexed maker,
        address indexed taker,
        address trader,
        uint256 marginAmount,
        uint256 positionAmount,
        bool isBuy
    );

    // ============ Functions ============

    function trade(
        address[] memory accounts,
        TradeArg[] memory trades
    )
        public
        nonReentrant
    {
        _verifyAccounts(accounts);
        P1Types.Context memory context = _loadContext();
        _settleAccounts(context, accounts);

        P1Types.Balance[] memory initialBalances = new P1Types.Balance[](accounts.length);
        uint256 i;
        for (i = 0; i < accounts.length; i++) {
            initialBalances[i] = _BALANCES_[accounts[i]];
        }

        bytes32 traderFlags = 0;
        for (i = 0; i < trades.length; i++) {
            TradeArg memory tradeArg = trades[i];

            require(
                _GLOBAL_OPERATORS_[tradeArg.trader],
                "trader is not global operator"
            );

            address maker = accounts[tradeArg.makerIndex];
            address taker = accounts[tradeArg.takerIndex];

            P1Types.TradeResult memory tradeResult = I_P1Trader(tradeArg.trader).trade(
                msg.sender,
                maker,
                taker,
                context.price,
                tradeArg.data,
                traderFlags
            );

            traderFlags |= tradeResult.traderFlags;

            // if the accounts are equal no need to update balances
            if (maker == taker) {
                continue;
            }

            P1Types.Balance memory makerBalance = _BALANCES_[maker];
            P1Types.Balance memory takerBalance = _BALANCES_[taker];

            if (tradeResult.isBuy) {
                makerBalance = makerBalance.marginAdd(tradeResult.marginAmount);
                makerBalance = makerBalance.positionSub(tradeResult.positionAmount);
                takerBalance = takerBalance.marginSub(tradeResult.marginAmount);
                takerBalance = takerBalance.positionAdd(tradeResult.positionAmount);
            } else {
                makerBalance = makerBalance.marginSub(tradeResult.marginAmount);
                makerBalance = makerBalance.positionAdd(tradeResult.positionAmount);
                takerBalance = takerBalance.marginAdd(tradeResult.marginAmount);
                takerBalance = takerBalance.positionSub(tradeResult.positionAmount);
            }

            _BALANCES_[maker] = makerBalance;
            _BALANCES_[taker] = takerBalance;

            emit LogTrade(
                maker,
                taker,
                tradeArg.trader,
                tradeResult.marginAmount,
                tradeResult.positionAmount,
                tradeResult.isBuy
            );
        }

        _verifyAccountsFinalBalances(context, accounts, initialBalances);
    }

    function _verifyAccounts(
        address[] memory accounts
    )
        private
        pure
    {
        require(
            accounts.length > 0,
            "Accounts must have non-zero length"
        );
        address prevAccount = accounts[0];
        for (uint256 i = 1; i < accounts.length; i++) {
            address account = accounts[i];
            require(
                account >= prevAccount,
                "Accounts must be sorted"
            );
            prevAccount = account;
        }
    }

    /**
     * Verify that account balances at the end of the tx are allowable given the initial balances.
     *
     * We require that for every account, either:
     * 1. The account meets the collateralization requirement; OR
     * 2. All of the following are true:
     *   c) The account's collateralization ratio has not worsened;
     *   b) The absolute value of the account position has not increased;
     *   a) The sign of the account position has not flipped positive to negative or vice-versa.
     *
     * Note: We avoid making use of P1BalanceMath.getPositiveAndNegativeValue here to avoid
     * errors stemming from rounding errors when determining position value.
     */
    function _verifyAccountsFinalBalances(
        P1Types.Context memory context,
        address[] memory accounts,
        P1Types.Balance[] memory initialBalances
    )
        private
        view
    {
        for (uint256 i = 0; i < accounts.length; i++) {
            if (_isCollateralized(context, accounts[i])) {
                continue;
            }

            P1Types.Balance memory initialBalance = initialBalances[i];
            P1Types.Balance memory finalBalance = _BALANCES_[accounts[i]];

            // Let margin be zero for now but require position to be non-zero.
            require(
                finalBalance.marginIsPositive ||
                    (finalBalance.positionIsPositive && finalBalance.position > 0),
                "account has no positive value"
            );
            // Note: Final margin/position is now either -/+, +/-, or 0/-.
            require(
                finalBalance.position <= initialBalance.position,
                "account is undercollateralized and absolute position size increased"
            );
            // Note: Initial margin/position is now one of +/+, 0/+, -/+, or +/-.
            // Note: Both finalBalance.position and initialBalance.position are now nonzero.
            require(
                finalBalance.positionIsPositive == initialBalance.positionIsPositive,
                "account is undercollateralized and position changed signs"
            );

            uint256 finalBalanceInitialMargin = finalBalance.position.mul(initialBalance.margin);
            uint256 finalMarginInitialBalance = finalBalance.margin.mul(initialBalance.position);

            if (finalBalance.positionIsPositive) {
                require(
                    !initialBalance.marginIsPositive,
                    "account is undercollateralized and was not previously"
                );
                require(
                    finalBalanceInitialMargin >= finalMarginInitialBalance,
                    "account is undercollateralized and collateralization decreased"
                );
            } else {
                require(
                    finalMarginInitialBalance >= finalBalanceInitialMargin,
                    "account is undercollateralized and collateralization decreased"
                );
            }
        }
    }
}
