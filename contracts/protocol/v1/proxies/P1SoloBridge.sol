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
 * @title P1SoloBridge
 * @author dYdX
 *
 * @notice Facilitates transfers between the PerpetualV1 and Solo smart contracts. The token to be
 *  transfered will be the margin token used by PerpetualV1.
 */
contract P1SoloBridge {
    using BaseMath for uint256;
    using SafeMath for uint256;
    using SignedMath for SignedMath.Int;
    using P1BalanceMath for P1Types.Balance;
    using SafeERC20 for IERC20;

    // ============ Constants ============

    // EIP191 header for EIP712 prefix
    bytes2 constant private EIP191_HEADER = 0x1901;

    // EIP712 Domain Name value
    string constant private EIP712_DOMAIN_NAME = "P1SoloBridge";

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
        "uint256 soloAccountNumber,",
        "bool toPerpetual,",
        "uint120 amount,",
        "bytes16 salt,",
        "uint256 expiration",
        ")"
    ));

    // ============ Structs ============

    struct Transfer {
        address account;
        uint256 soloAccountNumber;
        bool toPerpetual; // Indicates whether the transfer is from Solo to Perpetual or vice versa.
        uint120 amount;
        bytes16 salt;
        uint256 expiration;
    }

    // ============ Events ============

    event LogTransferred(
        address indexed account,
        uint256 soloAccountNumber,
        bool toPerpetual,
        uint120 amount
    );

    event LogTransferInvalidated(
        address indexed account,
        bytes32 transferHash
    );

    // ============ Immutable Storage ============

    // Address of the PerpetualV1 contract.
    address public _PERPETUAL_V1_;

    // Address of the Solo margin contract.
    address public _SOLO_MARGIN_;

    // Market ID in Solo which matches the PerpetualV1 margin token.
    uint256 public _SOLO_MARKET_ID_;

    // Hash of the EIP712 Domain Separator data
    bytes32 public _EIP712_DOMAIN_HASH_;

    // ============ Mutable Storage ============

    // transfer hash => bool
    mapping (bytes32 => bool) public _HASH_USED_;

    // ============ Constructor ============

    constructor (
        address perpetualV1,
        address soloMargin,
        uint256 soloMarketId,
        uint256 chainId
    )
        public
    {
        _PERPETUAL_V1_ = perpetualV1;
        _SOLO_MARGIN_ = soloMargin;
        _SOLO_MARKET_ID_ = soloMarketId;

        I_PerpetualV1 perpetual = I_PerpetualV1(_PERPETUAL_V1_);
        I_Solo solo = I_Solo(_SOLO_MARGIN_);

        // Verify that the Solo market matches the Perpetual margin asset.
        // We make the assumption that the Perpetual margin asset will not change.
        require(
            perpetual.getTokenContract() == solo.getMarketTokenAddress(soloMarketId),
            "Perpetual and Solo tokens do not match"
        );

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

        // Validations.
        _verifyPermissions(
            transfer,
            transferHash,
            signature
        );
        _verifyStatusAndExpiration(
            transfer,
            transferHash
        );

        I_PerpetualV1 perpetual = I_PerpetualV1(_PERPETUAL_V1_);
        I_Solo solo = I_Solo(_SOLO_MARGIN_);
        uint256 soloMarketId = _SOLO_MARKET_ID_;

        // Execute the transfer.
        if (transfer.toPerpetual) {
            _transferFromSoloToPerpetual(
                perpetual,
                solo,
                transfer,
                soloMarketId
            );
        } else {
            _transferFromPerpetualToSolo(
                perpetual,
                solo,
                transfer,
                soloMarketId
            );
        }

        // Log the transfer.
        emit LogTransferred(
            transfer.account,
            transfer.soloAccountNumber,
            transfer.toPerpetual,
            transfer.amount
        );
    }

    /**
     * @notice Prevent a transfer from executing. Useful if a transfer was signed off-chain, and
     *  authorization needs to be revoked.
     * @dev Emits the LogTransferInvalidated event.
     *
     * @param  transfer  The transfer that will be prevented from executing.
     */
    function invalidateTransfer(
        Transfer calldata transfer
    )
        external
    {
        require(
            msg.sender == transfer.account,
            "Transfer can only be invalidated by the account owner"
        );
        bytes32 transferHash = _getTransferHash(transfer);
        _HASH_USED_[transferHash] = true;
        emit LogTransferInvalidated(
            msg.sender,
            transferHash
        );
    }

    // ============ Helper Functions ============

    /**
     * @dev Execute a transfer from Solo to Perpetual.
     */
    function _transferFromSoloToPerpetual(
        I_PerpetualV1 perpetual,
        I_Solo solo,
        Transfer memory transfer,
        uint256 soloMarketId
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
            sign: true, // isPositive
            denomination: I_Solo.AssetDenomination.Wei,
            ref: I_Solo.AssetReference.Delta,
            value: transfer.amount
        });
        I_Solo.WithdrawArgs memory withdrawArgs = I_Solo.WithdrawArgs({
            amount: amount,
            account: soloAccount,
            market: soloMarketId,
            to: address(this)
        });
        I_Solo.ActionArgs[] memory soloActions = new I_Solo.ActionArgs[](1);
        soloActions[0] = I_Solo.ActionArgs({
            actionType: I_Solo.ActionType.Withdraw,
            accountId: transfer.soloAccountNumber,
            amount: amount,
            primaryMarketId: soloMarketId,
            secondaryMarketId: 0, // Unused by withdrawal.
            otherAddress: address(0), // Unused by withdrawal.
            otherAccountId: 0, // Unused by withdrawal.
            data: abi.encode(withdrawArgs)
        });

        // Execute withdrawal and deposit.
        solo.operate(soloAccounts, soloActions);
        perpetual.deposit(transfer.account, transfer.amount);
    }

    /**
     * @dev Execute a transfer from Perpetual to Solo.
     */
    function _transferFromPerpetualToSolo(
        I_PerpetualV1 perpetual,
        I_Solo solo,
        Transfer memory transfer,
        uint256 soloMarketId
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
            sign: true, // isPositive
            denomination: I_Solo.AssetDenomination.Wei,
            ref: I_Solo.AssetReference.Delta,
            value: transfer.amount
        });
        I_Solo.DepositArgs memory depositArgs = I_Solo.DepositArgs({
            amount: amount,
            account: soloAccount,
            market: soloMarketId,
            from: address(this)
        });
        I_Solo.ActionArgs[] memory soloActions = new I_Solo.ActionArgs[](1);
        soloActions[0] = I_Solo.ActionArgs({
            actionType: I_Solo.ActionType.Deposit,
            accountId: transfer.soloAccountNumber,
            amount: amount,
            primaryMarketId: soloMarketId,
            secondaryMarketId: 0, // Unused by deposit.
            otherAddress: address(0), // Unused by deposit.
            otherAccountId: 0, // Unused by deposit.
            data: abi.encode(depositArgs)
        });

        // Execute withdrawal and deposit.
        perpetual.withdraw(transfer.account, address(this), transfer.amount);
        solo.operate(soloAccounts, soloActions);
    }

    /**
     * Verify that either msg.sender is the account owner or the signature is valid.
     */
    function _verifyPermissions(
        Transfer memory transfer,
        bytes32 transferHash,
        TypedSignature.Signature memory signature
    )
        private
        view
    {
        if (msg.sender != transfer.account) {
            require(
                TypedSignature.recover(transferHash, signature) == transfer.account,
                "Sender is not the account owner and signature is invalid"
            );
        }
    }

    /**
     * Verify the transfer is not executed, invalidated, or expired.
     */
    function _verifyStatusAndExpiration(
        Transfer memory transfer,
        bytes32 transferHash
    )
        private
        view
    {
        // Verify expiration.
        require(
            transfer.expiration >= block.timestamp || transfer.expiration == 0,
            "Transfer has expired"
        );

        // Verify status.
        require(
            !_HASH_USED_[transferHash],
            "Transfer was already executed or invalidated"
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
