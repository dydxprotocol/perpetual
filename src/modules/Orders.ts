import BigNumber from 'bignumber.js';
import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';

import { Contracts } from './Contracts';
import {
  addressToBytes32,
  bnToBytes32,
  hashString,
  addressesAreEqual,
  combineHexStrings,
} from '../lib/BytesHelper';
import {
  SIGNATURE_TYPES,
  EIP712_DOMAIN_STRING,
  EIP712_DOMAIN_STRUCT,
  createTypedSignature,
  ecRecoverTypedSignature,
  ethSignTypedDataInternal,
  hashHasValidSignature,
  getEIP712Hash,
} from '../lib/SignatureHelper';
import {
  Balance,
  BigNumberable,
  CallOptions,
  Fee,
  Order,
  OrderState,
  Price,
  SendOptions,
  SignedOrder,
  SigningMethod,
  TypedSignature,
  address,
} from '../lib/types';
import { ORDER_FLAGS } from '../lib/Constants';

const EIP712_ORDER_STRUCT = [
  { type: 'bytes32', name: 'flags' },
  { type: 'uint256', name: 'amount' },
  { type: 'uint256', name: 'limitPrice' },
  { type: 'uint256', name: 'triggerPrice' },
  { type: 'uint256', name: 'limitFee' },
  { type: 'address', name: 'maker' },
  { type: 'address', name: 'taker' },
  { type: 'uint256', name: 'expiration' },
];

const DEFAULT_EIP712_DOMAIN_NAME = 'P1Orders';
const EIP712_DOMAIN_VERSION = '1.0';
const EIP712_ORDER_STRUCT_STRING =
  'Order(' +
  'bytes32 flags,' +
  'uint256 amount,' +
  'uint256 limitPrice,' +
  'uint256 triggerPrice,' +
  'uint256 limitFee,' +
  'address maker,' +
  'address taker,' +
  'uint256 expiration' +
  ')';

const EIP712_CANCEL_ORDER_STRUCT = [
  { type: 'string', name: 'action' },
  { type: 'bytes32[]', name: 'orderHashes' },
];

const EIP712_CANCEL_ORDER_STRUCT_STRING =
  'CancelLimitOrder(' +
  'string action,' +
  'bytes32[] orderHashes' +
  ')';

export class Orders {
  private contracts: Contracts;
  private web3: Web3;
  private eip712DomainName: string;
  private orders: Contract;

  // ============ Constructor ============

  constructor(
    contracts: Contracts,
    web3: Web3,
    eip712DomainName: string = DEFAULT_EIP712_DOMAIN_NAME,
    orders: Contract = contracts.p1Orders,
  ) {
    this.contracts = contracts;
    this.web3 = web3;
    this.eip712DomainName = eip712DomainName;
    this.orders = orders;
  }

  get address(): address {
    return this.orders.options.address;
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
    const stringifiedOrder = this.orderToSolidity(order);
    return this.contracts.send(
      this.orders.methods.approveOrder(stringifiedOrder),
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
    const stringifiedOrder = this.orderToSolidity(order);
    return this.contracts.send(
      this.orders.methods.cancelOrder(stringifiedOrder),
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
      this.orders.methods.getOrdersStatus(orderHashes),
      options,
    );

    return states.map((state) => {
      return {
        status: parseInt(state[0], 10),
        filledAmount: new BigNumber(state[1]),
      };
    });
  }

  // ============ Off-Chain Helper Functions ============

  /**
   * Estimate the maker's collateralization after executing a sequence of orders.
   *
   * The `maker` of every order must be the same. This function does not make any on-chain calls,
   * so all information must be passed in, including the oracle price and remaining amounts
   * on the orders. Orders are assumed to be filled at the limit price and limit fee.
   *
   * Returns the ending collateralization ratio for the account, or BigNumber(Infinity) if the
   * account does not end with any negative balances.
   *
   * @param  initialBalance  The initial margin and position balances of the maker account.
   * @param  oraclePrice     The price at which to calculate collateralization.
   * @param  orders          A sequence of orders, with the same maker, to be hypothetically filled.
   * @param  fillAmounts     The corresponding fill amount for each order, denominated in the token
   *                         spent by the maker--quote currency when buying, and base when selling.
   */
  public getAccountCollateralizationAfterMakingOrders(
    initialBalance: Balance,
    oraclePrice: Price,
    orders: Order[],
    makerTokenFillAmounts: BigNumber[],
  ): BigNumber {
    const runningBalance: Balance = initialBalance.copy();

    // For each order, determine the effect on the balance by following the smart contract math.
    for (let i = 0; i < orders.length; i += 1) {
      const order = orders[i];

      const fillAmount = order.isBuy
        ? makerTokenFillAmounts[i].dividedBy(order.limitPrice.value)
        : makerTokenFillAmounts[i];

      // Assume orders are filled at the limit price and limit fee.
      const { marginDelta, positionDelta } = this.getBalanceUpdatesAfterFillingOrder(
        fillAmount,
        order.limitPrice,
        order.limitFee,
        order.isBuy,
      );

      runningBalance.margin = runningBalance.margin.plus(marginDelta);
      runningBalance.position = runningBalance.position.plus(positionDelta);
    }

    return runningBalance.getCollateralization(oraclePrice);
  }

  /**
   * Calculate the effect of filling an order on the maker's balances.
   */
  public getBalanceUpdatesAfterFillingOrder(
    fillAmount: BigNumberable,
    fillPrice: Price,
    fillFee: Fee,
    isBuy: boolean,
  ): {
    marginDelta: BigNumber,
    positionDelta: BigNumber,
  } {
    const positionAmount = new BigNumber(fillAmount).dp(0, BigNumber.ROUND_DOWN);
    const fee = fillFee.times(fillPrice.value).value.dp(18, BigNumber.ROUND_DOWN);
    const marginPerPosition = isBuy ? fillPrice.plus(fee) : fillPrice.minus(fee);
    const marginAmount = positionAmount.times(marginPerPosition.value).dp(0, BigNumber.ROUND_DOWN);
    return {
      marginDelta: isBuy ? marginAmount.negated() : marginAmount,
      positionDelta: isBuy ? positionAmount : positionAmount.negated(),
    };
  }

  public getFeeForOrder(
    amount: BigNumber,
    isTaker: boolean = true,
  ): Fee {
    if (!isTaker) {
      return Fee.fromBips('-2.5');
    }

    const isSmall = amount.lt('0.1e8');
    return isSmall
      ? Fee.fromBips('50.0')
      : Fee.fromBips('7.5');
  }

  // ============ Signing Methods ============

  public async getSignedOrder(
    order: Order,
    signingMethod: SigningMethod,
  ): Promise<SignedOrder> {
    const typedSignature = await this.signOrder(order, signingMethod);
    return {
      ...order,
      typedSignature,
    };
  }

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
        if (hashHasValidSignature(orderHash, unsafeHashSig, order.maker)) {
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
        if (hashHasValidSignature(orderHash, unsafeHashSig, signer)) {
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
    return hashHasValidSignature(
      this.getOrderHash(order),
      order.typedSignature,
      order.maker,
    );
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
      { t: 'bytes32', v: this.getOrderFlags(order) },
      { t: 'uint256', v: order.amount.toFixed(0) },
      { t: 'uint256', v: order.limitPrice.toSolidity() },
      { t: 'uint256', v: order.triggerPrice.toSolidity() },
      { t: 'uint256', v: order.limitFee.toSolidity() },
      { t: 'bytes32', v: addressToBytes32(order.maker) },
      { t: 'bytes32', v: addressToBytes32(order.taker) },
      { t: 'uint256', v: order.expiration.toFixed(0) },
    );
    return getEIP712Hash(this.getDomainHash(), structHash);
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
    return getEIP712Hash(this.getDomainHash(), structHash);
  }

  /**
   * Returns the EIP712 domain separator hash.
   */
  public getDomainHash(): string {
    return Web3.utils.soliditySha3(
      { t: 'bytes32', v: hashString(EIP712_DOMAIN_STRING) },
      { t: 'bytes32', v: hashString(this.eip712DomainName) },
      { t: 'bytes32', v: hashString(EIP712_DOMAIN_VERSION) },
      { t: 'uint256', v: `${this.contracts.networkId}` },
      { t: 'bytes32', v: addressToBytes32(this.address) },
    );
  }

  // ============ To-Bytes Functions ============

  public orderToBytes(
    order: Order,
  ): string {
    const solidityOrder = this.orderToSolidity(order);
    return this.web3.eth.abi.encodeParameters(
      EIP712_ORDER_STRUCT.map(arg => arg.type),
      EIP712_ORDER_STRUCT.map(arg => solidityOrder[arg.name]),
    );
  }

  public fillToTradeData(
    order: SignedOrder,
    amount: BigNumber,
    price: Price,
    fee: Fee,
  ): string {
    const orderData = this.orderToBytes(order);
    const signatureData = order.typedSignature + '0'.repeat(60);
    const fillData = this.web3.eth.abi.encodeParameters(
      [
        'uint256',
        'uint256',
        'uint256',
        'bool',
      ],
      [
        amount.toFixed(0),
        price.toSolidity(),
        fee.toSolidity(),
        fee.isNegative(),
      ],
    );
    return combineHexStrings(orderData, fillData, signatureData);
  }

  // ============ Private Helper Functions ============

  private orderToSolidity(
    order: Order,
  ): any {
    return {
      flags: this.getOrderFlags(order),
      amount: order.amount.toFixed(0),
      limitPrice: order.limitPrice.toSolidity(),
      triggerPrice: order.triggerPrice.toSolidity(),
      limitFee: order.limitFee.toSolidity(),
      maker: order.maker,
      taker: order.taker,
      expiration: order.expiration.toFixed(0),
    };
  }

  private getDomainData() {
    return {
      name: this.eip712DomainName,
      version: EIP712_DOMAIN_VERSION,
      chainId: this.contracts.networkId,
      verifyingContract: this.address,
    };
  }

  private async ethSignTypedOrderInternal(
    order: Order,
    signingMethod: SigningMethod,
  ): Promise<TypedSignature> {
    const orderData = this.orderToSolidity(order);
    const data = {
      types: {
        EIP712Domain: EIP712_DOMAIN_STRUCT,
        Order: EIP712_ORDER_STRUCT,
      },
      domain: this.getDomainData(),
      primaryType: 'Order',
      message: orderData,
    };
    return ethSignTypedDataInternal(
      this.web3.currentProvider,
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
        CancelLimitOrder: EIP712_CANCEL_ORDER_STRUCT,
      },
      domain: this.getDomainData(),
      primaryType: 'CancelLimitOrder',
      message: {
        action: 'Cancel Orders',
        orderHashes: [orderHash],
      },
    };
    return ethSignTypedDataInternal(
      this.web3.currentProvider,
      signer,
      data,
      signingMethod,
    );
  }

  private getOrderFlags(
    order: Order,
  ): string {
    const booleanFlag = 0
      + (order.limitFee.isNegative() ? ORDER_FLAGS.IS_NEGATIVE_LIMIT_FEE : 0)
      + (order.isDecreaseOnly ? ORDER_FLAGS.IS_DECREASE_ONLY : 0)
      + (order.isBuy ? ORDER_FLAGS.IS_BUY : 0);
    const saltBytes = bnToBytes32(order.salt);
    return `0x${saltBytes.slice(-63)}${booleanFlag}`;
  }
}
