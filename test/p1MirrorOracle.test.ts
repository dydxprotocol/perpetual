import BigNumber from 'bignumber.js';
import _ from 'lodash';
import Web3 from 'web3';

import {
  BigNumberable,
  MakerOracleMessage,
  Price,
  address,
} from '../src/lib/types';
import { MirrorOracle } from '../src/modules/MirrorOracle';
import {
  expect,
  expectAddressesEqual,
  expectBaseValueEqual,
  expectBN,
  expectThrow,
} from './helpers/Expect';
import initializePerpetual from './helpers/initializePerpetual';
import { ITestContext, perpetualDescribe } from './helpers/perpetualDescribe';
import { fixRawSignature } from '../src/lib/SignatureHelper';
import { mineAvgBlock } from './helpers/EVM';
import { ADDRESSES } from '../src/lib/Constants';

// Identifier for the Maker oracle, used in the signed messages.
const ORACLE_WAT = 'ETHUSD';

let oracle: MirrorOracle;

// Accounts.
let admin: address;
let reader: address;
let otherAddress: address;
let signers: address[];

async function init(ctx: ITestContext): Promise<void> {
  // Accounts.
  admin = ctx.accounts[0];
  reader = ctx.accounts[2];
  otherAddress = ctx.accounts[3];
  signers = ctx.accounts.slice(4, 9);

  // Module for interacting with the mirror oracle.
  oracle = new MirrorOracle(ctx.perpetual.contracts, ctx.perpetual.web3);

  // Configure the perpetual to use the mirror oracle, by way of P1MakerOracle.
  await Promise.all([
    initializePerpetual(
      ctx,
      { oracle: ctx.perpetual.contracts.p1MakerOracle.options.address },
    ),
    ctx.perpetual.makerPriceOracle.setRoute(
      ctx.perpetual.contracts.perpetualProxy.options.address,
      ctx.perpetual.contracts.p1MirrorOracle.options.address,
      { from: admin },
    ),
    oracle.kiss(reader, { from: admin }),
  ]);
}

perpetualDescribe('P1MirrorOracle', init, (ctx: ITestContext) => {

  describe('peek()', () => {

    it('reads the oracle price', async () => {
      // Set the oracle price.
      await oracle.syncBar();
      await ctx.perpetual.testing.makerOracle.lift([signers[0]]);
      await oracle.lift([signers[0]]);
      await poke([signers[0]], [125]);

      const [price, isValid] = await oracle.peek({ from: reader });
      expect(isValid).to.be.true;
      expectBN(price).to.equal(new Price(125).toSolidity());
    });

    it('succeeds when price has not been set', async () => {
      const [price, isValid] = await oracle.peek({ from: reader });
      expect(isValid).to.be.false;
      expectBN(price).to.equal(0);
    });

    it('fails if sender is not an authorized reader', async () => {
      await expectThrow(
        oracle.peek({ from: otherAddress }),
        'P1MirrorOracle#peek: Sender not authorized to get price',
      );
    });
  });

  describe('read()', () => {

    it('reads the oracle price', async () => {
      // Set the oracle price.
      await oracle.syncBar();
      await ctx.perpetual.testing.makerOracle.lift([signers[0]]);
      await oracle.lift([signers[0]]);
      await poke([signers[0]], [125]);

      // Read the mirror oracle, by way of the perpetual contract.
      const price = await ctx.perpetual.priceOracle.getPrice();
      expectBaseValueEqual(price, new Price(125));
    });

    it('fails if price has not been set', async () => {
      // Read the mirror oracle, by way of the perpetual contract.
      await expectThrow(
        ctx.perpetual.priceOracle.getPrice(),
        'P1MirrorOracle#read: Price is zero',
      );
    });

    it('fails if sender is not an authorized reader', async () => {
      await expectThrow(
        oracle.getValue({ from: otherAddress }),
        'P1MirrorOracle#read: Sender not authorized to get price',
      );
    });
  });

  describe('checkSynced()', () => {

    beforeEach(async () => {
      // Sync bar.
      await oracle.syncBar();
    });

    it('returns all zero when synced, without any signers', async () => {
      const { signersToAdd, signersToRemove, barNeedsUpdate } = await oracle.checkSyncedDetailed();
      expect(signersToAdd.length).to.equal(0);
      expect(signersToRemove.length).to.equal(0);
      expect(barNeedsUpdate).to.be.false;
    });

    it('returns all zero when synced, with signers', async () => {
      // Add signers to both oracles.
      await ctx.perpetual.testing.makerOracle.lift(signers);
      await oracle.lift(signers);

      // Call the function.
      const { signersToAdd, signersToRemove, barNeedsUpdate } = await oracle.checkSyncedDetailed();
      expect(signersToAdd.length).to.equal(0);
      expect(signersToRemove.length).to.equal(0);
      expect(barNeedsUpdate).to.be.false;
    });

    it('detects if the value of `bar` is out of sync', async () => {
      // Update the value of `bar` on the underlying oracle.
      await ctx.perpetual.testing.makerOracle.setBar(11);

      // Call the function.
      const { signersToAdd, signersToRemove, barNeedsUpdate } = await oracle.checkSyncedDetailed();
      expect(signersToAdd.length).to.equal(0);
      expect(signersToRemove.length).to.equal(0);
      expect(barNeedsUpdate).to.be.true;
    });

    it('detects if there are signers to be added', async () => {
      // Add signers to the underlying oracle.
      await ctx.perpetual.testing.makerOracle.lift(signers);

      // Call the function.
      const { signersToAdd, signersToRemove, barNeedsUpdate } = await oracle.checkSyncedDetailed();
      expect(_.sortBy(signersToAdd)).to.deep.equal(_.sortBy(signers));
      expect(signersToRemove.length).to.equal(0);
      expect(barNeedsUpdate).to.be.false;
    });

    it('detects if there are signers to be removed', async () => {
      // Add signers to the oracle that aren't on the underlying oracle.
      await ctx.perpetual.testing.makerOracle.lift(signers);
      await oracle.lift(signers);
      await ctx.perpetual.testing.makerOracle.drop(signers);

      // Call the function.
      const { signersToAdd, signersToRemove, barNeedsUpdate } = await oracle.checkSyncedDetailed();
      expect(signersToAdd.length).to.equal(0);
      expect(_.sortBy(signersToRemove)).to.deep.equal(_.sortBy(signers));
      expect(barNeedsUpdate).to.be.false;
    });

    it('detects if a signer has changed to another signer with the same first byte', async () => {
      // Create a new signer address with the same first byte.
      const newSigner = (
        `${signers[0].slice(0, 4)}00000000000000000000000000000000000000`.toLowerCase()
      );

      await ctx.perpetual.testing.makerOracle.lift([signers[0]]);
      await oracle.lift([signers[0]]);
      // Use lowercase to avoid address checksum failure.
      await ctx.perpetual.testing.makerOracle.lift([newSigner]);

      // Call the function.
      const { signersToAdd, signersToRemove, barNeedsUpdate } = await oracle.checkSyncedDetailed();
      expect(signersToAdd.length).to.equal(1);
      expect(signersToRemove.length).to.equal(1);
      expectAddressesEqual(signersToAdd[0], newSigner);
      expectAddressesEqual(signersToRemove[0], signers[0]);
      expect(barNeedsUpdate).to.be.false;
    });
  });

  describe('poke()', () => {

    beforeEach(async () => {
      // Require 5 signed messages.
      await ctx.perpetual.testing.makerOracle.setBar(5);
      await oracle.syncBar();

      // Add signers.
      await ctx.perpetual.testing.makerOracle.lift(signers);
      await oracle.lift(signers);
    });

    it('updates the oracle price and age', async () => {
      const prices = _.range(101.5, 151.5, 10);
      await poke(signers, prices);
    });

    it('allows multiple updates, from different combinations of signers', async () => {
      // Require 3 signed messages.
      await ctx.perpetual.testing.makerOracle.setBar(3);
      await oracle.syncBar();

      // Call the function with different groups of signers.
      await poke(signers.slice(0, 3), [111, 121, 131]);
      await poke(signers.slice(1, 4), [121, 131, 141]);
      await poke(signers.slice(2, 5), [101, 111, 121]);
    });

    it('succeeds when every message contains the same price', async () => {
      const prices = _.times(5, _.constant('121.5'));
      await poke(signers, prices);
    });

    it('fails if there are too few messages', async () => {
      const prices = _.range(101.5, 141.5, 10);
      await expectThrow(
        poke(signers.slice(0, 4), prices),
        'P1MirrorOracle#poke: Wrong number of messages',
      );
    });

    it('fails if there are too many messages', async () => {
      // Require 3 signed messages.
      await ctx.perpetual.testing.makerOracle.setBar(3);
      await oracle.syncBar();

      const prices = _.range(101.5, 141.5, 10);
      await expectThrow(
        poke(signers.slice(0, 4), prices),
        'P1MirrorOracle#poke: Wrong number of messages',
      );
    });

    it('fails if a signature is invalid', async () => {
      // Use a timestamp that will be after the current block.
      const latestBlock = await ctx.perpetual.web3.eth.getBlock('latest');
      const timestamp = Number(latestBlock.timestamp) + 1000;

      // Create signed messages.
      const prices = _.range(101.5, 151.5, 10);
      const messages = await Promise.all(_.zip(prices, signers).map(([price, signer]) => {
        return makeMakerOracleMessage(new Price(price), timestamp, signer);
      }));

      // Make one of the the signatures invalid.
      messages[3].signature = `0x${messages[3].signature.slice(3)}0`;

      // Call the smart contract function.
      await expectThrow(
        oracle.poke(messages),
        'P1MirrorOracle#poke: Invalid signer',
      );
    });

    it('fails if a signer is not authorized', async () => {
      // Unauthorize one of the signers.
      await ctx.perpetual.testing.makerOracle.drop([signers[3]]);
      await oracle.drop([signers[3]]);

      const prices = _.range(101.5, 151.5, 10);
      await expectThrow(
        poke(signers, prices),
        'P1MirrorOracle#poke: Invalid signer',
      );
    });

    it('fails if a message has the same age as the last oracle update', async () => {
      const prices = _.range(101.5, 151.5, 10);
      await poke(signers, prices);
      const age = await oracle.getAge();
      await expectThrow(
        poke(signers, prices, age.toNumber()),
        'P1MirrorOracle#poke: Stale message',
      );
    });

    it('fails if a message is older than the last oracle update', async () => {
      const prices = _.range(101.5, 151.5, 10);
      await poke(signers, prices);
      const age = await oracle.getAge();
      await expectThrow(
        poke(signers, prices, age.toNumber() - 1000),
        'P1MirrorOracle#poke: Stale message',
      );
    });

    it('fails if the messages are not sorted by value', async () => {
      const prices = _.range(101.5, 151.5, 10).reverse();
      await expectThrow(
        poke(signers, prices),
        'P1MirrorOracle#poke: Message out of order',
      );
    });

    it('fails if two messages have the same signer', async () => {
      const prices = _.range(101.5, 151.5, 10);
      await expectThrow(
        poke([...signers.slice(0, 4), signers[0]], prices),
        'P1MirrorOracle#poke: Duplicate signer',
      );
    });
  });

  describe('lift()', () => {

    beforeEach(async () => {
      await ctx.perpetual.testing.makerOracle.lift(signers);
    });

    it('adds signers to the list of signers', async () => {
      // Call the function and check the contract state.
      let txResult = await oracle.lift([signers[0]]);
      expect(await oracle.getOrcl(signers[0])).to.be.true;
      expect(await oracle.getSlot(Number.parseInt(signers[0].slice(2, 4), 16))).to.equal(
        signers[0],
      );

      // Check logs.
      let logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogSetSigner');
      expect(logs[0].args.signer).to.equal(signers[0]);
      expect(logs[0].args.authorized).to.equal(true);

      // Call the function and check the contract state.
      txResult = await oracle.lift([signers[1], signers[2]]);
      expect(await oracle.getOrcl(signers[1])).to.be.true;
      expect(await oracle.getSlot(Number.parseInt(signers[1].slice(2, 4), 16))).to.equal(
        signers[1],
      );
      expect(await oracle.getOrcl(signers[2])).to.be.true;
      expect(await oracle.getSlot(Number.parseInt(signers[2].slice(2, 4), 16))).to.equal(
        signers[2],
      );

      // Check logs.
      logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(2);
      expect(logs[0].name).to.equal('LogSetSigner');
      expect(logs[0].args.signer).to.equal(signers[1]);
      expect(logs[0].args.authorized).to.equal(true);
      expect(logs[1].name).to.equal('LogSetSigner');
      expect(logs[1].args.signer).to.equal(signers[2]);
      expect(logs[1].args.authorized).to.equal(true);
    });

    it('fails if the signer is already currently authorized', async () => {
      await oracle.lift([signers[2]]);
      await expectThrow(
        oracle.lift([signers[1], signers[2]]),
        'P1MirrorOracle#lift: Signer already authorized',
      );
    });

    it('fails if a different signer with the same first byte is already authorized', async () => {
      // Create a new signer address with the same first byte.
      const newSigner = (
        `${signers[2].slice(0, 4)}00000000000000000000000000000000000000`.toLowerCase()
      );

      // Authorize it on the underlying oracle.
      await ctx.perpetual.testing.makerOracle.drop([signers[2]]);
      // Use lowercase to avoid address checksum failure.
      await ctx.perpetual.testing.makerOracle.lift([newSigner]);

      await oracle.lift([newSigner]);
      await expectThrow(
        oracle.lift([newSigner]),
        'P1MirrorOracle#lift: Signer already authorized',
      );
    });

    it('fails if the signer is not authorized on the underlying', async () => {
      await ctx.perpetual.testing.makerOracle.drop([signers[2]]);
      await expectThrow(
        oracle.lift([signers[2]]),
        'P1MirrorOracle#lift: Signer not authorized on underlying oracle',
      );
    });
  });

  describe('drop()', () => {

    beforeEach(async () => {
      await ctx.perpetual.testing.makerOracle.lift(signers);
      await oracle.lift(signers.slice(0, 3));
      await ctx.perpetual.testing.makerOracle.drop(signers.slice(0, 4));
    });

    it('removes signers from the list of signers', async () => {
      // Call the function.
      let txResult = await oracle.drop([signers[0]]);
      expect(await oracle.getOrcl(signers[0])).to.be.false;
      expect(await oracle.getSlot(Number.parseInt(signers[0].slice(2, 4), 16))).to.equal(
        ADDRESSES.ZERO,
      );

      // Check logs.
      let logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogSetSigner');
      expect(logs[0].args.signer).to.equal(signers[0]);
      expect(logs[0].args.authorized).to.equal(false);

      // Call the function.
      txResult = await oracle.drop([signers[1], signers[2]]);
      expect(await oracle.getOrcl(signers[1])).to.be.false;
      expect(await oracle.getSlot(Number.parseInt(signers[1].slice(2, 4), 16))).to.equal(
        ADDRESSES.ZERO,
      );
      expect(await oracle.getOrcl(signers[2])).to.be.false;
      expect(await oracle.getSlot(Number.parseInt(signers[2].slice(2, 4), 16))).to.equal(
        ADDRESSES.ZERO,
      );

      // Check logs.
      logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(2);
      expect(logs[0].name).to.equal('LogSetSigner');
      expect(logs[0].args.signer).to.equal(signers[1]);
      expect(logs[0].args.authorized).to.equal(false);
      expect(logs[1].name).to.equal('LogSetSigner');
      expect(logs[1].args.signer).to.equal(signers[2]);
      expect(logs[1].args.authorized).to.equal(false);
    });

    it('fails if the signer is not currently authorized', async () => {
      await oracle.drop([signers[2]]);

      // Both orcl and slot checks will fail.
      await expectThrow(
        oracle.drop([signers[1], signers[2]]),
        'P1MirrorOracle#drop: Signer is already not authorized',
      );
    });

    it('fails to drop invalid signer even if the first byte matches a valid signer', async () => {
      // Create a new signer address with the same first byte.
      const newSigner = (
        `${signers[2].slice(0, 4)}00000000000000000000000000000000000000`.toLowerCase()
      );

      // The orcl check will fail, but not the slot check.
      await expectThrow(
        // Use lowercase to avoid address checksum failure.
        oracle.drop([newSigner]),
        'P1MirrorOracle#drop: Signer is already not authorized',
      );
    });

    it('fails if the signer is authorized on the underlying', async () => {
      await ctx.perpetual.testing.makerOracle.lift([signers[2]]);
      await expectThrow(
        oracle.drop([signers[2]]),
        'P1MirrorOracle#drop: Signer is authorized on underlying oracle',
      );
    });
  });

  describe('setBar()', () => {

    it('sets the required number of signers to that of the underlying oracle', async () => {
      // Check initial value of bar.
      expectBN(await oracle.getBar()).to.equal(0);

      // Call the function, and also prepare a new bar on the underlying oracle.
      let txResult = await oracle.syncBar();
      await ctx.perpetual.testing.makerOracle.setBar(11);

      // Check the log and the value of bar.
      let logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogSetBar');
      expectBN(logs[0].args.bar).to.equal(1);
      expectBN(await oracle.getBar()).to.equal(1);

      // Call the function.
      txResult = await oracle.syncBar();

      // Check the log and the value of bar.
      logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogSetBar');
      expectBN(logs[0].args.bar).to.equal(11);
      expectBN(await oracle.getBar()).to.equal(11);
    });
  });

  describe('kiss()', () => {

    beforeEach(async () => {
      // Set the oracle price.
      await oracle.syncBar();
      await ctx.perpetual.testing.makerOracle.lift([signers[0]]);
      await oracle.lift([signers[0]]);
      await poke([signers[0]], [125]);
    });

    it('authorizes an address to read the oracle price', async () => {
      // Call the function and check the value of getter.
      const txResult = await oracle.kiss(otherAddress, { from: admin });
      expect(await oracle.getBud(otherAddress)).to.be.true;

      // Check that the address can read the price.
      const [peekedPrice] = await oracle.peek({ from: otherAddress });
      expectBN(peekedPrice, new Price(125).toSolidity());
      const readPrice = await oracle.getValue({ from: otherAddress });
      expectBN(readPrice, new Price(125).toSolidity());

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogSetReader');
      expect(logs[0].args.reader).to.equal(otherAddress);
      expect(logs[0].args.authorized).to.equal(true);
    });

    it('authorizes multiple addresses to read the oracle price', async () => {
      const readers = [admin, reader, otherAddress, signers[0]];

      // Call the function.
      const txResult = await oracle.kiss(readers, { from: admin });
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(readers.length);

      await Promise.all(readers.map(async (someAddress: address, i: number) => {
        // Check the value of getter.
        expect(await oracle.getBud(someAddress)).to.be.true;

        // Check that the address can read the price.
        const [peekedPrice] = await oracle.peek({ from: someAddress });
        expectBN(peekedPrice, new Price(125).toSolidity());
        const readPrice = await oracle.getValue({ from: someAddress });
        expectBN(readPrice, new Price(125).toSolidity());

        // Check log.
        expect(logs[i].name).to.equal('LogSetReader');
        expect(logs[i].args.reader).to.equal(someAddress);
        expect(logs[i].args.authorized).to.equal(true);
      }));
    });

    it('fails if the caller is not the owner', async () => {
      await expectThrow(
        oracle.kiss(otherAddress),
        'Ownable: caller is not the owner',
      );
    });
  });

  describe('diss()', () => {

    it('unauthorizes an address, disallowing it to read the price', async () => {
      // Call the function and check the value of getter.
      const txResult = await oracle.diss(reader, { from: admin });
      expect(await oracle.getBud(reader)).to.be.false;

      // Check that the address cannot read the price.
      await expectThrow(
        oracle.peek({ from: reader }),
        'P1MirrorOracle#peek: Sender not authorized to get price',
      );
      await expectThrow(
        oracle.getValue({ from: reader }),
        'P1MirrorOracle#read: Sender not authorized to get price',
      );

      // Check logs.
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(1);
      expect(logs[0].name).to.equal('LogSetReader');
      expect(logs[0].args.reader).to.equal(reader);
      expect(logs[0].args.authorized).to.equal(false);
    });

    it('unauthorizes multiple addresses, disallowing them to read the oracle price', async () => {
      // Start by authorizing all the readers.
      const readers = [admin, reader, otherAddress, signers[0]];
      await oracle.kiss(readers, { from: admin });

      // Call the function.
      const txResult = await oracle.diss(readers, { from: admin });
      const logs = ctx.perpetual.logs.parseLogs(txResult);
      expect(logs.length).to.equal(readers.length);

      await Promise.all(readers.map(async (someAddress: address, i: number) => {
        // Check the value of getter.
        expect(await oracle.getBud(someAddress)).to.be.false;

        // Check that the address cannot read the price.
        await expectThrow(
          oracle.peek({ from: someAddress }),
          'P1MirrorOracle#peek: Sender not authorized to get price',
        );
        await expectThrow(
          oracle.getValue({ from: someAddress }),
          'P1MirrorOracle#read: Sender not authorized to get price',
        );

        // Check log.
        expect(logs[i].name).to.equal('LogSetReader');
        expect(logs[i].args.reader).to.equal(someAddress);
        expect(logs[i].args.authorized).to.equal(false);
      }));
    });

    it('fails if the caller is not the owner', async () => {
      await expectThrow(
        oracle.diss(reader),
        'Ownable: caller is not the owner',
      );
    });
  });

  /**
   * Helper function for making oracle messages and checking that price and age are set as expected.
   */
  async function poke(
    signers: address[],
    prices: BigNumberable[],
    timestamp: number | null = null,
  ): Promise<void> {
    const lastBlock = await ctx.perpetual.web3.eth.getBlock('latest');
    await mineAvgBlock();
    const lastBlockTimestamp = Number(lastBlock.timestamp);

    // By default, have the messages use a timestamp that will be after the current block.
    const messageTimestamp = timestamp || (lastBlockTimestamp + 1000);

    // Create signed messages.
    // Assume prices are sorted and the length of the array is odd.
    const expectedMedian = new Price(prices[Math.floor(prices.length / 2)]);
    const messages = await Promise.all(_.zip(prices, signers).map(([price, signer]) => {
      return makeMakerOracleMessage(new Price(price), messageTimestamp, signer);
    }));

    // Call the smart contract function.
    const txResult = await oracle.poke(messages);

    // Check value and age.
    const price = await oracle.getPrice({ from: reader });
    expectBaseValueEqual(price, expectedMedian);
    const age = await oracle.getAge();
    expectBN(age).to.gt(lastBlockTimestamp);
    expectBN(age).to.lt(messageTimestamp);
    const { age: privateAge, price: privatePrice } = await oracle.getPrivatePrice();
    expectBN(privateAge).to.equal(age);
    expectBaseValueEqual(privatePrice, price);

    // Check logs.
    const logs = await ctx.perpetual.logs.parseLogs(txResult);
    expect(logs.length).to.equal(1);
    expect(logs[0].name).to.equal('LogMedianPrice');
    expectBN(logs[0].args.val).to.equal(expectedMedian.toSolidity());
    expectBN(logs[0].args.age).to.gt(lastBlockTimestamp);
    expectBN(logs[0].args.age).to.lt(messageTimestamp);
  }

  async function makeMakerOracleMessage(
    price: Price,
    timestampSeconds: BigNumberable,
    signer: address,
  ): Promise<MakerOracleMessage> {
    const timestamp = new BigNumber(timestampSeconds);
    const message = Web3.utils.soliditySha3(
      { t: 'uint256', v: price.toSolidity() },
      { t: 'uint256', v: timestamp.toFixed(0) },
      { t: 'bytes32', v: `0x${Buffer.from(ORACLE_WAT).toString('hex').padEnd(64, '0')}` },
    );
    const signature = await ctx.perpetual.web3.eth.sign(message, signer);
    return {
      price,
      timestamp,
      signature: fixRawSignature(signature),
    };
  }
});
