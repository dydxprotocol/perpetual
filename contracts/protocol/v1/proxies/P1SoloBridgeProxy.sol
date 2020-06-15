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
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { I_Solo } from "../../../external/dydx/I_Solo.sol";
import { BaseMath } from "../../lib/BaseMath.sol";
import { SignedMath } from "../../lib/SignedMath.sol";
import { TypedSignature } from "../../lib/TypedSignature.sol";
import { I_PerpetualV1 } from "../intf/I_PerpetualV1.sol";
import { P1BalanceMath } from "../lib/P1BalanceMath.sol";
import { P1Types } from "../lib/P1Types.sol";


/**
 * @title P1SoloBridgeProxy
 * @author dYdX
 *
 * @notice Facilitates transfers between the PerpetualV1 and Solo smart contracts.
 */
contract P1SoloBridgeProxy {
    using BaseMath for uint256;
    using SafeMath for uint256;
    using SignedMath for SignedMath.Int;
    using P1BalanceMath for P1Types.Balance;
    using SafeERC20 for IERC20;

    // ============ Constants ============

    // EIP191 header for EIP712 prefix
    bytes2 constant private EIP191_HEADER = 0x1901;

    // EIP712 Domain Name value
    string constant private EIP712_DOMAIN_NAME = "P1SoloBridgeProxy";

    // EIP712 Domain Version value
    string constant private EIP712_DOMAIN_VERSION = "1.0";

    // EIP712 hash of the Domain Separator Schema
    /* solium-disable-next-line indentation */
    bytes32 constant private EIP712_DOMAIN_SEPARATOR_SCHEMA_HASH = keccak256(abi.encodePacked(
        "EIP712Domain(",
        "string name,",
        "string version,",
        "uint256 chainId,",
        "address verifyingContract",
        ")"
    ));

    // EIP712 hash of the Transfer struct
    /* solium-disable-next-line indentation */
    bytes32 constant private EIP712_TRANSFER_STRUCT_SCHEMA_HASH = keccak256(abi.encodePacked(
        "Transfer(",
        "address account,",
        "address perpetual,",
        "uint256 soloAccountNumber,",
        "uint256 soloMarketId,",
        "bool toPerpetual,",
        "uint256 amount,",
        "uint256 expiration,",
        "bytes32 salt",
        ")"
    ));

    // ============ Structs ============

    struct Transfer {
        address account;
        address perpetual;
        uint256 soloAccountNumber;
        uint256 soloMarketId;
        bool toPerpetual; // Indicates whether the transfer is from Solo to Perpetual or vice versa.
        uint256 amount;
        uint256 expiration;
        bytes32 salt;
    }

    // ============ Events ============

    event LogTransferred(
        address indexed account,
        address perpetual,
        uint256 soloAccountNumber,
        uint256 soloMarketId,
        bool toPerpetual,
        uint256 amount
    );

    event LogTransferCanceled(
        address indexed account,
        bytes32 transferHash
    );

    // ============ Immutable Storage ============

    // Address of the Solo margin contract.
    address public _SOLO_MARGIN_;

    // Hash of the EIP712 Domain Separator data
    bytes32 public _EIP712_DOMAIN_HASH_;

    // ============ Mutable Storage ============

    // transfer hash => bool
    mapping (bytes32 => bool) public _HASH_USED_;

    // ============ Constructor ============

    constructor (
        address soloMargin,
        uint256 chainId
    )
        public
    {
        _SOLO_MARGIN_ = soloMargin;

        /* solium-disable-next-line indentation */
        _EIP712_DOMAIN_HASH_ = keccak256(abi.encode(
            EIP712_DOMAIN_SEPARATOR_SCHEMA_HASH,
            keccak256(bytes(EIP712_DOMAIN_NAME)),
            keccak256(bytes(EIP712_DOMAIN_VERSION)),
            chainId,
            address(this)
        ));
    }

    // ============ External Functions ============

    /**
     * @notice Sets the maximum allowance on the Solo contract for a given market. Must be called
     *  at least once on a given market before deposits can be made.
     * @dev Cannot be run in the constructor due to technical restrictions in Solidity.
     */
    function approveMaximumOnSolo(
        uint256 soloMarketId
    )
        external
    {
        address solo = _SOLO_MARGIN_;
        IERC20 tokenContract = IERC20(I_Solo(solo).getMarketTokenAddress(soloMarketId));

        // safeApprove requires unsetting the allowance first.
        tokenContract.approve(solo, 0);

        // Set the allowance to the highest possible value.
        tokenContract.approve(solo, uint256(-1));
    }

    /**
     * @notice Sets the maximum allowance on the Perpetual contract. Must be called at least once
     *  on a given Perpetual before deposits can be made.
     * @dev Cannot be run in the constructor due to technical restrictions in Solidity.
     */
    function approveMaximumOnPerpetual(
        address perpetual
    )
        external
    {
        IERC20 tokenContract = IERC20(I_PerpetualV1(perpetual).getTokenContract());

        // safeApprove requires unsetting the allowance first.
        tokenContract.approve(perpetual, 0);

        // Set the allowance to the highest possible value.
        tokenContract.approve(perpetual, uint256(-1));
    }

    /**
     * @notice Executes a transfer from Solo to Perpetual or vice vera.
     * @dev Emits the LogTransferred event.
     *
     * @param  transfer   The transfer to execute.
     * @param  signature  Signature for the transfer, required if sender is not the account owner.
     */
    function bridgeTransfer(
        Transfer calldata transfer,
        TypedSignature.Signature calldata signature
    )
        external
        returns (uint256)
    {
        bytes32 transferHash = _getTransferHash(transfer);
        I_Solo solo = I_Solo(_SOLO_MARGIN_);
        I_PerpetualV1 perpetual = I_PerpetualV1(transfer.perpetual);

        // Validations.
        _verifyPermissions(
            solo,
            perpetual,
            transfer,
            transferHash,
            signature
        );
        _verifyTransfer(
            solo,
            perpetual,
            transfer,
            transferHash
        );

        // Execute the transfer.
        if (transfer.toPerpetual) {
            _doSoloOperation(
                solo,
                transfer,
                true
            );
            perpetual.deposit(transfer.account, transfer.amount);
        } else {
            perpetual.withdraw(transfer.account, address(this), transfer.amount);
            _doSoloOperation(
                solo,
                transfer,
                false
            );
        }

        // Log the transfer.
        emit LogTransferred(
            transfer.account,
            transfer.perpetual,
            transfer.soloAccountNumber,
            transfer.soloMarketId,
            transfer.toPerpetual,
            transfer.amount
        );
    }

    /**
     * @notice Prevent a transfer from executing. Useful if a transfer was signed off-chain, and
     *  authorization needs to be revoked.
     * @dev Emits the LogTransferCanceled event.
     *
     * @param  transfer  The transfer that will be prevented from executing.
     */
    function cancelTransfer(
        Transfer calldata transfer
    )
        external
    {
        // Check permissions. Short-circuit if sender is the account owner.
        if (msg.sender != transfer.account) {
            I_Solo solo = I_Solo(_SOLO_MARGIN_);
            I_PerpetualV1 perpetual = I_PerpetualV1(transfer.perpetual);
            require(
                _hasWithdrawPermissions(solo, perpetual, transfer),
                "Sender does not have permission to cancel"
            );
        }

        // Cancel the transfer.
        bytes32 transferHash = _getTransferHash(transfer);
        _HASH_USED_[transferHash] = true;

        // Log the cancelation.
        emit LogTransferCanceled(
            msg.sender,
            transferHash
        );
    }

    // ============ Helper Functions ============

    /**
     * @dev Execute a withdrawal or deposit operation on Solo.
     */
    function _doSoloOperation(
        I_Solo solo,
        Transfer memory transfer,
        bool isWithdrawal
    )
        private
    {
        // Create Solo account struct.
        I_Solo.AccountInfo memory soloAccount = I_Solo.AccountInfo({
            owner: transfer.account,
            number: transfer.soloAccountNumber
        });

        // Create Solo accounts array.
        I_Solo.AccountInfo[] memory soloAccounts = new I_Solo.AccountInfo[](1);
        soloAccounts[0] = soloAccount;

        // Create Solo actions array.
        I_Solo.AssetAmount memory amount = I_Solo.AssetAmount({
            sign: true,
            denomination: I_Solo.AssetDenomination.Wei,
            ref: I_Solo.AssetReference.Delta,
            value: transfer.amount
        });
        I_Solo.ActionType actionType;
        bytes memory data;
        if (isWithdrawal) {
            actionType = I_Solo.ActionType.Withdraw;
            data = abi.encode(
                I_Solo.WithdrawArgs({
                    amount: amount,
                    account: soloAccount,
                    market: transfer.soloMarketId,
                    to: address(this)
                })
            );
        } else {
            actionType = I_Solo.ActionType.Deposit;
            data = abi.encode(
                I_Solo.DepositArgs({
                    amount: amount,
                    account: soloAccount,
                    market: transfer.soloMarketId,
                    from: address(this)
                })
            );
        }
        I_Solo.ActionArgs[] memory soloActions = new I_Solo.ActionArgs[](1);
        soloActions[0] = I_Solo.ActionArgs({
            actionType: actionType,
            accountId: transfer.soloAccountNumber,
            amount: amount,
            primaryMarketId: transfer.soloMarketId,
            secondaryMarketId: 0,
            otherAddress: address(0),
            otherAccountId: 0,
            data: data
        });

        // Execute the withdrawal or deposit.
        solo.operate(soloAccounts, soloActions);
    }

    /**
     * Verify that either msg.sender has withdraw permissions or the signature is valid.
     */
    function _verifyPermissions(
        I_Solo solo,
        I_PerpetualV1 perpetual,
        Transfer memory transfer,
        bytes32 transferHash,
        TypedSignature.Signature memory signature
    )
        private
        view
    {
        bool hasWithdrawPermissions = _hasWithdrawPermissions(solo, perpetual, transfer);
        require(
            hasWithdrawPermissions ||
                TypedSignature.recover(transferHash, signature) == transfer.account,
            "Sender does not have withdraw permissions and signature is invalid"
        );
    }

    /**
     * Check whether msg.sender has withdraw permissions.
     */
    function _hasWithdrawPermissions(
        I_Solo solo,
        I_PerpetualV1 perpetual,
        Transfer memory transfer
    )
        private
        view
        returns (bool)
    {
        // Short-circuit if sender is the account owner.
        if (msg.sender == transfer.account) {
            return true;
        }

        if (transfer.toPerpetual) {
            return solo.getIsLocalOperator(transfer.account, msg.sender) ||
                solo.getIsGlobalOperator(msg.sender);
        } else {
            return perpetual.hasAccountPermissions(transfer.account, msg.sender);
        }
    }

    /**
     * Verify token addresses and that the transfer is not executed, canceled, or expired.
     */
    function _verifyTransfer(
        I_Solo solo,
        I_PerpetualV1 perpetual,
        Transfer memory transfer,
        bytes32 transferHash
    )
        private
        view
    {
        // Verify that the Solo market asset matches the Perpetual margin asset.
        require(
            solo.getMarketTokenAddress(transfer.soloMarketId) == perpetual.getTokenContract(),
            "Solo and Perpetual assets are not the same"
        );

        // Verify expiration.
        require(
            transfer.expiration >= block.timestamp || transfer.expiration == 0,
            "Transfer has expired"
        );

        // Verify status.
        require(
            !_HASH_USED_[transferHash],
            "Transfer was already executed or canceled"
        );
    }

    /**
     * Returns the EIP712 hash of a transfer.
     */
    function _getTransferHash(
        Transfer memory transfer
    )
        private
        view
        returns (bytes32)
    {
        // Compute the overall signed struct hash
        /* solium-disable-next-line indentation */
        bytes32 structHash = keccak256(abi.encode(
            EIP712_TRANSFER_STRUCT_SCHEMA_HASH,
            transfer
        ));

        // Compute EIP712 compliant hash
        /* solium-disable-next-line indentation */
        return keccak256(abi.encodePacked(
            EIP191_HEADER,
            _EIP712_DOMAIN_HASH_,
            structHash
        ));
    }
}
