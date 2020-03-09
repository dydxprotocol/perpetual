import BigNumber from 'bignumber.js';

import {
  CallOptions,
  BigNumberable,
  SendOptions,
  address,
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
    const sintBN = new BigNumber(sint);
    const result: { isPositive: boolean, value: string } = await this.contracts.call(
      this.contracts.testLib.methods.add(
        {
          value: sintBN.abs().toFixed(0),
          isPositive: sintBN.isPositive(),
        },
        new BigNumber(value).toFixed(0),
      ),
      options,
    );
    if (result.isPositive) {
      return new BigNumber(result.value);
    }
    return new BigNumber(result.value).negated();
  }

  public async sub(
    sint: BigNumberable,
    value: BigNumberable,
    options?: CallOptions,
  ): Promise<BigNumber> {
    const sintBN = new BigNumber(sint);
    const result: { isPositive: boolean, value: string } = await this.contracts.call(
      this.contracts.testLib.methods.sub(
        {
          value: sintBN.abs().toFixed(0),
          isPositive: sintBN.isPositive(),
        },
        new BigNumber(value).toFixed(0),
      ),
      options,
    );
    if (result.isPositive) {
      return new BigNumber(result.value);
    }
    return new BigNumber(result.value).negated();
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
}
