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
import { P1Constants } from "../P1Constants.sol";
import { BaseMath } from "../../lib/BaseMath.sol";
import { TypedSignature } from "../../lib/TypedSignature.sol";
import { P1Types } from "../lib/P1Types.sol";


/**
 * @title P1Orders
 * @author dYdX
 *
 * P1Orders contract
 */
contract P1Orders
    is P1Constants
{
    using BaseMath for uint256;
    using SafeMath for uint256;

    // ============ Constants ============

    // EIP191 header for EIP712 prefix
    bytes2 constant private EIP191_HEADER = 0x1901;

    // EIP712 Domain Name value
    string constant private EIP712_DOMAIN_NAME = "P1Orders";

    // EIP712 Domain Version value
    string constant private EIP712_DOMAIN_VERSION = "1.0";

    // Hash of the EIP712 Domain Separator Schema
    /* solium-disable-next-line indentation */
    bytes32 constant private EIP712_DOMAIN_SEPARATOR_SCHEMA_HASH = keccak256(abi.encodePacked(
        "EIP712Domain(",
        "string name,",
        "string version,",
        "uint256 chainId,",
        "address verifyingContract",
        ")"
    ));

    // Hash of the EIP712 LimitOrder struct
    /* solium-disable-next-line indentation */
    bytes32 constant private EIP712_ORDER_STRUCT_SCHEMA_HASH = keccak256(abi.encodePacked(
        "Order(",
        "bool isBuy,",
        "uint256 amount,",
        "uint256 limitPrice,",
        "uint256 stopPrice,",
        "uint256 fee,",
        "address maker,",
        "address taker,",
        "uint256 expiration,",
        "uint256 salt",
        ")"
    ));

    // ============ Enums ============

    enum OrderStatus {
        Open,
        Approved,
        Canceled
    }

    // ============ Structs ============

    struct Order {
        bool isBuy;
        uint256 amount;
        uint256 limitPrice;
        uint256 stopPrice;
        uint256 fee;
        address maker;
        address taker;
        uint256 expiration;
        uint256 salt;
    }

    struct OrderInfo {
        Order order;
        bytes32 orderHash;
    }

    struct TradeData {
        Order order;
        bytes32 r;
        bytes32 s;
        bytes32 v;
        uint256 amount;
        uint256 price;
        uint256 fee;
    }

    struct OrderQueryOutput {
        OrderStatus status;
        uint256 filledAmount;
    }

    // ============ Events ============

    event LogContractStatusSet(
        bool operational
    );

    event LogOrderCanceled(
        bytes32 indexed orderHash,
        address indexed canceler
    );

    event LogOrderApproved(
        bytes32 indexed orderHash,
        address indexed approver
    );

    event LogOrderFilled(
        bytes32 indexed orderHash,
        address indexed orderMaker,
        uint256 amount,
        uint256 price,
        uint256 fee,
        bool isBuy
    );

    // ============ Immutable Storage ============

    // Hash of the EIP712 Domain Separator data
    bytes32 public EIP712_DOMAIN_HASH;

    // ============ Mutable Storage ============

    // address of the perpetual contract
    address public _PERPETUAL_V1_;

    // order hash => filled amount (in position amount)
    mapping (bytes32 => uint256) public _FILLED_AMOUNT_;

    // order hash => status
    mapping (bytes32 => OrderStatus) public _STATUS_;

    // ============ Constructor ============

    constructor (
        address perpetualV1,
        uint256 chainId
    )
        public
    {
        _PERPETUAL_V1_ = perpetualV1;

        /* solium-disable-next-line indentation */
        EIP712_DOMAIN_HASH = keccak256(abi.encode(
            EIP712_DOMAIN_SEPARATOR_SCHEMA_HASH,
            keccak256(bytes(EIP712_DOMAIN_NAME)),
            keccak256(bytes(EIP712_DOMAIN_VERSION)),
            chainId,
            address(this)
        ));
    }

    // ============ Public Functions ============

    function trade(
        address /* sender */,
        address maker,
        address taker,
        uint256 price,
        bytes calldata data,
        bytes32 /* traderFlags */
    )
        external
        returns(P1Types.TradeResult memory)
    {
        require(
            msg.sender == _PERPETUAL_V1_,
            "Sender must be PerpetualV1"
        );

        TradeData memory tradeData = abi.decode(data, (TradeData));
        bytes32 orderHash = _getOrderHash(tradeData.order);
        bytes memory signature = abi.encodePacked(
            tradeData.r,
            tradeData.s,
            bytes2(tradeData.v)
        );

        // sanity checking
        _verifyOrderStateAndSignature(
            tradeData.order.maker,
            orderHash,
            signature
        );
        _verifyOrderRequest(
            tradeData,
            maker,
            taker,
            price
        );

        // set _FILLED_AMOUNT_
        uint256 oldFilledAmount = _FILLED_AMOUNT_[orderHash];
        uint256 newFilledAmount = oldFilledAmount.add(tradeData.amount);
        require(
            newFilledAmount <= tradeData.order.amount,
            "Cannot overfill order"
        );
        _FILLED_AMOUNT_[orderHash] = newFilledAmount;

        emit LogOrderFilled(
            orderHash,
            tradeData.order.maker,
            tradeData.amount,
            tradeData.price,
            tradeData.fee,
            tradeData.order.isBuy
        );

        uint256 marginPerPosition = 0;
        if (tradeData.order.isBuy) {
            marginPerPosition = tradeData.price.add(tradeData.fee);
        } else {
            marginPerPosition = tradeData.price.sub(tradeData.fee);
        }

        return P1Types.TradeResult({
            marginAmount: tradeData.amount.baseMul(marginPerPosition),
            positionAmount: tradeData.amount,
            isBuy: !tradeData.order.isBuy,
            traderFlags: TRADER_FLAG_ORDERS
        });
    }

    function approveOrder(
        Order calldata order
    )
        external
    {
        bytes32 orderHash = _getOrderHash(order);
        require(
            msg.sender == order.maker,
            "Order cannot be approved by non-maker"
        );
        _STATUS_[orderHash] = OrderStatus.Approved;
        emit LogOrderApproved(orderHash, msg.sender);
    }

    function cancelOrder(
        Order calldata order
    )
        external
    {
        bytes32 orderHash = _getOrderHash(order);
        require(
            msg.sender == order.maker,
            "Order cannot be canceled by non-maker"
        );
        _STATUS_[orderHash] = OrderStatus.Canceled;
        emit LogOrderCanceled(orderHash, msg.sender);
    }

    function getOrdersStatus(
        bytes32[] calldata orderHashes
    )
        external
        view
        returns (OrderQueryOutput[] memory)
    {
        OrderQueryOutput[] memory result = new OrderQueryOutput[](orderHashes.length);
        for (uint256 i = 0; i < orderHashes.length; i++) {
            bytes32 orderHash = orderHashes[i];
            result[i] = OrderQueryOutput({
                status: _STATUS_[orderHash],
                filledAmount: _FILLED_AMOUNT_[orderHash]
            });
        }
        return result;
    }

    // ============ Helper Functions ============

    function _verifyOrderStateAndSignature(
        address maker,
        bytes32 orderHash,
        bytes memory signature
    )
        private
        view
    {
        OrderStatus orderStatus = _STATUS_[orderHash];

        if (orderStatus == OrderStatus.Open) {
            require(
                maker == TypedSignature.recover(orderHash, signature),
                "Order invalid signature"
            );
        } else {
            require(
                orderStatus != OrderStatus.Canceled,
                "Order already canceled"
            );
            assert(orderStatus == OrderStatus.Approved);
        }
    }

    function _verifyOrderRequest(
        TradeData memory tradeData,
        address maker,
        address taker,
        uint256 price
    )
        private
        pure
    {
        require(
            tradeData.order.maker == maker,
            "Order maker does not match maker"
        );
        require(
            tradeData.order.taker == address(0) || tradeData.order.taker == taker,
            "Order taker does not match taker"
        );

        bool validPrice = tradeData.order.isBuy
            ? tradeData.price <= tradeData.order.limitPrice
            : tradeData.price >= tradeData.order.limitPrice;
        require(
            validPrice,
            "Cannot take worse price than approved"
        );

        require(
            tradeData.fee <= tradeData.order.fee,
            "Cannot take more fee than approved"
        );

        if (tradeData.order.stopPrice != 0) {
            bool validStopPrice = tradeData.order.isBuy
                ? tradeData.order.stopPrice <= price
                : tradeData.order.stopPrice >= price;
            require(
                validStopPrice,
                "Stop price untriggered"
            );
        }
    }

    /**
     * Returns the EIP712 hash of an order.
     */
    function _getOrderHash(
        Order memory order
    )
        private
        view
        returns (bytes32)
    {
        // compute the overall signed struct hash
        /* solium-disable-next-line indentation */
        bytes32 structHash = keccak256(abi.encode(
            EIP712_ORDER_STRUCT_SCHEMA_HASH,
            order
        ));

        // compute eip712 compliant hash
        /* solium-disable-next-line indentation */
        return keccak256(abi.encodePacked(
            EIP191_HEADER,
            EIP712_DOMAIN_HASH,
            structHash
        ));
    }
}
