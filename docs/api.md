# HTTP API
dYdX offers an HTTP API for retrieving information about the protocol, and submitting orders to
our exchange. Feel free to use these APIs to build your own applications on top of dYdX. Please feel
free to let us know via Intercom or Telegram if you have any questions or experience any issues.

All of these endpoints live at `https://api.dydx.exchange/`

e.g. `https://api.dydx.exchange/v2/orders`

## Orderbook

### Introduction

The following API endpoints allow for submitting and retrieving perpetual orders from the dYdX orderbook.
This orderbook is what's frequently referred to as a "Matching Model" orderbook. This means that
all orders are submitted to the blockchain by dYdX itself. You do not need to provide gas fees
or send on-chain transactions yourself. This is especially useful for traders and market makers who
wish to be able to quickly cancel their orders without waiting for a transaction to be mined.

The below documents the underlying HTTP API. For easier implementation we recommend using the official [Python Client](python.md) or [TypeScript Client](typescript.md#api). We may build clients for other languages in the future, so if you have other language/framework needs, please let us know.

In order to submit an order, you (the maker) must first create a JSON object that specifies the
details of your order. Once you create this object you must sign it with your Ethereum private key,
and put the result in the `typedSignature` field. Note: The `typedSignature` is omitted before
signing, and added only after signing the message.

The order data is hashed according to [EIP712](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-712.md).
This includes the exact order format and version as well as information about the verifying contract and the chainId of the network. You can see working examples of signing in the [Orders](https://github.com/dydxprotocol/perpetual/blob/master/src/modules/Orders.ts) module of Perpetual.js.

When creating your order you _must_ specify the taker as `0xf809e07870dca762B9536d61A4fBEF1a17178092`, otherwise your order will be rejected.

After this is done, the order is ready to be submitted to the API.

__V2 Order fields__

|Field Name|JSON type|Description|
|----------|---------|-----------|
|isBuy|boolean|If the order is a buy order|
|isDecreaseOnly|boolean|(Optional)If the Stop-Limit order is tied to an existing Isolated Position|
|market|string|The perpetual base [market](https://docs.dydx.exchange/#/overview?id=markets)|
|amount|string|The amount of token being offered in base units|
|limitPrice|string| The worst base/quote price at which the transaction will be accepted|
|triggerPrice|string|(Optional)The price at which the order will go to market.|
|limitFee|string| Makers will pay 0% fees. Takers with greater than or equal to 0.5Eth in the transaction will pay 0.15% of ETH-DAI and ETH-USDC transactions and 0.05% for DAI-USDC transactions.
For transactions below 0.5Eth they will pay 0.50% fees.
|makerAccountNumber|string|The Solo [account number](https://docs.dydx.exchange/#/overview?id=markets) of the Maker|
|makerAccountOwner|string|The Ethereum address of the Maker.|
|expiration|string|The time in unix seconds at which this order will be expired and can no longer be filled. Use `"0"` to specify that there is no expiration on the order.|
|salt|string|A random number to make the orderHash unique.|
|typedSignature|string|The signature of the order.|

Example:
```json
{
    "isBuy": true,
    "isDecreaseOnly": false,
    "baseMarket": "0",
    "amount": "10000000000",
    "limitPrice": "20.3",
    "triggerPrice": "0",
    "limitFee": "0.0015",
    "makerAccountNumber": "0",
    "makerAccountOwner": "0x3E5e9111Ae8eB78Fe1CC3bb8915d5D461F3Ef9A9",
    "expiration": "4294967295",
    "salt": "100",
    "typedSignature": "0xd9c006cf9066e89c2e75de72604751f63985f173ca3c69b195f1f5f445289a1f2229c0475949858522c821190c5f1ec387f31712bd21f6ac31e4510d5711c2681f00"
  },
};

Note: The tick size is 0.01 for ETH-DAI, 0.01e-12 for ETH-USDC and 0.0001e-12 for DAI-USDC transactions. The negative twelfth power is because USDC has 6 decimal places of specificity whereas ETH and DAI have 18.
The `limitPrice` must be divisible by the tick size.
If `triggerPrice` is set, it must be divisible by the tick size.

```

## Trading Endpoints

### POST /v2/orders

Description:
Post a new order to the orderbook.

Please Note:

* There is a limit of 50 active orders on each book per-side. If you exceed this limit,
your request will return `400` and will not be added to the book.

* Your request will return `201`, but the order itself will still have a status of `PENDING` until
it is processed by our internal matching engine.

Headers:
```
Content-Type: application/json
```

Request Body:

|Field Name|JSON type|Description|
|----------|---------|-----------|
|order|Object|A valid signed V2 order JSON object|
|fillOrKill|boolean|Whether the order should be canceled if it cannot be immediately filled|
|postOnly|boolean|Whether the order should be canceled if it would be immediately filled|
|triggerPrice|(Optional)The price at which the order will go to market. Must be greater than triggerPrice in the order|
|cancelId|string|(Optional)Order id for the order that is being canceled and replaced|
|clientId|string|(Optional)An arbitrary string guaranteed to be unique for each makerAccountOwner. Will be returned alongside the order in subsequent requests.|
|setExpirationOnFill|boolean|(Optional)Expiration field for order will be applied upon the order filling.|
|cancelAmountOnRevert|boolean|Whether to try the order again if it is involved in a reverted fill|

Note: `fillOrKill` orders execute immediately and no part of the order will go on the open order
book. `fillOrKill` orders will either be completely filled, or not filled. Partial fills are not possible.
`postOnly` orders will be canceled immediately if they would fill. If `postOnly` orders do not immediately cancel,
they go on the open order book.


Example Request Body:
```json
{
  "fillOrKill": true,
  "cancelAmountOnRevert": true,
  "postOnly": false,
  "triggerPrice": "0",
  "clientId": "foo",
  "order": {
    "isBuy": true,
    "isDecreaseOnly": false,
    "baseMarket": "0",
    "quoteMarket": "3",
    "amount": "10000000000",
    "limitPrice": "20.3",
    "triggerPrice": "0",
    "limitFee": "0.0015",
    "makerAccountNumber": "0",
    "makerAccountOwner": "0x3E5e9111Ae8eB78Fe1CC3bb8915d5D461F3Ef9A9",
    "expiration": "4294967295",
    "salt": "100",
    "typedSignature": "0xd9c006cf9066e89c2e75de72604751f63985f173ca3c69b195f1f5f445289a1f2229c0475949858522c821190c5f1ec387f31712bd21f6ac31e4510d5711c2681f00"
  },
};
```

Returns:
`201` if successful

### DELETE /v2/orders/:hash

Description:
Cancels an open order by hash.

Please note you will need to provide a valid cancelation signature in the Authorization header in order to cancel an order.
The Authorization header signature should be hashed according to [EIP712](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-712.md) and include the original orderHash but will not include any information about the order format, version, or chainId since these are already baked-into the hash of the order. You can see working examples of signing in the [CanonicalOrders](https://github.com/dydxprotocol/solo/blob/master/src/modules/CanonicalOrders.ts) module of Solo.js.

The response will have a status of `200` as long as the order already existed and the signature is valid (even if the order is already unfillable for any reason). For example, if a user cancels an order twice, then `200` will be returned both times. For another example, canceling a fully-filled order will return `200` but will NOT update the status of the order from `FILLED` to `CANCELED`. Therefore, receiving a `200` status does not necessarily mean that the order was canceled.

Headers:
```
Content-Type: application/json
Authorization: Bearer [A valid cancel signature]
```

Example Response Body:
```json
{
  "orders": [
    {
      "uuid": "ffb8f5e3-68aa-4dc9-89d2-1de6738b8c3f",
      "id": "0xd17ae8439b99c6c7637808be36d856c6f6f497ab132a7f394f611396b5594844",
      "createdAt": "2020-01-15T22:30:55.533Z",
      "status": "PENDING",
      "accountOwner": "0x998497ffc64240d6a70c38e544521d09dcd23293",
      "accountNumber": "0",
      "orderType": "CANONICAL_CROSS",
      "fillOrKill": false,
      "postOnly": null,
      "market": "WETH-DAI",
      "side": "BUY",
      "baseAmount": "50900000000000000000",
      "quoteAmount": "8386480372200000000000",
      "filledAmount": "0",
      "price": "231.763858",
      "cancelReason": null
    },
  ]
}
```

### A note about Order and Fill status

Both orders and fills returned from the API will provide a status field.

For orders this field represents the current status of the order.
```javascript
export const STATUS = {
  PENDING: 'PENDING', // The order is not yet processed by our internal matching engine
  OPEN: 'OPEN', // The order is open and can be filled
  FILLED: 'FILLED', // The order has been completely filled
  PARTIALLY_FILLED: 'PARTIALLY_FILLED', // The order has been partially filled
  CANCELED: 'CANCELED', // The order has been canceled and can no longer be filled
  FAILED: 'FAILED', // The order failed to be processed due to an internal error
};
```

If the order was canceled, additional information will be provided by the `cancelReason`
field.

For fills the status field represents the status of the transaction on-chain.

```javascript
export const STATUSES = {
  PENDING: 'PENDING', // The fill has been sent to the blockchain but not yet mined
  REVERTED: 'REVERTED', // The fill was sent to the blockchain, but was reverted on-chain
  CONFIRMED: 'CONFIRMED', // The fill was sent to the blockchain and successfully mined
};
```

### GET /v2/markets
Description:
Get all information on all markets

Headers:
```
Content-Type: application/json
```
Query Params:

|Field Name|Description|
|----------|-----------|

Example Response Body:
```json
{
 "markets": {
    "WETH-DAI": {
      "name": "WETH-DAI",
      "baseCurrency": {
        "currency": "WETH",
        "decimals": 18,
        "soloMarketId": 0,
      },
      "quoteCurrency": {
        "currency": "DAI",
        "decimals": 18,
        "soloMarketId": 3,
      },
      "minimumTickSize": "0.01",
      "minimumOrderSize": "100000000000000000",
      "smallOrderThreshold": "500000000000000000",
      "makerFee": "0",
      "largeTakerFee": "0.005",
      "smallTakerFee": "0.0015",
    },
    "WETH-USDC": {
      "name": "WETH-USDC",
      "baseCurrency": {
        "currency": "WETH",
        "decimals": 18,
        "soloMarketId": 0,
      },
      "quoteCurrency": {
        "currency": "USDC",
        "decimals": 6,
        "soloMarketId": 2,
      },
      "minimumTickSize": "0.00000000000001",
      "minimumOrderSize": "100000000000000000",
      "smallOrderThreshold": "500000000000000000",
      "makerFee": "0",
      "largeTakerFee": "0.005",
      "smallTakerFee": "0.0015",
    },
    "DAI-USDC": {
      "name": "DAI-USDC",
      "baseCurrency": {
        "currency": "DAI",
        "decimals": 18,
        "soloMarketId": 3,
      },
      "quoteCurrency": {
        "currency": "USDC",
        "decimals": 6,
        "soloMarketId": 1,
      },
      "minimumTickSize": "0.0000000000000001",
      "minimumOrderSize": "20000000000000000000",
      "smallOrderThreshold": "100000000000000000000",
      "makerFee": "0",
      "largeTakerFee": "0.005",
      "smallTakerFee": "0.0005",
    },
  }
}
```


## Accounts

### GET /v1/accounts/:address

Description:
Get account balances for a particular account owner. This endpoint can also be used to get pending balances for an account corresponding to pending fills.

Headers:
```
Content-Type: application/json
```

Note: To get any account's collateralization, simply take `sumSupplyUsdValue / sumBorrowUsdValue`.
The minimum collateralization where liquidation occurs on the protocol using this formula is 1.15.

Query Params:

|Field Name|Description|
|----------|-----------|
|?number|(Optional) The Solo Acount number of the account to request balances for.|

Example Response Body:
```json
{
  "owner": "0x0913017c740260fea4b2c62828a4008ca8b0d6e4",
  "number": "0",
  "uuid": "72cd6a2a-17ff-4394-92d3-e951a96aa266",
  "balances": {
    "0": {
      "owner": "0x0913017c740260fea4b2c62828a4008ca8b0d6e4",
      "number": "0",
      "marketId": 0,
      "accountUuid": "72cd6a2a-17ff-4394-92d3-e951a96aa266",
      "wei": "10000184397123234.892111593021043502",
      "pendingWei": "20000184397123234.892111593021043502",
      "expiresAt": null,
      "par": "9994719126810778",
    },
    "1": {
      "par": 0,
      "wei": 0,
      "expiresAt": null
    },
    "2": {
      "par": 0,
      "wei": 0,
      "expiresAt": null
    }
  }
}
```
