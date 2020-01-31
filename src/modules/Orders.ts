import { promisify } from 'es6-promisify';
import Web3 from 'web3';
import BigNumber from 'bignumber.js';
import { Contracts } from './Contracts';
import {
  addressToBytes32,
  boolToBytes32,
  hashString,
  addressesAreEqual,
  stripHexPrefix,
} from '../lib/BytesHelper';
import {
  SIGNATURE_TYPES,
  EIP712_DOMAIN_STRING,
  EIP712_DOMAIN_STRUCT,
  createTypedSignature,
  ecRecoverTypedSignature,
} from '../lib/SignatureHelper';
import {
  address,
  CallOptions,
  SendOptions,
  Order,
  SignedOrder,
  OrderState,
  SigningMethod,
  TypedSignature,
} from '../lib/types';

const EIP712_ORDER_STRUCT = [
  { type: 'bool',    name: 'isBuy' },
  { type: 'uint256', name: 'amount' },
  { type: 'uint256', name: 'limitPrice' },
  { type: 'uint256', name: 'stopPrice' },
  { type: 'uint256', name: 'fee' },
  { type: 'address', name: 'maker' },
  { type: 'address', name: 'taker' },
  { type: 'uint256', name: 'expiration' },
  { type: 'uint256', name: 'salt' },
];

const EIP712_ORDER_STRUCT_STRING =
  'Order(' +
  'bool isBuy,' +
  'uint256 amount,' +
  'uint256 limitPrice,' +
  'uint256 stopPrice,' +
  'uint256 fee,' +
  'address maker,' +
  'address taker,' +
  'uint256 expiration,' +
  'uint256 salt' +
  ')';

const EIP712_CANCEL_ORDER_STRUCT = [
  { type: 'string', name: 'action' },
  { type: 'bytes32[]', name: 'orderHashes' },
];

const EIP712_CANCEL_ORDER_STRUCT_STRING =
  'CancelOrder(' +
  'string action,' +
  'bytes32[] orderHashes' +
  ')';

export class Orders {
  private contracts: Contracts;
  private networkId: number;
  private web3: Web3;

  // ============ Constructor ============

  constructor(
    contracts: Contracts,
    web3: Web3,
    networkId: number,
  ) {
    this.web3 = web3;
    this.contracts = contracts;
    this.networkId = networkId;
  }

  // ============ On-Chain Approve / On-Chain Cancel ============

  /**
   * Sends an transaction to pre-approve an order on-chain (so that no signature is required when
   * filling the order).
   */
  public async approveOrder(
    order: Order,
    options?: SendOptions,
  ): Promise<any> {
    const stringifiedOrder = this.stringifyOrder(order);
    return this.contracts.send(
      this.contracts.p1Orders.methods.approveOrder(stringifiedOrder),
      options,
    );
  }

  /**
   * Sends an transaction to cancel an order on-chain.
   */
  public async cancelOrder(
    order: Order,
    options?: SendOptions,
  ): Promise<any> {
    const stringifiedOrder = this.stringifyOrder(order);
    return this.contracts.send(
      this.contracts.p1Orders.methods.cancelOrder(stringifiedOrder),
      options,
    );
  }

  // ============ Getter Contract Methods ============

  /**
   * Gets the status and the current filled amount (in makerAmount) of all given orders.
   */
  public async getOrdersStatus(
    orders: Order[],
    options?: CallOptions,
  ): Promise<OrderState[]> {
    const orderHashes = orders.map(order => this.getOrderHash(order));
    const states: any[] = await this.contracts.call(
      this.contracts.p1Orders.methods.getOrdersStatus(orderHashes),
      options,
    );

    return states.map((state) => {
      return {
        status: parseInt(state[0], 10),
        filledAmount: new BigNumber(state[1]),
      };
    });
  }

  // ============ Signing Methods ============

  /**
   * Sends order to current provider for signing. Can sign locally if the signing account is
   * loaded into web3 and SigningMethod.Hash is used.
   */
  public async signOrder(
    order: Order,
    signingMethod: SigningMethod,
  ): Promise<string> {
    switch (signingMethod) {
      case SigningMethod.Hash:
      case SigningMethod.UnsafeHash:
      case SigningMethod.Compatibility:
        const orderHash = this.getOrderHash(order);
        const rawSignature = await this.web3.eth.sign(orderHash, order.maker);
        const hashSig = createTypedSignature(rawSignature, SIGNATURE_TYPES.DECIMAL);
        if (signingMethod === SigningMethod.Hash) {
          return hashSig;
        }
        const unsafeHashSig = createTypedSignature(rawSignature, SIGNATURE_TYPES.NO_PREPEND);
        if (signingMethod === SigningMethod.UnsafeHash) {
          return unsafeHashSig;
        }
        if (this.orderByHashHasValidSignature(orderHash, unsafeHashSig, order.maker)) {
          return unsafeHashSig;
        }
        return hashSig;

      case SigningMethod.TypedData:
      case SigningMethod.MetaMask:
      case SigningMethod.MetaMaskLatest:
      case SigningMethod.CoinbaseWallet:
        return this.ethSignTypedOrderInternal(
          order,
          signingMethod,
        );

      default:
        throw new Error(`Invalid signing method ${signingMethod}`);
    }
  }

  /**
   * Sends order to current provider for signing of a cancel message. Can sign locally if the
   * signing account is loaded into web3 and SigningMethod.Hash is used.
   */
  public async signCancelOrder(
    order: Order,
    signingMethod: SigningMethod,
  ): Promise<string> {
    return this.signCancelOrderByHash(
      this.getOrderHash(order),
      order.maker,
      signingMethod,
    );
  }

  /**
   * Sends orderHash to current provider for signing of a cancel message. Can sign locally if
   * the signing account is loaded into web3 and SigningMethod.Hash is used.
   */
  public async signCancelOrderByHash(
    orderHash: string,
    signer: string,
    signingMethod: SigningMethod,
  ): Promise<string> {
    switch (signingMethod) {
      case SigningMethod.Hash:
      case SigningMethod.UnsafeHash:
      case SigningMethod.Compatibility:
        const cancelHash = this.orderHashToCancelOrderHash(orderHash);
        const rawSignature = await this.web3.eth.sign(cancelHash, signer);
        const hashSig = createTypedSignature(rawSignature, SIGNATURE_TYPES.DECIMAL);
        if (signingMethod === SigningMethod.Hash) {
          return hashSig;
        }
        const unsafeHashSig = createTypedSignature(rawSignature, SIGNATURE_TYPES.NO_PREPEND);
        if (signingMethod === SigningMethod.UnsafeHash) {
          return unsafeHashSig;
        }
        if (this.cancelOrderByHashHasValidSignature(orderHash, unsafeHashSig, signer)) {
          return unsafeHashSig;
        }
        return hashSig;

      case SigningMethod.TypedData:
      case SigningMethod.MetaMask:
      case SigningMethod.MetaMaskLatest:
      case SigningMethod.CoinbaseWallet:
        return this.ethSignTypedCancelOrderInternal(
          orderHash,
          signer,
          signingMethod,
        );

      default:
        throw new Error(`Invalid signing method ${signingMethod}`);
    }
  }

  // ============ Signature Verification ============

  /**
   * Returns true if the order object has a non-null valid signature from the maker of the order.
   */
  public orderHasValidSignature(
    order: SignedOrder,
  ): boolean {
    return this.orderByHashHasValidSignature(
      this.getOrderHash(order),
      order.typedSignature,
      order.maker,
    );
  }

  /**
   * Returns true if the order hash has a non-null valid signature from a particular signer.
   */
  public orderByHashHasValidSignature(
    orderHash: string,
    typedSignature: string,
    expectedSigner: address,
  ): boolean {
    const signer = ecRecoverTypedSignature(orderHash, typedSignature);
    return addressesAreEqual(signer, expectedSigner);
  }

  /**
   * Returns true if the cancel order message has a valid signature.
   */
  public cancelOrderHasValidSignature(
    order: Order,
    typedSignature: string,
  ): boolean {
    return this.cancelOrderByHashHasValidSignature(
      this.getOrderHash(order),
      typedSignature,
      order.maker,
    );
  }

  /**
   * Returns true if the cancel order message has a valid signature.
   */
  public cancelOrderByHashHasValidSignature(
    orderHash: string,
    typedSignature: string,
    expectedSigner: address,
  ): boolean {
    const cancelHash = this.orderHashToCancelOrderHash(orderHash);
    const signer = ecRecoverTypedSignature(cancelHash, typedSignature);
    return addressesAreEqual(signer, expectedSigner);
  }

  // ============ Hashing Functions ============

  /**
   * Returns the final signable EIP712 hash for approving an order.
   */
  public getOrderHash(
    order: Order,
  ): string {
    const structHash = Web3.utils.soliditySha3(
      { t: 'bytes32', v: hashString(EIP712_ORDER_STRUCT_STRING) },
      { t: 'bytes32', v: boolToBytes32(order.isBuy) },
      { t: 'uint256', v: order.amount.toFixed(0) },
      { t: 'uint256', v: order.limitPrice.toFixed(0) },
      { t: 'uint256', v: order.stopPrice.toFixed(0) },
      { t: 'uint256', v: order.fee.toFixed(0) },
      { t: 'bytes32', v: addressToBytes32(order.maker) },
      { t: 'bytes32', v: addressToBytes32(order.taker) },
      { t: 'uint256', v: order.expiration.toFixed(0) },
      { t: 'uint256', v: order.salt.toFixed(0) },
    );
    return this.getEIP712Hash(structHash);
  }

  /**
   * Given some order hash, returns the hash of a cancel-order message.
   */
  public orderHashToCancelOrderHash(
    orderHash: string,
  ): string {
    const structHash = Web3.utils.soliditySha3(
      { t: 'bytes32', v: hashString(EIP712_CANCEL_ORDER_STRUCT_STRING) },
      { t: 'bytes32', v: hashString('Cancel Orders') },
      { t: 'bytes32', v: Web3.utils.soliditySha3({ t: 'bytes32', v: orderHash }) },
    );
    return this.getEIP712Hash(structHash);
  }

  /**
   * Returns the EIP712 domain separator hash.
   */
  public getDomainHash(): string {
    return Web3.utils.soliditySha3(
      { t: 'bytes32', v: hashString(EIP712_DOMAIN_STRING) },
      { t: 'bytes32', v: hashString('P1Orders') },
      { t: 'bytes32', v: hashString('1.0') },
      { t: 'uint256', v: this.networkId.toString(10) },
      { t: 'bytes32', v: addressToBytes32(this.contracts.p1Orders.options.address) },
    );
  }

  /**
   * Returns a signable EIP712 Hash of a struct
   */
  public getEIP712Hash(
    structHash: string,
  ): string {
    return Web3.utils.soliditySha3(
      { t: 'bytes2', v: '0x1901' },
      { t: 'bytes32', v: this.getDomainHash() },
      { t: 'bytes32', v: structHash },
    );
  }

  // ============ To-Bytes Functions ============

  public orderToBytes(
    order: Order,
  ): string {
    return this.web3.eth.abi.encodeParameters(
      EIP712_ORDER_STRUCT.map(arg => arg.type),
      EIP712_ORDER_STRUCT.map(
        arg => order[arg.name].toFixed
          ? order[arg.name].toFixed(0)
          : order[arg.name],
        ),
    );
  }

  public fillToTradeData(
    order: SignedOrder,
    amount: BigNumber,
    price: BigNumber,
    fee: BigNumber,
  ): string {
    const orderData = this.orderToBytes(order);
    const signatureData = order.typedSignature + '0'.repeat(60);
    const fillData = this.web3.eth.abi.encodeParameters(
      ['uint256', 'uint256', 'uint256'],
      [amount.toFixed(0), price.toFixed(0), fee.toFixed(0)],
    );
    return `0x${stripHexPrefix(orderData)}${stripHexPrefix(signatureData)}${stripHexPrefix(fillData)}`;
  }

  // ============ Private Helper Functions ============

  private stringifyOrder(
    order: Order,
  ): any {
    const stringifiedOrder = { ... order };
    for (const [key, value] of Object.entries(order)) {
      if (typeof value !== 'string' && typeof value !== 'boolean') {
        stringifiedOrder[key] = new BigNumber(value).toFixed(0);
      }
    }
    return stringifiedOrder;
  }

  private getDomainData() {
    return {
      name: 'P1Orders',
      version: '1.0',
      chainId: this.networkId,
      verifyingContract: this.contracts.p1Orders.options.address,
    };
  }

  private async ethSignTypedOrderInternal(
    order: Order,
    signingMethod: SigningMethod,
  ): Promise<TypedSignature> {
    const orderData = {
      isBuy: order.isBuy,
      amount: order.amount.toFixed(0),
      limitPrice: order.limitPrice.toFixed(0),
      stopPrice: order.stopPrice.toFixed(0),
      fee: order.fee.toFixed(0),
      maker: order.maker,
      taker: order.taker,
      expiration: order.expiration.toFixed(0),
      salt: order.salt.toFixed(0),
    };
    const data = {
      types: {
        EIP712Domain: EIP712_DOMAIN_STRUCT,
        Order: EIP712_ORDER_STRUCT,
      },
      domain: this.getDomainData(),
      primaryType: 'Order',
      message: orderData,
    };
    return this.ethSignTypedDataInternal(
      order.maker,
      data,
      signingMethod,
    );
  }

  private async ethSignTypedCancelOrderInternal(
    orderHash: string,
    signer: string,
    signingMethod: SigningMethod,
  ): Promise<TypedSignature> {
    const data = {
      types: {
        EIP712Domain: EIP712_DOMAIN_STRUCT,
        CancelOrder: EIP712_CANCEL_ORDER_STRUCT,
      },
      domain: this.getDomainData(),
      primaryType: 'CancelOrder',
      message: {
        action: 'Cancel Orders',
        orderHashes: [orderHash],
      },
    };
    return this.ethSignTypedDataInternal(
      signer,
      data,
      signingMethod,
    );
  }

  private async ethSignTypedDataInternal(
    signer: string,
    data: any,
    signingMethod: SigningMethod,
  ): Promise<TypedSignature> {
    let sendMethod: string;
    let rpcMethod: string;
    let rpcData: any;

    switch (signingMethod) {
      case SigningMethod.TypedData:
        sendMethod = 'send';
        rpcMethod = 'eth_signTypedData';
        rpcData = data;
        break;
      case SigningMethod.MetaMask:
        sendMethod = 'sendAsync';
        rpcMethod = 'eth_signTypedData_v3';
        rpcData = JSON.stringify(data);
        break;
      case SigningMethod.MetaMaskLatest:
        sendMethod = 'sendAsync';
        rpcMethod = 'eth_signTypedData_v4';
        rpcData = JSON.stringify(data);
        break;
      case SigningMethod.CoinbaseWallet:
        sendMethod = 'sendAsync';
        rpcMethod = 'eth_signTypedData';
        rpcData = data;
        break;
      default:
        throw new Error(`Invalid signing method ${signingMethod}`);
    }

    const provider = this.web3.currentProvider;
    const sendAsync = promisify(provider[sendMethod]).bind(provider);
    const response = await sendAsync({
      method: rpcMethod,
      params: [signer, rpcData],
      jsonrpc: '2.0',
      id: new Date().getTime(),
    });
    if (response.error) {
      throw new Error(response.error.message);
    }
    return `0x${stripHexPrefix(response.result)}0${SIGNATURE_TYPES.NO_PREPEND}`;
  }
}
