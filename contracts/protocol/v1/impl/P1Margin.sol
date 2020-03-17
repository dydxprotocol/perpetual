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
import { P1FinalSettlement } from "./P1FinalSettlement.sol";
import { P1Getters } from "./P1Getters.sol";
import { TypedSignature } from "../../lib/TypedSignature.sol";
import { P1BalanceMath } from "../lib/P1BalanceMath.sol";
import { P1Types } from "../lib/P1Types.sol";


/**
 * @title P1Margin
 * @author dYdX
 *
 * Contract for withdrawing and depositing.
 */
contract P1Margin is
    P1FinalSettlement,
    P1Getters
{
    using P1BalanceMath for P1Types.Balance;

    // ============ Constants ============

    // EIP191 header for EIP712 prefix
    bytes2 constant private EIP191_HEADER = 0x1901;

    // Waiting period for non-admin to withdraw from an account after marking it.
    uint256 constant public WITHDRAWAL_TIMELOCK_S = 1800; // 30 minutes

    // EIP712 hash of the Withdrawal struct.
    /* solium-disable-next-line indentation */
    bytes32 constant private EIP712_WITHDRAWAL_STRUCT_SCHEMA_HASH = keccak256(abi.encodePacked(
        "Withdrawal(",
        "address account,",
        "address destination,",
        "uint256 amount",
        ")"
    ));

    // ============ Structs ============

    struct Withdrawal {
        address account;
        address destination;
        uint256 amount;
    }

    // ============ Events ============

    event LogDeposit(
        address indexed account,
        uint256 amount,
        bytes32 balance
    );

    event LogWithdraw(
        address indexed account,
        address destination,
        uint256 amount,
        bytes32 balance
    );

    event LogMarkedForWithdrawal(
        address indexed account
    );

    event LogUnmarkedForWithdrawal(
        address indexed account
    );

    // ============ Functions ============

    /**
     * Deposit some amount of margin tokens from the msg.sender into an account.
     */
    function deposit(
        address account,
        uint256 amount
    )
        external
        noFinalSettlement
        nonReentrant
    {
        P1Types.Context memory context = _loadContext();
        P1Types.Balance memory balance = _settleAccount(context, account);

        SafeERC20.safeTransferFrom(
            IERC20(_TOKEN_),
            msg.sender,
            address(this),
            amount
        );

        balance.addToMargin(amount);
        _BALANCES_[account] = balance;

        emit LogDeposit(
            account,
            amount,
            balance.toBytes32()
        );
    }

    /**
     * Withdraw some amount of margin tokens from an account to a destination address.
     */
    function withdraw(
        Withdrawal calldata withdrawal,
        TypedSignature.Signature calldata signature
    )
        external
        noFinalSettlement
        nonReentrant
    {
        // validations
        _verifyPermissions(withdrawal, signature);

        address account = withdrawal.account;
        address destination = withdrawal.destination;
        uint256 amount = withdrawal.amount;

        P1Types.Context memory context = _loadContext();
        P1Types.Balance memory balance = _settleAccount(context, account);

        SafeERC20.safeTransfer(
            IERC20(_TOKEN_),
            destination,
            amount
        );

        balance.subFromMargin(amount);
        _BALANCES_[account] = balance;

        require(
            _isCollateralized(context, balance),
            "account not collateralized"
        );

        emit LogWithdraw(
            account,
            destination,
            amount,
            balance.toBytes32()
        );
    }

    /**
     * Mark an account for withdrawal.
     *
     * An account must be marked for a period of time before withdrawing, unless the sender is
     * explicitly approved by the admin to make instant withdrawals. This restriction is in place
     * to prevent users from frontrunning trades matched by a centralized order book.
     */
    function markForWithdrawal(
        address account
    )
        external
    {
        _MARKED_FOR_WITHDRAWAL_TIMESTAMP_[account] = block.timestamp;
        emit LogMarkedForWithdrawal(account);
    }

    function unmarkForWithdrawal(
        address account
    )
        external
    {
        _MARKED_FOR_WITHDRAWAL_TIMESTAMP_[account] = 0;
        emit LogUnmarkedForWithdrawal(account);
    }

    function isMarkedForWithdrawal(
        address account
    )
        external
        view
        returns (bool)
    {
        return _MARKED_FOR_WITHDRAWAL_TIMESTAMP_[account] != 0;
    }

    function _verifyPermissions(
        Withdrawal memory withdrawal,
        TypedSignature.Signature memory signature
    )
        private
        view
    {
        if (!hasAccountPermissions(withdrawal.account, msg.sender)) {
            bytes32 withdrawalHash = _getWithdrawalHash(withdrawal);
            require(
                withdrawal.account == TypedSignature.recover(withdrawalHash, signature),
                "sender does not have permission to withdraw and signature is invalid"
            );
        }

        if (!_APPROVED_FOR_INSTANT_WITHDRAWALS_[msg.sender]) {
            uint256 markedTimestamp = _MARKED_FOR_WITHDRAWAL_TIMESTAMP_[account];
            require(
                markedTimestamp != 0,
                "not approved for instant withdrawals and account is not marked"
            );
            uint256 timeDelta = block.timestamp.sub(markedTimestamp);
            require(
                timeDelta >= WITHDRAWAL_TIMELOCK_S,
                "not approved for instant withdrawals and account not marked long enough ago"
            );
        }
    }

    /**
     * Returns the EIP712 hash of a withdrawal.
     */
    function _getWithdrawalHash(
        Withdrawal memory withdrawal
    )
        private
        view
        returns (bytes32)
    {
        // compute the overall signed struct hash
        /* solium-disable-next-line indentation */
        bytes32 structHash = keccak256(abi.encode(
            EIP712_WITHDRAWAL_STRUCT_SCHEMA_HASH,
            withdrawal
        ));

        // compute eip712 compliant hash
        /* solium-disable-next-line indentation */
        return keccak256(abi.encodePacked(
            EIP191_HEADER,
            _EIP712_DOMAIN_HASH_,
            structHash
        ));
    }
}
