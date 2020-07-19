import BigNumber from 'bignumber.js';
import _ from 'lodash';

import { expectThrow, expect, expectBN, expectAssertFailure } from './helpers/Expect';
import initializePerpetual from './helpers/initializePerpetual';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { ADDRESSES, INTEGERS } from '../src/lib/Constants';
import {
  address,
  SoloBridgeTransfer,
  TxResult,
  SigningMethod,
  SignedSoloBridgeTransfer,
  SoloBridgeTransferMode,
} from '../src/lib/types';
import {
  expectTokenBalances,
  expectMarginBalances,
  mintAndDeposit,
} from './helpers/balances';

const SOLO_USDC_MARKET = 2;

// Test parameters.
const futureTimestamp = Math.floor(Date.now() / 1000) + 15 * 60;
const pastTimestamp = Math.floor(Date.now() / 1000) - 15 * 60;
const amount = new BigNumber(1e18);
const soloAccountNumber = 5;
const defaultTransferToPerpetual: SoloBridgeTransfer = {
  soloAccountNumber,
  amount,
  soloMarketId: SOLO_USDC_MARKET,
  account: ADDRESSES.ZERO, // Set later
  perpetual: ADDRESSES.ZERO, // Set later
  transferMode: SoloBridgeTransferMode.SOME_TO_PERPETUAL,
  salt: INTEGERS.ONES_255,
  expiration: futureTimestamp,
};
let defaultTransferToSolo: SoloBridgeTransfer; // Set later
let defaultTransferToPerpetualSigned: SignedSoloBridgeTransfer;
let defaultTransferToSoloSigned: SignedSoloBridgeTransfer;

// Accounts and addresses.
let admin: address;
let account: address;
let otherAddress: address;
let perpetualAddress: address;
let soloAddress: address;
let proxyAddress: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializePerpetual(ctx);

  // Accounts and addresses.
  admin = ctx.accounts[0];
  account = ctx.accounts[2];
  otherAddress = ctx.accounts[3];
  perpetualAddress = ctx.perpetual.contracts.perpetualProxy.options.address;
  soloAddress = ctx.perpetual.testing.solo.address;
  proxyAddress = ctx.perpetual.soloBridgeProxy.address;

  // Initialize test parameters.
  defaultTransferToPerpetual.account = account;
  defaultTransferToPerpetual.perpetual = perpetualAddress;
  defaultTransferToSolo = {
    ...defaultTransferToPerpetual,
    transferMode: SoloBridgeTransferMode.SOME_TO_SOLO,
  };
  defaultTransferToPerpetualSigned = await ctx.perpetual.soloBridgeProxy.getSignedTransfer(
    defaultTransferToPerpetual,
    SigningMethod.Hash,
  );
  defaultTransferToSoloSigned = await ctx.perpetual.soloBridgeProxy.getSignedTransfer(
    defaultTransferToSolo,
    SigningMethod.Hash,
  );

  // Set test data on mock Solo contract.
  await ctx.perpetual.testing.solo.setTokenAddress(
    SOLO_USDC_MARKET,
    ctx.perpetual.contracts.testToken.options.address,
  );

  // Set allowance on Solo and Perpetual for the proxy.
  await Promise.all([
    ctx.perpetual.soloBridgeProxy.approveMaximumOnSolo(SOLO_USDC_MARKET),
    ctx.perpetual.soloBridgeProxy.approveMaximumOnPerpetual(),
  ]);

  // Check initial balances.
  await expectTokenBalances(
    ctx,
    [account, perpetualAddress, soloAddress, proxyAddress],
    [0, 0, 0, 0],
  );
}

perpetualDescribe('P1SoloBridgeProxy', init, (ctx: ITestContext) => {

  describe('off-chain helpers', () => {

    it('Signs correctly for hash', async () => {
      const signedTransfer = await ctx.perpetual.soloBridgeProxy.getSignedTransfer(
        defaultTransferToPerpetual,
        SigningMethod.Hash,
      );
      const isValid = ctx.perpetual.soloBridgeProxy.transferHasValidSignature(signedTransfer);
      expect(isValid).to.be.true;
    });

    it('Signs correctly for typed data', async () => {
      const signedTransfer = await ctx.perpetual.soloBridgeProxy.getSignedTransfer(
        defaultTransferToPerpetual,
        SigningMethod.TypedData,
      );
      const isValid = ctx.perpetual.soloBridgeProxy.transferHasValidSignature(signedTransfer);
      expect(isValid).to.be.true;
    });

    it('Recognizes invalid signatures', () => {
      const badSignatures = [
        `0x${'00'.repeat(63)}00`,
        `0x${'ab'.repeat(63)}01`,
        `0x${'01'.repeat(70)}01`,
      ];
      badSignatures.map((typedSignature) => {
        const isValid = ctx.perpetual.soloBridgeProxy.transferHasValidSignature({
          ...defaultTransferToPerpetual,
          typedSignature,
        });
        expect(isValid).to.be.false;
      });
    });
  });

  describe('bridgeTransfer()', () => {

    describe('transfer (Solo -> Perpetual)', async () => {

      beforeEach(async () => {
        // Give the test Solo contract tokens for withdrawal.
        await ctx.perpetual.testing.token.mint(
          ctx.perpetual.contracts.testToken.options.address,
          soloAddress,
          amount,
        );
      });

      describe('with signature', async () => {

        it('succeeds', async () => {
          // Call the function.
          const txResult = await ctx.perpetual.soloBridgeProxy.bridgeTransfer(
            defaultTransferToPerpetualSigned,
          );

          // Check logs.
          checkLogs(txResult, defaultTransferToPerpetual);

          // Check balances.
          await expectTokenBalances(
            ctx,
            [account, perpetualAddress, soloAddress, proxyAddress],
            [0, amount, 0, 0],
          );
          await expectMarginBalances(ctx, txResult, [account], [amount]);
        });

        it('succeeds in transfer-all mode', async () => {
          // Give some extra tokens to the proxy contract. These should be ignored by the transfer.
          await ctx.perpetual.testing.token.mint(
            ctx.perpetual.contracts.testToken.options.address,
            proxyAddress,
            12345,
          );

          // Create a transfer using transfer-all mode.
          const transfer = await getModifiedTransferToPerpetual({
            transferMode: SoloBridgeTransferMode.ALL_TO_PERPETUAL,
            amount: 999, // Amount is ignored in transfer-all mode.
          });

          // Call the function.
          const txResult = await ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer);

          // Check logs.
          // Compare against the original transfer object with the amount specified.
          checkLogs(txResult, defaultTransferToPerpetual);

          // Check balances.
          await expectTokenBalances(
            ctx,
            [account, perpetualAddress, soloAddress, proxyAddress],
            [0, amount, 0, 12345],
          );
          await expectMarginBalances(ctx, txResult, [account], [amount]);
        });

        it('succeeds with default salt and expiration', async () => {
          // Defaults to expiration of zero, indicating no expiration.
          const transfer = await getModifiedTransferToPerpetual({
            expiration: undefined,
            salt: undefined,
          });

          // Call the function.
          const txResult = await ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer);

          // Check logs.
          checkLogs(txResult, defaultTransferToPerpetual);

          // Check balances.
          await expectTokenBalances(
            ctx,
            [account, perpetualAddress, soloAddress, proxyAddress],
            [0, amount, 0, 0],
          );
          await expectMarginBalances(ctx, txResult, [account], [amount]);
        });

        it('fails if the transfer amount is greater than the available balance', async () => {
          // Set up mock data.
          const transfer = await getModifiedTransferToPerpetual({ amount: amount.plus(1) });

          // Call the function.
          await expectThrow(
            ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer),
            'ERC20: transfer amount exceeds balance',
          );
        });

        it('fails if the Solo and Perpetual tokens do not match', async () => {
          // Set up mock data.
          const transfer = await getModifiedTransferToPerpetual(
            { soloMarketId: SOLO_USDC_MARKET + 1 },
          );

          // Call the function.
          await expectThrow(
            ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer),
            'Solo and Perpetual assets are not the same',
          );
        });

        it('fails if the transfer has expired', async () => {
          const transfer = await getModifiedTransferToPerpetual({ expiration: pastTimestamp });
          await expectThrow(
            ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer),
            'Signature has expired',
          );
        });

        it('fails if the signature was already used', async () => {
          const transfer = await getModifiedTransferToPerpetual({ amount: amount.div(2) });
          await ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer);
          await expectThrow(
            ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer),
            'Signature was already used or invalidated',
          );
        });

        it('fails if the signature was invalidated', async () => {
          await ctx.perpetual.soloBridgeProxy.invalidateSignature(
            defaultTransferToPerpetual,
            { from: account },
          );
          await expectThrow(
            ctx.perpetual.soloBridgeProxy.bridgeTransfer(defaultTransferToPerpetualSigned),
            'Signature was already used or invalidated',
          );
        });
      });

      describe('without signature', async () => {

        it('succeeds regardless of expiration, invalidation, or previous execution', async () => {
          const transfer = await getModifiedTransferToPerpetual({
            amount: amount.div(2),
            expiration: pastTimestamp,
          });
          await ctx.perpetual.soloBridgeProxy.invalidateSignature(transfer, { from: account });
          await ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer, { from: account });
          const txResult = await ctx.perpetual.soloBridgeProxy.bridgeTransfer(
            transfer,
            { from: account },
          );

          // Check balances.
          await expectTokenBalances(
            ctx,
            [account, perpetualAddress, soloAddress, proxyAddress],
            [0, amount, 0, 0],
          );
          await expectMarginBalances(ctx, txResult, [account], [amount]);
        });

        it('succeeds for account owner', async () => {
          // Call the function.
          const txResult = await ctx.perpetual.soloBridgeProxy.bridgeTransfer(
            defaultTransferToPerpetual,
            { from: account },
          );

          // Check logs.
          checkLogs(txResult, defaultTransferToPerpetual);

          // Check balances.
          await expectTokenBalances(
            ctx,
            [account, perpetualAddress, soloAddress, proxyAddress],
            [0, amount, 0, 0],
          );
          await expectMarginBalances(ctx, txResult, [account], [amount]);
        });

        it('succeeds for Solo local operator', async () => {
          // Set up.
          await ctx.perpetual.testing.solo.setIsLocalOperator(account, otherAddress, true);

          // Call the function.
          const txResult = await ctx.perpetual.soloBridgeProxy.bridgeTransfer(
            defaultTransferToPerpetual,
            { from: otherAddress },
          );

          // Check logs.
          checkLogs(txResult, defaultTransferToPerpetual);

          // Check balances.
          await expectTokenBalances(
            ctx,
            [account, perpetualAddress, soloAddress, proxyAddress],
            [0, amount, 0, 0],
          );
          await expectMarginBalances(ctx, txResult, [account], [amount]);
        });

        it('succeeds for Solo global operator', async () => {
          // Set up.
          await ctx.perpetual.testing.solo.setIsGlobalOperator(otherAddress, true);

          // Call the function.
          const txResult = await ctx.perpetual.soloBridgeProxy.bridgeTransfer(
            defaultTransferToPerpetual,
            { from: otherAddress },
          );

          // Check logs.
          checkLogs(txResult, defaultTransferToPerpetual);

          // Check balances.
          await expectTokenBalances(
            ctx,
            [account, perpetualAddress, soloAddress, proxyAddress],
            [0, amount, 0, 0],
          );
          await expectMarginBalances(ctx, txResult, [account], [amount]);
        });

        it('fails for non-owner non-operator account', async () => {
          await expectThrow(
            ctx.perpetual.soloBridgeProxy.bridgeTransfer(
              defaultTransferToPerpetual,
              { from: otherAddress },
            ),
            'Sender does not have account permissions and signature is invalid',
          );
        });

        it('fails for Perpetual local operator', async () => {
          // Set up.
          await ctx.perpetual.operator.setLocalOperator(otherAddress, true, { from: account });

          // Call the function.
          await expectThrow(
            ctx.perpetual.soloBridgeProxy.bridgeTransfer(
              defaultTransferToPerpetual,
              { from: otherAddress },
            ),
            'Sender does not have account permissions and signature is invalid',
          );
        });

        it('fails for Perpetual global operator', async () => {
          // Set up.
          await ctx.perpetual.admin.setGlobalOperator(otherAddress, true, { from: admin });

          // Call the function.
          await expectThrow(
            ctx.perpetual.soloBridgeProxy.bridgeTransfer(
              defaultTransferToPerpetual,
              { from: otherAddress },
            ),
            'Sender does not have account permissions and signature is invalid',
          );
        });
      });
    });

    describe('transfer (Perpetual -> Solo)', async () => {

      beforeEach(async () => {
        // Give the account tokens in the Perpetual contract.
        await mintAndDeposit(ctx, account, amount);
      });

      describe('with signature', async () => {

        it('succeeds', async () => {
          const txResult = await ctx.perpetual.soloBridgeProxy.bridgeTransfer(
            defaultTransferToSoloSigned,
          );

          // Check logs.
          checkLogs(txResult, defaultTransferToSolo);

          // Check balances.
          await expectTokenBalances(
            ctx,
            [account, perpetualAddress, soloAddress, proxyAddress],
            [0, 0, amount, 0],
          );
          await expectMarginBalances(ctx, txResult, [account], [0]);
        });

        it('succeeds with default salt and expiration', async () => {
          // Defaults to expiration of zero, indicating no expiration.
          const transfer = await getModifiedTransferToSolo({
            expiration: undefined,
            salt: undefined,
          });

          // Call the function.
          const txResult = await ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer);

          // Check logs.
          checkLogs(txResult, defaultTransferToSolo);

          // Check balances.
          await expectTokenBalances(
            ctx,
            [account, perpetualAddress, soloAddress, proxyAddress],
            [0, 0, amount, 0],
          );
          await expectMarginBalances(ctx, txResult, [account], [0]);
        });

        it('fails if the transfer amount is greater than the available balance', async () => {
          // Set up mock data.
          const transfer = await getModifiedTransferToSolo({ amount: amount.plus(1) });

          // Call the function.
          await expectThrow(
            ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer),
            'SafeERC20: low-level call failed',
          );
        });

        it('fails if the Solo and Perpetual tokens do not match', async () => {
          // Set up mock data.
          const transfer = await getModifiedTransferToSolo(
            { soloMarketId: SOLO_USDC_MARKET + 1 },
          );

          // Call the function.
          await expectThrow(
            ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer),
            'Solo and Perpetual assets are not the same',
          );
        });

        it('fails if the transfer has expired', async () => {
          const transfer = await getModifiedTransferToSolo({ expiration: pastTimestamp });
          await expectThrow(
            ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer),
            'Signature has expired',
          );
        });

        it('fails if the signature was already used', async () => {
          const transfer = await getModifiedTransferToSolo({ amount: amount.div(2) });
          await ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer);
          await expectThrow(
            ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer),
            'Signature was already used or invalidated',
          );
        });

        it('fails if the signature was invalidated', async () => {
          await ctx.perpetual.soloBridgeProxy.invalidateSignature(
            defaultTransferToSolo,
            { from: account },
          );
          await expectThrow(
            ctx.perpetual.soloBridgeProxy.bridgeTransfer(defaultTransferToSoloSigned),
            'Signature was already used or invalidated',
          );
        });
      });

      describe('without signature', async () => {

        it('succeeds regardless of expiration, invalidation, or previous execution', async () => {
          const transfer = await getModifiedTransferToSolo({
            amount: amount.div(2),
            expiration: pastTimestamp,
          });
          await ctx.perpetual.soloBridgeProxy.invalidateSignature(transfer, { from: account });
          await ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer, { from: account });
          const txResult = await ctx.perpetual.soloBridgeProxy.bridgeTransfer(
            transfer,
            { from: account },
          );

          // Check balances.
          await expectTokenBalances(
            ctx,
            [account, perpetualAddress, soloAddress, proxyAddress],
            [0, 0, amount, 0],
          );
          await expectMarginBalances(ctx, txResult, [account], [0]);
        });

        it('succeeds for account owner', async () => {
          // Call the function.
          const txResult = await ctx.perpetual.soloBridgeProxy.bridgeTransfer(
            defaultTransferToSolo,
            { from: account },
          );

          // Check logs.
          checkLogs(txResult, defaultTransferToSolo);

          // Check balances.
          await expectTokenBalances(
            ctx,
            [account, perpetualAddress, soloAddress, proxyAddress],
            [0, 0, amount, 0],
          );
          await expectMarginBalances(ctx, txResult, [account], [0]);
        });

        it('succeeds for Perpetual and Solo local operator', async () => {
          // Set up.
          await ctx.perpetual.operator.setLocalOperator(otherAddress, true, { from: account });
          await ctx.perpetual.testing.solo.setIsLocalOperator(account, otherAddress, true);

          // Call the function.
          const txResult = await ctx.perpetual.soloBridgeProxy.bridgeTransfer(
            defaultTransferToSolo,
            { from: otherAddress },
          );

          // Check logs.
          checkLogs(txResult, defaultTransferToSolo);

          // Check balances.
          await expectTokenBalances(
            ctx,
            [account, perpetualAddress, soloAddress, proxyAddress],
            [0, 0, amount, 0],
          );
          await expectMarginBalances(ctx, txResult, [account], [0]);
        });

        it('succeeds for Perpetual and Solo global operator', async () => {
          // Set up.
          await ctx.perpetual.admin.setGlobalOperator(otherAddress, true, { from: admin });
          await ctx.perpetual.testing.solo.setIsGlobalOperator(otherAddress, true);

          // Call the function.
          const txResult = await ctx.perpetual.soloBridgeProxy.bridgeTransfer(
            defaultTransferToSolo,
            { from: otherAddress },
          );

          // Check logs.
          checkLogs(txResult, defaultTransferToSolo);

          // Check balances.
          await expectTokenBalances(
            ctx,
            [account, perpetualAddress, soloAddress, proxyAddress],
            [0, 0, amount, 0],
          );
          await expectMarginBalances(ctx, txResult, [account], [0]);
        });

        it('fails for non-owner non-operator account', async () => {
          await expectThrow(
            ctx.perpetual.soloBridgeProxy.bridgeTransfer(
              defaultTransferToSolo,
              { from: otherAddress },
            ),
            'Sender does not have account permissions and signature is invalid',
          );
        });

        it('fails for Perpetual local operator', async () => {
          // Set up.
          await ctx.perpetual.operator.setLocalOperator(otherAddress, true, { from: account });

          // Call the function.
          await expectThrow(
            ctx.perpetual.soloBridgeProxy.bridgeTransfer(
              defaultTransferToSolo,
              { from: otherAddress },
            ),
            'Sender does not have account permissions and signature is invalid',
          );
        });

        it('fails for Perpetual global operator', async () => {
          // Set up.
          await ctx.perpetual.admin.setGlobalOperator(otherAddress, true, { from: admin });

          // Call the function.
          await expectThrow(
            ctx.perpetual.soloBridgeProxy.bridgeTransfer(
              defaultTransferToSolo,
              { from: otherAddress },
            ),
            'Sender does not have account permissions and signature is invalid',
          );
        });

        it('fails for Solo local operator', async () => {
          // Set up.
          await ctx.perpetual.testing.solo.setIsLocalOperator(account, otherAddress, true);

          // Call the function.
          await expectThrow(
            ctx.perpetual.soloBridgeProxy.bridgeTransfer(
              defaultTransferToSolo,
              { from: otherAddress },
            ),
            'Sender does not have account permissions and signature is invalid',
          );
        });

        it('fails for Solo global operator', async () => {
          // Set up.
          await ctx.perpetual.testing.solo.setIsGlobalOperator(otherAddress, true);

          // Call the function.
          await expectThrow(
            ctx.perpetual.soloBridgeProxy.bridgeTransfer(
              defaultTransferToSolo,
              { from: otherAddress },
            ),
            'Sender does not have account permissions and signature is invalid',
          );
        });
      });
    });
  });

  describe('invalidateSignature()', () => {

    describe('invalidating a signature (Solo -> Perpetual)', async () => {

      it('succeeds for account owner', async () => {
        // Call the function.
        const txResult = await ctx.perpetual.soloBridgeProxy.invalidateSignature(
          defaultTransferToPerpetual,
          { from: account },
        );

        // Check logs.
        const logs = await ctx.perpetual.logs.parseLogs(txResult);
        expect(logs.length).to.equal(1);
        const log = logs[0];
        expect(log.name).to.equal('LogSignatureInvalidated');
        expect(log.args.account).to.equal(defaultTransferToPerpetual.account);
        expect(log.args.transferHash).to.equal(
          ctx.perpetual.soloBridgeProxy.getTransferHash(defaultTransferToPerpetual),
        );
      });

      it('succeeds for account owner (transfer-all mode)', async () => {
        const transfer = await getModifiedTransferToPerpetual({
          transferMode: SoloBridgeTransferMode.ALL_TO_PERPETUAL,
          amount: 123, // Amount is ignored in transfer-all mode.
        });

        // Call the function.
        const txResult = await ctx.perpetual.soloBridgeProxy.invalidateSignature(
          transfer,
          { from: account },
        );

        // Check logs.
        const logs = await ctx.perpetual.logs.parseLogs(txResult);
        expect(logs.length).to.equal(1);
        const log = logs[0];
        expect(log.name).to.equal('LogSignatureInvalidated');
        expect(log.args.account).to.equal(transfer.account);
        expect(log.args.transferHash).to.equal(
          ctx.perpetual.soloBridgeProxy.getTransferHash(transfer),
        );
      });

      it('succeeds for Solo local operator', async () => {
        // Set up.
        await ctx.perpetual.testing.solo.setIsLocalOperator(account, otherAddress, true);

        // Call the function.
        const txResult = await ctx.perpetual.soloBridgeProxy.invalidateSignature(
          defaultTransferToPerpetual,
          { from: otherAddress },
        );

        // Check logs.
        const logs = await ctx.perpetual.logs.parseLogs(txResult);
        expect(logs.length).to.equal(1);
        const log = logs[0];
        expect(log.name).to.equal('LogSignatureInvalidated');
        expect(log.args.account).to.equal(defaultTransferToPerpetual.account);
        expect(log.args.transferHash).to.equal(
          ctx.perpetual.soloBridgeProxy.getTransferHash(defaultTransferToPerpetual),
        );
      });

      it('succeeds for Solo global operator', async () => {
        // Set up.
        await ctx.perpetual.testing.solo.setIsGlobalOperator(otherAddress, true);

        // Call the function.
        const txResult = await ctx.perpetual.soloBridgeProxy.invalidateSignature(
          defaultTransferToPerpetual,
          { from: otherAddress },
        );

        // Check logs.
        const logs = await ctx.perpetual.logs.parseLogs(txResult);
        expect(logs.length).to.equal(1);
        const log = logs[0];
        expect(log.name).to.equal('LogSignatureInvalidated');
        expect(log.args.account).to.equal(defaultTransferToPerpetual.account);
        expect(log.args.transferHash).to.equal(
          ctx.perpetual.soloBridgeProxy.getTransferHash(defaultTransferToPerpetual),
        );
      });

      it('fails for non-owner non-operator account', async () => {
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.invalidateSignature(
            defaultTransferToPerpetual,
            { from: otherAddress },
          ),
          'Sender does not have permission to invalidate',
        );
      });

      it('fails for Perpetual local operator', async () => {
        // Set up.
        await ctx.perpetual.operator.setLocalOperator(otherAddress, true, { from: account });

        // Call the function.
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.invalidateSignature(
            defaultTransferToPerpetual,
            { from: otherAddress },
          ),
          'Sender does not have permission to invalidate',
        );
      });

      it('fails for Perpetual global operator', async () => {
        // Set up.
        await ctx.perpetual.admin.setGlobalOperator(otherAddress, true, { from: admin });

        // Call the function.
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.invalidateSignature(
            defaultTransferToPerpetual,
            { from: otherAddress },
          ),
          'Sender does not have permission to invalidate',
        );
      });
    });

    describe('invalidating a signature (Perpetual -> Solo)', async () => {

      it('succeeds for account owner', async () => {
        // Call the function.
        const txResult = await ctx.perpetual.soloBridgeProxy.invalidateSignature(
          defaultTransferToSolo,
          { from: account },
        );

        // Check logs.
        const logs = await ctx.perpetual.logs.parseLogs(txResult);
        expect(logs.length).to.equal(1);
        const log = logs[0];
        expect(log.name).to.equal('LogSignatureInvalidated');
        expect(log.args.account).to.equal(defaultTransferToSolo.account);
        expect(log.args.transferHash).to.equal(
          ctx.perpetual.soloBridgeProxy.getTransferHash(defaultTransferToSolo),
        );
      });

      it('succeeds for Perpetual and Solo local operator', async () => {
        // Set up.
        await ctx.perpetual.operator.setLocalOperator(otherAddress, true, { from: account });
        await ctx.perpetual.testing.solo.setIsLocalOperator(account, otherAddress, true);

        // Call the function.
        const txResult = await ctx.perpetual.soloBridgeProxy.invalidateSignature(
          defaultTransferToSolo,
          { from: otherAddress },
        );

        // Check logs.
        const logs = await ctx.perpetual.logs.parseLogs(txResult);
        expect(logs.length).to.equal(1);
        const log = logs[0];
        expect(log.name).to.equal('LogSignatureInvalidated');
        expect(log.args.account).to.equal(defaultTransferToSolo.account);
        expect(log.args.transferHash).to.equal(
          ctx.perpetual.soloBridgeProxy.getTransferHash(defaultTransferToSolo),
        );
      });

      it('succeeds for Perpetual and Solo global operator', async () => {
        // Set up.
        await ctx.perpetual.admin.setGlobalOperator(otherAddress, true, { from: admin });
        await ctx.perpetual.testing.solo.setIsGlobalOperator(otherAddress, true);

        // Call the function.
        const txResult = await ctx.perpetual.soloBridgeProxy.invalidateSignature(
          defaultTransferToSolo,
          { from: otherAddress },
        );

        // Check logs.
        const logs = await ctx.perpetual.logs.parseLogs(txResult);
        expect(logs.length).to.equal(1);
        const log = logs[0];
        expect(log.name).to.equal('LogSignatureInvalidated');
        expect(log.args.account).to.equal(defaultTransferToSolo.account);
        expect(log.args.transferHash).to.equal(
          ctx.perpetual.soloBridgeProxy.getTransferHash(defaultTransferToSolo),
        );
      });

      it('fails for non-owner non-operator account', async () => {
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.invalidateSignature(
            defaultTransferToSolo,
            { from: otherAddress },
          ),
          'Sender does not have permission to invalidate',
        );
      });

      it('fails for Perpetual local operator', async () => {
        // Set up.
        await ctx.perpetual.operator.setLocalOperator(otherAddress, true, { from: account });

        // Call the function.
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.invalidateSignature(
            defaultTransferToSolo,
            { from: otherAddress },
          ),
          'Sender does not have permission to invalidate',
        );
      });

      it('fails for Perpetual global operator', async () => {
        // Set up.
        await ctx.perpetual.admin.setGlobalOperator(otherAddress, true, { from: admin });

        // Call the function.
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.invalidateSignature(
            defaultTransferToSolo,
            { from: otherAddress },
          ),
          'Sender does not have permission to invalidate',
        );
      });

      it('fails for Solo local operator', async () => {
        // Set up.
        await ctx.perpetual.testing.solo.setIsLocalOperator(account, otherAddress, true);

        // Call the function.
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.invalidateSignature(
            defaultTransferToSolo,
            { from: otherAddress },
          ),
          'Sender does not have permission to invalidate',
        );
      });

      it('fails for Solo global operator', async () => {
        // Set up.
        await ctx.perpetual.testing.solo.setIsGlobalOperator(otherAddress, true);

        // Call the function.
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.invalidateSignature(
            defaultTransferToSolo,
            { from: otherAddress },
          ),
          'Sender does not have permission to invalidate',
        );
      });
    });

    it('fails if the transfer mode is invalid', async () => {
      const transfer = await getModifiedTransferToPerpetual({ transferMode: 3 });
      await expectAssertFailure(
        ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer),
      );
    });
  });

  // ============ Helper Functions ============

  function getModifiedTransferToPerpetual(
    args: Partial<SignedSoloBridgeTransfer>,
  ): Promise<SignedSoloBridgeTransfer> {
    const newTransfer: SoloBridgeTransfer = {
      ...defaultTransferToPerpetual,
      ...args,
    };
    return ctx.perpetual.soloBridgeProxy.getSignedTransfer(newTransfer, SigningMethod.Hash);
  }

  function getModifiedTransferToSolo(
    args: Partial<SignedSoloBridgeTransfer>,
  ): Promise<SignedSoloBridgeTransfer> {
    const newTransfer: SoloBridgeTransfer = {
      ...defaultTransferToSolo,
      ...args,
    };
    return ctx.perpetual.soloBridgeProxy.getSignedTransfer(newTransfer, SigningMethod.Hash);
  }

  function checkLogs(
    txResult: TxResult,
    transfer: SoloBridgeTransfer,
  ): void {
    const logs = ctx.perpetual.logs.parseLogs(txResult);
    const toPerpetual = transfer.transferMode !== SoloBridgeTransferMode.SOME_TO_SOLO;

    const transferLogs = _.filter(logs, { name: 'LogTransferred' });
    expect(transferLogs.length, 'log transfer count').to.equal(1);
    const transferLog = transferLogs[0];
    expect(transferLog.args.account, 'log account').to.equal(transfer.account);
    expect(transferLog.args.perpetual, 'log perpetual').to.equal(transfer.perpetual);
    expectBN(transferLog.args.soloAccountNumber, 'log soloAccountNumber').to.equal(
      transfer.soloAccountNumber,
    );
    expectBN(transferLog.args.soloMarketId, 'log soloMarketId').to.equal(transfer.soloMarketId);
    expect(transferLog.args.toPerpetual, 'log toPerpetual').to.equal(toPerpetual);
    expectBN(transferLog.args.amount, 'log amount').to.equal(transfer.amount);

    if (toPerpetual) {
      const depositLogs = _.filter(logs, { name: 'LogDeposit' });
      expect(depositLogs.length, 'log deposit count').to.equal(1);
      const depositLog = depositLogs[0];
      expect(depositLog.args.account, 'log deposit account').to.equal(transfer.account);
      expectBN(depositLog.args.amount, 'log deposit amount').to.equal(transfer.amount);
    } else {
      const withdrawalLogs = _.filter(logs, { name: 'LogWithdraw' });
      expect(withdrawalLogs.length, 'log withdrawal count').to.equal(1);
      const withdrawalLog = withdrawalLogs[0];
      expect(withdrawalLog.args.account, 'log withdrawal account').to.equal(transfer.account);
      expect(withdrawalLog.args.destination, 'log withdrawal destination').to.equal(
        ctx.perpetual.soloBridgeProxy.address,
      );
      expectBN(withdrawalLog.args.amount, 'log withdrawal amount').to.equal(transfer.amount);
    }
  }
});
