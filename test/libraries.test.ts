import BigNumber from 'bignumber.js';

import { bnToBytes32 } from '../src/lib/BytesHelper';
import { ADDRESSES } from '../src/lib/Constants';
import {
  createTypedSignature,
  getPrependedHash,
  SIGNATURE_TYPES,
} from '../src/lib/SignatureHelper';
import { address, BaseValue, Balance, Price } from '../src/lib/types';
import { expectBN, expectAddressesEqual, expectThrow, expect } from './helpers/Expect';
import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';

let admin: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializeWithTestContracts(ctx);
  admin = ctx.accounts[0];
}

perpetualDescribe('Solidity libraries', init, (ctx: ITestContext) => {

  describe('Adminable', () => {

    it('getAdmin()', async () => {
      expectAddressesEqual(await ctx.perpetual.proxy.getAdmin(), admin);
    });
  });

  describe('BaseMath', () => {

    it('base()', async () => {
      expectBN(await ctx.perpetual.testing.lib.base()).to.equal(new BaseValue(1).toSolidity());
    });

    it('baseMul()', async () => {
      // Base value has implied decimals so it can encode extra precision.
      expectBN(await ctx.perpetual.testing.lib.baseMul(
        23456,
        new BaseValue('123.456').toSolidity(),
      )).to.equal(2895783);
    });
  });

  describe('Math', () => {

    it('getFraction()', async () => {
      expectBN(await ctx.perpetual.testing.lib.getFraction(
        7000,
        15000,
        11,
      )).to.equal(9545454);
    });

    it('getFractionRoundUp()', async () => {
      expectBN(await ctx.perpetual.testing.lib.getFractionRoundUp(
        7000,
        15000,
        11,
      )).to.equal(9545455);
    });

    it('getFractionRoundUp() if target is zero', async () => {
      expectBN(await ctx.perpetual.testing.lib.getFractionRoundUp(
        0,
        15000,
        11,
      )).to.equal(0);
    });

    it('getFractionRoundUp() reverts with message if denominator is zero', async () => {
      await expectThrow(
        ctx.perpetual.testing.lib.getFractionRoundUp(
          7000,
          15000,
          0,
        ),
        'SafeMath: division by zero',
      );
    });

    it('min()', async () => {
      expectBN(await ctx.perpetual.testing.lib.min(111, 111)).to.equal(111);
      expectBN(await ctx.perpetual.testing.lib.min(111, 112)).to.equal(111);
      expectBN(await ctx.perpetual.testing.lib.min(112, 111)).to.equal(111);
    });

    it('max()', async () => {
      expectBN(await ctx.perpetual.testing.lib.max(111, 111)).to.equal(111);
      expectBN(await ctx.perpetual.testing.lib.max(111, 112)).to.equal(112);
      expectBN(await ctx.perpetual.testing.lib.max(112, 111)).to.equal(112);
    });
  });

  describe('Require', () => {

    it('that()', async () => {
      await ctx.perpetual.testing.lib.that(true, 'reason', ADDRESSES.TEST[0]);
    });

    it('that() reverts', async () => {
      const address = ADDRESSES.TEST[0];
      await expectThrow(
        ctx.perpetual.testing.lib.that(false, 'reason', address),
        `reason: ${address.slice(0, 10)}...${address.slice(-8)}`,
      );
    });
  });

  describe('SafeCast', () => {

    it('toUint128()', async () => {
      const value = new BigNumber(2).pow(128).minus(1);
      expectBN(await ctx.perpetual.testing.lib.toUint128(value)).to.equal(value);
    });

    it('toUint128() reverts', async () => {
      await expectThrow(
        ctx.perpetual.testing.lib.toUint128(
          new BigNumber(2).pow(128),
        ),
        'SafeCast: value doesn\'t fit in 128 bits',
      );
    });

    it('toUint120()', async () => {
      const value = new BigNumber(2).pow(120).minus(1);
      expectBN(await ctx.perpetual.testing.lib.toUint120(value)).to.equal(value);
    });

    it('toUint120() reverts', async () => {
      await expectThrow(
        ctx.perpetual.testing.lib.toUint120(
          new BigNumber(2).pow(120),
        ),
        'SafeCast: value doesn\'t fit in 120 bits',
      );
    });

    it('toUint32()', async () => {
      const value = new BigNumber(2).pow(32).minus(1);
      expectBN(await ctx.perpetual.testing.lib.toUint32(value)).to.equal(value);
    });

    it('toUint32() reverts', async () => {
      await expectThrow(
        ctx.perpetual.testing.lib.toUint32(
          new BigNumber(2).pow(32),
        ),
        'SafeCast: value doesn\'t fit in 32 bits',
      );
    });
  });

  describe('SignedMath', () => {

    it('add()', async () => {
      // First value may be positive or negative, second is always positive.
      expectBN(await ctx.perpetual.testing.lib.add(99, 100)).to.equal(199);
      expectBN(await ctx.perpetual.testing.lib.add(-99, 99)).to.equal(0);
      expectBN(await ctx.perpetual.testing.lib.add(-99, 100)).to.equal(1);
      expectBN(await ctx.perpetual.testing.lib.add(-100, 99)).to.equal(-1);
    });

    it('sub()', async () => {
      // First value may be positive or negative, second is always positive.
      expectBN(await ctx.perpetual.testing.lib.sub(-99, 100)).to.equal(-199);
      expectBN(await ctx.perpetual.testing.lib.sub(99, 99)).to.equal(0);
      expectBN(await ctx.perpetual.testing.lib.sub(99, 100)).to.equal(-1);
      expectBN(await ctx.perpetual.testing.lib.sub(100, 99)).to.equal(1);
    });
  });

  describe('Storage', () => {
    // keccak256('test')
    const testSlot = '0x9c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb658';

    it('load()', async () => {
      expectBN(await ctx.perpetual.testing.lib.load(testSlot)).to.equal(0);
    });

    it('store()', async () => {
      const value = bnToBytes32(9876543210987654321);
      await ctx.perpetual.testing.lib.store(testSlot, value);
      expectBN(await ctx.perpetual.testing.lib.load(testSlot)).to.equal(value);
    });
  });

  describe('TypedSignature', () => {
    const hash = '0x1234567812345678123456781234567812345678123456781234567812345678';
    const r = '0x30755ed65396facf86c53e6217c52b4daebe72aa4941d89635409de4c9c7f946';
    const s = '0x6d4e9aaec7977f05e923889b33c0d0dd27d7226b6e6f56ce737465c5cfd04be4';
    const v = '0x1b';
    const rawSignature = `${r}${s.substr(2)}${v.substr(2)}`;

    it('recover() no prepend', async () => {
      const signatureData = createTypedSignature(rawSignature, SIGNATURE_TYPES.NO_PREPEND) +
        '0'.repeat(60);
      const messageHash = getPrependedHash(hash, SIGNATURE_TYPES.NO_PREPEND);
      const signer = ctx.perpetual.web3.eth.accounts.recover({ r, s, v, messageHash });
      expectAddressesEqual(signer, await ctx.perpetual.testing.lib.recover(hash, signatureData));
    });

    it('recover() decimal', async () => {
      const signatureData = createTypedSignature(rawSignature, SIGNATURE_TYPES.DECIMAL) +
        '0'.repeat(60);
      const messageHash = getPrependedHash(hash, SIGNATURE_TYPES.DECIMAL);
      const signer = ctx.perpetual.web3.eth.accounts.recover({ r, s, v, messageHash });
      expectAddressesEqual(signer, await ctx.perpetual.testing.lib.recover(hash, signatureData));
    });

    it('recover() hexadecimal', async () => {
      const signatureData = createTypedSignature(rawSignature, SIGNATURE_TYPES.HEXADECIMAL) +
        '0'.repeat(60);
      const messageHash = getPrependedHash(hash, SIGNATURE_TYPES.HEXADECIMAL);
      const signer = ctx.perpetual.web3.eth.accounts.recover({ r, s, v, messageHash });
      expectAddressesEqual(signer, await ctx.perpetual.testing.lib.recover(hash, signatureData));
    });
  });

  describe('P1BalanceMath', async () => {
    const posPos = new Balance(200, 300);
    const posNeg = new Balance(200, -300);
    const negPos = new Balance(-200, 300);
    const negNeg = new Balance(-200, -300);

    it('copy()', async () => {
      expect(await ctx.perpetual.testing.lib.copy(posPos)).to.deep.equal(posPos);
      expect(await ctx.perpetual.testing.lib.copy(negNeg)).to.deep.equal(negNeg);
    });

    it('addToMargin()', async () => {
      expect(await ctx.perpetual.testing.lib.addToMargin(negPos, 400)).to.deep.equal(posPos);
      expect(await ctx.perpetual.testing.lib.addToMargin(negNeg, 400)).to.deep.equal(posNeg);
    });

    it('subFromMargin()', async () => {
      expect(await ctx.perpetual.testing.lib.subFromMargin(posPos, 400)).to.deep.equal(negPos);
      expect(await ctx.perpetual.testing.lib.subFromMargin(posNeg, 400)).to.deep.equal(negNeg);
    });

    it('addToPosition()', async () => {
      expect(await ctx.perpetual.testing.lib.addToPosition(posNeg, 600)).to.deep.equal(posPos);
      expect(await ctx.perpetual.testing.lib.addToPosition(negNeg, 600)).to.deep.equal(negPos);
    });

    it('subFromPosition()', async () => {
      expect(await ctx.perpetual.testing.lib.subFromPosition(posPos, 600)).to.deep.equal(posNeg);
      expect(await ctx.perpetual.testing.lib.subFromPosition(negPos, 600)).to.deep.equal(negNeg);
    });

    it('getPositiveAndNegativeValue()', async () => {
      const price = new Price('.033');

      let value = await ctx.perpetual.testing.lib.getPositiveAndNegativeValue(posPos, price);
      expectBN(value.positive).to.eq(209);
      expectBN(value.negative).to.eq(0);

      value = await ctx.perpetual.testing.lib.getPositiveAndNegativeValue(posNeg, price);
      expectBN(value.positive).to.eq(200);
      expectBN(value.negative).to.eq(9);

      value = await ctx.perpetual.testing.lib.getPositiveAndNegativeValue(negPos, price);
      expectBN(value.positive).to.eq(9);
      expectBN(value.negative).to.eq(200);

      value = await ctx.perpetual.testing.lib.getPositiveAndNegativeValue(negNeg, price);
      expectBN(value.positive).to.eq(0);
      expectBN(value.negative).to.eq(209);
    });

    it('getMargin()', async () => {
      expectBN(await ctx.perpetual.testing.lib.getMargin(posPos)).to.equal(200);
      expectBN(await ctx.perpetual.testing.lib.getMargin(negNeg)).to.equal(-200);
    });

    it('getPosition()', async () => {
      expectBN(await ctx.perpetual.testing.lib.getPosition(posNeg)).to.equal(-300);
      expectBN(await ctx.perpetual.testing.lib.getPosition(negPos)).to.equal(300);
    });

    it('setMargin()', async () => {
      expect(await ctx.perpetual.testing.lib.setMargin(posPos, -200)).to.deep.equal(negPos);
      expect(await ctx.perpetual.testing.lib.setMargin(negNeg, 200)).to.deep.equal(posNeg);
    });

    it('setPosition()', async () => {
      expect(await ctx.perpetual.testing.lib.setPosition(posNeg, 300)).to.deep.equal(posPos);
      expect(await ctx.perpetual.testing.lib.setPosition(negPos, -300)).to.deep.equal(negNeg);
    });
  });
});
