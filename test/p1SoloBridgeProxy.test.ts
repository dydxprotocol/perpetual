import _ from 'lodash';

import { expectThrow, expect, expectBN } from './helpers/Expect';
import initializePerpetual from './helpers/initializePerpetual';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { ADDRESSES, INTEGERS } from '../src/lib/Constants';
import {
  address,
  SoloBridgeTransfer,
  TxResult,
  SigningMethod,
  SignedSoloBridgeTransfer,
} from '../src/lib/types';
import {
  expectTokenBalances,
  expectMarginBalances,
  mintAndDeposit,
} from './helpers/balances';

const SOLO_USDC_MARKET = 2;

// Test parameters.
const amount = 1e18;
const soloAccountNumber = 5;
const defaultTransferToPerpetual: SoloBridgeTransfer = {
  soloAccountNumber,
  amount,
  soloMarketId: SOLO_USDC_MARKET,
  account: ADDRESSES.ZERO, // Set later
  perpetual: ADDRESSES.ZERO, // Set later
  toPerpetual: true,
  salt: 234,
  expiration: INTEGERS.ONE_YEAR_IN_SECONDS.times(100),
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
    toPerpetual: false,
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
        const transfer = await getModifiedTransferToPerpetual({ expiration: 1 });
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer),
          'Transfer has expired',
        );
      });

      it('fails if the transfer was already executed', async () => {
        const transfer = await getModifiedTransferToPerpetual({ amount: amount / 2 });
        await ctx.perpetual.soloBridgeProxy.bridgeTransfer(
          transfer,
          { from: account },
        );
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer),
          'Transfer was already executed or canceled',
        );
      });

      it('fails if the transfer was canceled', async () => {
        await ctx.perpetual.soloBridgeProxy.cancelTransfer(
          defaultTransferToPerpetual,
          { from: account },
        );
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.bridgeTransfer(defaultTransferToPerpetualSigned),
          'Transfer was already executed or canceled',
        );
      });

      describe('permissions', async () => {

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
            'Sender does not have withdraw permissions and signature is invalid',
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
            'Sender does not have withdraw permissions and signature is invalid',
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
            'Sender does not have withdraw permissions and signature is invalid',
          );
        });
      });
    });

    describe('transfer (Perpetual -> Solo)', async () => {

      beforeEach(async () => {
        // Give the account tokens in the Perpetual contract.
        await mintAndDeposit(ctx, account, amount);
      });

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
        const transfer = await getModifiedTransferToSolo({ expiration: 1 });
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer),
          'Transfer has expired',
        );
      });

      it('fails if the transfer was already executed', async () => {
        const transfer = await getModifiedTransferToSolo({ amount: amount / 2 });
        await ctx.perpetual.soloBridgeProxy.bridgeTransfer(
          transfer,
          { from: account },
        );
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer),
          'Transfer was already executed or canceled',
        );
      });

      it('fails if the transfer was canceled', async () => {
        await ctx.perpetual.soloBridgeProxy.cancelTransfer(
          defaultTransferToSolo,
          { from: account },
        );
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.bridgeTransfer(defaultTransferToSoloSigned),
          'Transfer was already executed or canceled',
        );
      });

      describe('permissions', async () => {

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

        it('succeeds for Perpetual local operator', async () => {
          // Set up.
          await ctx.perpetual.operator.setLocalOperator(otherAddress, true, { from: account });

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

        it('succeeds for Perpetual global operator', async () => {
          // Set up.
          await ctx.perpetual.admin.setGlobalOperator(otherAddress, true, { from: admin });

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
            'Sender does not have withdraw permissions and signature is invalid',
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
            'Sender does not have withdraw permissions and signature is invalid',
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
            'Sender does not have withdraw permissions and signature is invalid',
          );
        });
      });
    });
  });

  describe('cancelTransfer()', () => {

    describe('canceling a transfer (Solo -> Perpetual)', async () => {

      it('succeeds for account owner', async () => {
        // Call the function.
        const txResult = await ctx.perpetual.soloBridgeProxy.cancelTransfer(
          defaultTransferToPerpetual,
          { from: account },
        );

        // Check logs.
        const logs = await ctx.perpetual.logs.parseLogs(txResult);
        expect(logs.length).to.equal(1);
        const log = logs[0];
        expect(log.name).to.equal('LogTransferCanceled');
        expect(log.args.account).to.equal(defaultTransferToPerpetual.account);
        expect(log.args.transferHash).to.equal(
          ctx.perpetual.soloBridgeProxy.getTransferHash(defaultTransferToPerpetual),
        );
      });

      it('succeeds for Solo local operator', async () => {
        // Set up.
        await ctx.perpetual.testing.solo.setIsLocalOperator(account, otherAddress, true);

        // Call the function.
        const txResult = await ctx.perpetual.soloBridgeProxy.cancelTransfer(
          defaultTransferToPerpetual,
          { from: otherAddress },
        );

        // Check logs.
        const logs = await ctx.perpetual.logs.parseLogs(txResult);
        expect(logs.length).to.equal(1);
        const log = logs[0];
        expect(log.name).to.equal('LogTransferCanceled');
        expect(log.args.account).to.equal(defaultTransferToPerpetual.account);
        expect(log.args.transferHash).to.equal(
          ctx.perpetual.soloBridgeProxy.getTransferHash(defaultTransferToPerpetual),
        );
      });

      it('succeeds for Solo global operator', async () => {
        // Set up.
        await ctx.perpetual.testing.solo.setIsGlobalOperator(otherAddress, true);

        // Call the function.
        const txResult = await ctx.perpetual.soloBridgeProxy.cancelTransfer(
          defaultTransferToPerpetual,
          { from: otherAddress },
        );

        // Check logs.
        const logs = await ctx.perpetual.logs.parseLogs(txResult);
        expect(logs.length).to.equal(1);
        const log = logs[0];
        expect(log.name).to.equal('LogTransferCanceled');
        expect(log.args.account).to.equal(defaultTransferToPerpetual.account);
        expect(log.args.transferHash).to.equal(
          ctx.perpetual.soloBridgeProxy.getTransferHash(defaultTransferToPerpetual),
        );
      });

      it('fails for non-owner non-operator account', async () => {
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.cancelTransfer(
            defaultTransferToPerpetual,
            { from: otherAddress },
          ),
          'Sender does not have permission to cancel',
        );
      });

      it('fails for Perpetual local operator', async () => {
        // Set up.
        await ctx.perpetual.operator.setLocalOperator(otherAddress, true, { from: account });

        // Call the function.
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.cancelTransfer(
            defaultTransferToPerpetual,
            { from: otherAddress },
          ),
          'Sender does not have permission to cancel',
        );
      });

      it('fails for Perpetual global operator', async () => {
        // Set up.
        await ctx.perpetual.admin.setGlobalOperator(otherAddress, true, { from: admin });

        // Call the function.
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.cancelTransfer(
            defaultTransferToPerpetual,
            { from: otherAddress },
          ),
          'Sender does not have permission to cancel',
        );
      });
    });

    describe('canceling a transfer (Perpetual -> Solo)', async () => {

      it('succeeds for account owner', async () => {
        // Call the function.
        const txResult = await ctx.perpetual.soloBridgeProxy.cancelTransfer(
          defaultTransferToSolo,
          { from: account },
        );

        // Check logs.
        const logs = await ctx.perpetual.logs.parseLogs(txResult);
        expect(logs.length).to.equal(1);
        const log = logs[0];
        expect(log.name).to.equal('LogTransferCanceled');
        expect(log.args.account).to.equal(defaultTransferToSolo.account);
        expect(log.args.transferHash).to.equal(
          ctx.perpetual.soloBridgeProxy.getTransferHash(defaultTransferToSolo),
        );
      });

      it('succeeds for Perpetual local operator', async () => {
        // Set up.
        await ctx.perpetual.operator.setLocalOperator(otherAddress, true, { from: account });

        // Call the function.
        const txResult = await ctx.perpetual.soloBridgeProxy.cancelTransfer(
          defaultTransferToSolo,
          { from: otherAddress },
        );

        // Check logs.
        const logs = await ctx.perpetual.logs.parseLogs(txResult);
        expect(logs.length).to.equal(1);
        const log = logs[0];
        expect(log.name).to.equal('LogTransferCanceled');
        expect(log.args.account).to.equal(defaultTransferToSolo.account);
        expect(log.args.transferHash).to.equal(
          ctx.perpetual.soloBridgeProxy.getTransferHash(defaultTransferToSolo),
        );
      });

      it('succeeds for Perpetual global operator', async () => {
        // Set up.
        await ctx.perpetual.admin.setGlobalOperator(otherAddress, true, { from: admin });

        // Call the function.
        const txResult = await ctx.perpetual.soloBridgeProxy.cancelTransfer(
          defaultTransferToSolo,
          { from: otherAddress },
        );

        // Check logs.
        const logs = await ctx.perpetual.logs.parseLogs(txResult);
        expect(logs.length).to.equal(1);
        const log = logs[0];
        expect(log.name).to.equal('LogTransferCanceled');
        expect(log.args.account).to.equal(defaultTransferToSolo.account);
        expect(log.args.transferHash).to.equal(
          ctx.perpetual.soloBridgeProxy.getTransferHash(defaultTransferToSolo),
        );
      });

      it('fails for non-owner non-operator account', async () => {
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.cancelTransfer(
            defaultTransferToSolo,
            { from: otherAddress },
          ),
          'Sender does not have permission to cancel',
        );
      });

      it('fails for Solo local operator', async () => {
        // Set up.
        await ctx.perpetual.testing.solo.setIsLocalOperator(account, otherAddress, true);

        // Call the function.
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.cancelTransfer(
            defaultTransferToSolo,
            { from: otherAddress },
          ),
          'Sender does not have permission to cancel',
        );
      });

      it('fails for Solo global operator', async () => {
        // Set up.
        await ctx.perpetual.testing.solo.setIsGlobalOperator(otherAddress, true);

        // Call the function.
        await expectThrow(
          ctx.perpetual.soloBridgeProxy.cancelTransfer(
            defaultTransferToSolo,
            { from: otherAddress },
          ),
          'Sender does not have permission to cancel',
        );
      });
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

    const transferLogs = _.filter(logs, { name: 'LogTransferred' });
    expect(transferLogs.length, 'transfer count').to.equal(1);
    const transferLog = transferLogs[0];
    expect(transferLog.args.account, 'account').to.equal(transfer.account);
    expect(transferLog.args.perpetual, 'perpetual').to.equal(transfer.perpetual);
    expectBN(transferLog.args.soloAccountNumber, 'soloAccountNumber').to.equal(
      transfer.soloAccountNumber,
    );
    // expectBN(transferLog.args.soloMarketId, 'soloMarketId').to.equal(transfer.soloMarketId);
    expect(transferLog.args.toPerpetual, 'toPerpetual').to.equal(transfer.toPerpetual);
    expectBN(transferLog.args.amount, 'amount').to.equal(transfer.amount);

    if (transfer.toPerpetual) {
      const depositLogs = _.filter(logs, { name: 'LogDeposit' });
      expect(depositLogs.length, 'deposit count').to.equal(1);
      const depositLog = depositLogs[0];
      expect(depositLog.args.account, 'deposit account').to.equal(transfer.account);
      expectBN(depositLog.args.amount, 'deposit amount').to.equal(transfer.amount);
    } else {
      const withdrawalLogs = _.filter(logs, { name: 'LogWithdraw' });
      expect(withdrawalLogs.length, 'withdrawal count').to.equal(1);
      const withdrawalLog = withdrawalLogs[0];
      expect(withdrawalLog.args.account, 'withdrawal account').to.equal(transfer.account);
      expect(withdrawalLog.args.destination, 'withdrawal destination').to.equal(
        ctx.perpetual.soloBridgeProxy.address,
      );
      expectBN(withdrawalLog.args.amount, 'withdrawal amount').to.equal(transfer.amount);
    }
  }
});
