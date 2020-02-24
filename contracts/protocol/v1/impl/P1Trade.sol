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

        bytes32 traderFlags = 0;
        uint256 i = 0;
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

        for (i = 0; i < accounts.length; i++) {
            require(
                _isCollateralized(context, accounts[i]),
                "account is undercollateralized"
            );
        }
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
}
