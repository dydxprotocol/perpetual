import BigNumber from 'bignumber.js';

import {
  Balance,
  BalanceStruct,
  CallOptions,
  BigNumberable,
  Price,
  SendOptions,
  SignedIntStruct,
  address,
  bnFromSoliditySignedInt,
  bnToSoliditySignedInt,
} from '../lib/types';
import { Contracts } from '../modules/Contracts';

export class TestLib {
  private contracts: Contracts;

  constructor(
    contracts: Contracts,
  ) {
    this.contracts = contracts;
  }

  public get address(): string {
    return this.contracts.testLib.options.address;
  }

  // ============ BaseMath.sol ============

  public async base(
    options?: CallOptions,
  ): Promise<BigNumber> {
    const base: string = await this.contracts.call(
      this.contracts.testLib.methods.base(),
      options,
    );
    return new BigNumber(base);
  }

  public async baseMul(
    value: BigNumberable,
    baseValue: BigNumberable,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const result: string = await this.contracts.call(
      this.contracts.testLib.methods.baseMul(
        new BigNumber(value).toFixed(0),
        new BigNumber(baseValue).toFixed(0),
      ),
      options,
    );
    return new BigNumber(result);
  }

  // ============ Math.sol ============

  public async getFraction(
    target: BigNumberable,
    numerator: BigNumberable,
    denominator: BigNumberable,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const result: string = await this.contracts.call(
      this.contracts.testLib.methods.getFraction(
        new BigNumber(target).toFixed(0),
        new BigNumber(numerator).toFixed(0),
        new BigNumber(denominator).toFixed(0),
      ),
      options,
    );
    return new BigNumber(result);
  }

  public async getFractionRoundUp(
    target: BigNumberable,
    numerator: BigNumberable,
    denominator: BigNumberable,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const result: string = await this.contracts.call(
      this.contracts.testLib.methods.getFractionRoundUp(
        new BigNumber(target).toFixed(0),
        new BigNumber(numerator).toFixed(0),
        new BigNumber(denominator).toFixed(0),
      ),
      options,
    );
    return new BigNumber(result);
  }

  public async min(
    a: BigNumberable,
    b: BigNumberable,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const result: string = await this.contracts.call(
      this.contracts.testLib.methods.min(
        new BigNumber(a).toFixed(0),
        new BigNumber(b).toFixed(0),
      ),
      options,
    );
    return new BigNumber(result);
  }

  public async max(
    a: BigNumberable,
    b: BigNumberable,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const result: string = await this.contracts.call(
      this.contracts.testLib.methods.max(
        new BigNumber(a).toFixed(0),
        new BigNumber(b).toFixed(0),
      ),
      options,
    );
    return new BigNumber(result);
  }

  // ============ Require.sol ============

  public async that(
    must: boolean,
    reason: string,
    address: address,
    options?: CallOptions,
  ): Promise<void> {
    await this.contracts.call(
      this.contracts.testLib.methods.that(
        must,
        reason,
        address,
      ),
      options,
    );
  }

  // ============ SafeCast.sol ============

  public async toUint128(
    value: BigNumberable,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const result: string = await this.contracts.call(
      this.contracts.testLib.methods.toUint128(
        new BigNumber(value).toFixed(0),
      ),
      options,
    );
    return new BigNumber(result);
  }

  public async toUint120(
    value: BigNumberable,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const result: string = await this.contracts.call(
      this.contracts.testLib.methods.toUint120(
        new BigNumber(value).toFixed(0),
      ),
      options,
    );
    return new BigNumber(result);
  }

  public async toUint32(
    value: BigNumberable,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const result: string = await this.contracts.call(
      this.contracts.testLib.methods.toUint32(
        new BigNumber(value).toFixed(0),
      ),
      options,
    );
    return new BigNumber(result);
  }

  // ============ SignedMath.sol ============

  public async add(
    sint: BigNumberable,
    value: BigNumberable,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const result: SignedIntStruct = await this.contracts.call(
      this.contracts.testLib.methods.add(
        bnToSoliditySignedInt(sint),
        new BigNumber(value).toFixed(0),
      ),
      options,
    );
    return bnFromSoliditySignedInt(result);
  }

  public async sub(
    sint: BigNumberable,
    value: BigNumberable,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const result: SignedIntStruct = await this.contracts.call(
      this.contracts.testLib.methods.sub(
        bnToSoliditySignedInt(sint),
        new BigNumber(value).toFixed(0),
      ),
      options,
    );
    return bnFromSoliditySignedInt(result);
  }

  // ============ Storage.sol ============

  public async load(
    slot: string,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const result = await this.contracts.call(
      this.contracts.testLib.methods.load(
        slot,
      ),
      options,
    );
    return new BigNumber(result);
  }

  public async store(
    slot: string,
    value: string,
    options?: SendOptions,
  ): Promise<void> {
    return this.contracts.send(
      this.contracts.testLib.methods.store(
        slot,
        value,
      ),
      options,
    );
  }

  // ============ TypedSignature.sol ============

  public async recover(
    hash: string,
    typedSignature: string,
    options?: CallOptions,
  ): Promise<address> {
    return this.contracts.call(
      this.contracts.testLib.methods.recover(
        hash,
        typedSignature,
      ),
      options,
    );
  }

  // ============ P1BalanceMath.sol ============

  public async copy(
    balance: Balance,
    options?: CallOptions,
  ): Promise<Balance> {
    const result: BalanceStruct = await this.contracts.call(
      this.contracts.testLib.methods.copy(
        balance.toSolidity(),
      ),
      options,
    );
    return Balance.fromSolidity(result);
  }

  public async addToMargin(
    balance: Balance,
    amount: BigNumberable,
    options?: CallOptions,
  ): Promise<Balance> {
    const result: BalanceStruct = await this.contracts.call(
      this.contracts.testLib.methods.addToMargin(
        balance.toSolidity(),
        new BigNumber(amount).toFixed(0),
      ),
      options,
    );
    return Balance.fromSolidity(result);
  }

  public async subFromMargin(
    balance: Balance,
    amount: BigNumberable,
    options?: CallOptions,
  ): Promise<Balance> {
    const result: BalanceStruct = await this.contracts.call(
      this.contracts.testLib.methods.subFromMargin(
        balance.toSolidity(),
        new BigNumber(amount).toFixed(0),
      ),
      options,
    );
    return Balance.fromSolidity(result);
  }

  public async addToPosition(
    balance: Balance,
    amount: BigNumberable,
    options?: CallOptions,
  ): Promise<Balance> {
    const result: BalanceStruct = await this.contracts.call(
      this.contracts.testLib.methods.addToPosition(
        balance.toSolidity(),
        new BigNumber(amount).toFixed(0),
      ),
      options,
    );
    return Balance.fromSolidity(result);
  }

  public async subFromPosition(
    balance: Balance,
    amount: BigNumberable,
    options?: CallOptions,
  ): Promise<Balance> {
    const result: BalanceStruct = await this.contracts.call(
      this.contracts.testLib.methods.subFromPosition(
        balance.toSolidity(),
        new BigNumber(amount).toFixed(0),
      ),
      options,
    );
    return Balance.fromSolidity(result);
  }

  public async getPositiveAndNegativeValue(
    balance: Balance,
    price: Price,
    options?: CallOptions,
  ): Promise<{ positive: BigNumber, negative: BigNumber }> {
    const [positive, negative]: [string, string] = await this.contracts.call(
      this.contracts.testLib.methods.getPositiveAndNegativeValue(
        balance.toSolidity(),
        price.toSolidity(),
      ),
      options,
    );
    return {
      positive: new BigNumber(positive),
      negative: new BigNumber(negative),
    };
  }

  public async getMargin(
    balance: Balance,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const result: SignedIntStruct = await this.contracts.call(
      this.contracts.testLib.methods.getMargin(
        balance.toSolidity(),
      ),
      options,
    );
    return bnFromSoliditySignedInt(result);
  }

  public async getPosition(
    balance: Balance,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const result: SignedIntStruct = await this.contracts.call(
      this.contracts.testLib.methods.getPosition(
        balance.toSolidity(),
      ),
      options,
    );
    return bnFromSoliditySignedInt(result);
  }

  public async setMargin(
    balance: Balance,
    newMarginSignedInt: BigNumberable,
    options?: CallOptions,
  ): Promise<Balance> {
    const result: BalanceStruct = await this.contracts.call(
      this.contracts.testLib.methods.setMargin(
        balance.toSolidity(),
        bnToSoliditySignedInt(newMarginSignedInt),
      ),
      options,
    );
    return Balance.fromSolidity(result);
  }

  public async setPosition(
    balance: Balance,
    newPositionSignedInt: BigNumberable,
    options?: CallOptions,
  ): Promise<Balance> {
    const result: BalanceStruct = await this.contracts.call(
      this.contracts.testLib.methods.setPosition(
        balance.toSolidity(),
        bnToSoliditySignedInt(newPositionSignedInt),
      ),
      options,
    );
    return Balance.fromSolidity(result);
  }
}
