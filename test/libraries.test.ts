import BigNumber from 'bignumber.js';
import { keccak256 } from 'web3-utils';

import { bnToBytes32 } from '../src/lib/BytesHelper';
import { ADDRESSES } from '../src/lib/Constants';
import { createTypedSignature, SIGNATURE_TYPES } from '../src/lib/SignatureHelper';
import { address, BaseValue } from '../src/lib/types';
import { expectBN, expectAddressesEqual, expectThrow } from './helpers/Expect';
import initializeWithTestContracts from './helpers/initializeWithTestContracts';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';

let admin: address;
let otherAccount: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializeWithTestContracts(ctx);
  admin = ctx.accounts[0];
  otherAccount = ctx.accounts[2];
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

    // TODO(fix).
    // AssertionError: expected '0' to equal '9876543210987655000'
    it('store()', async () => {
      const value = bnToBytes32(9876543210987654321);
      await ctx.perpetual.testing.lib.store(testSlot, value);
      expectBN(await ctx.perpetual.testing.lib.load(testSlot)).to.equal(value);
    });
  });

  describe('TypedSignature', () => {
    const hash = keccak256('test_string_to_sign');

    // TODO: Fix.
    // AssertionError: expected '0x3789cc7cb32ab2b0b4dfffb54c953a3f100d7617' to equal
    //   '0x22d491bde2303f2f43325b2108d26f1eaba1e32b'
    xit('recover() no prepend', async () => {
      const rawSignature = await ctx.perpetual.web3.eth.sign(hash, otherAccount);
      const signature = createTypedSignature(rawSignature, SIGNATURE_TYPES.NO_PREPEND);
      const signatureData = signature + '0'.repeat(60);
      expectAddressesEqual(
        await ctx.perpetual.testing.lib.recover(hash, signatureData),
        otherAccount,
      );
    });

    it('recover() decimal', async () => {
      const rawSignature = await ctx.perpetual.web3.eth.sign(hash, otherAccount);
      const signature = createTypedSignature(rawSignature, SIGNATURE_TYPES.DECIMAL);
      const signatureData = signature + '0'.repeat(60);
      expectAddressesEqual(
        await ctx.perpetual.testing.lib.recover(hash, signatureData),
        otherAccount,
      );
    });

    // TODO: Fix.
    // AssertionError: expected '0x984ea63e802ae814630c300991a7ac6587b57878' to equal
    //   '0x22d491bde2303f2f43325b2108d26f1eaba1e32b'
    xit('recover() hexadecimal', async () => {
      const rawSignature = await ctx.perpetual.web3.eth.sign(hash, otherAccount);
      const signature = createTypedSignature(rawSignature, SIGNATURE_TYPES.HEXADECIMAL);
      const signatureData = signature + '0'.repeat(60);
      expectAddressesEqual(
        await ctx.perpetual.testing.lib.recover(hash, signatureData),
        otherAccount,
      );
    });
  });
});
