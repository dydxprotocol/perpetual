import _ from 'lodash';

import { expectThrow, expect, expectBN } from './helpers/Expect';
import initializePerpetual from './helpers/initializePerpetual';
import perpetualDescribe, { ITestContext } from './helpers/perpetualDescribe';
import { mintAndDeposit } from './helpers/balances';
import { ADDRESSES, INTEGERS } from '../src/lib/Constants';
import {
  address,
  SoloBridgeTransfer,
  TxResult,
  SigningMethod,
  SignedSoloBridgeTransfer,
} from '../src/lib/types';

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

// Accounts.
let account: address;
let otherAddress: address;

async function init(ctx: ITestContext): Promise<void> {
  await initializePerpetual(ctx);
  account = ctx.accounts[2];
  otherAddress = ctx.accounts[3];

  defaultTransferToPerpetual.account = account;
  defaultTransferToPerpetual.perpetual = ctx.perpetual.contracts.perpetualProxy.options.address;
  defaultTransferToSolo = {
    ...defaultTransferToPerpetual,
    toPerpetual: false,
  };
  defaultTransferToPerpetualSigned = await ctx.perpetual.soloBridgeProxy.getSignedTransfer(
    defaultTransferToPerpetual, SigningMethod.Hash,
  );
  defaultTransferToSoloSigned = await ctx.perpetual.soloBridgeProxy.getSignedTransfer(
    defaultTransferToSolo, SigningMethod.Hash,
  );

  await Promise.all([
    // Set allowance on Solo and Perpetual for the proxy.
    // ctx.perpetual.soloBridgeProxy.approveMaximumOnSolo(SOLO_USDC_MARKET),
    ctx.perpetual.soloBridgeProxy.approveMaximumOnPerpetual(),

    // Give the account tokens. Solo is stubbed out, so these are only used for Perpetual -> Solo.
    mintAndDeposit(ctx, account, amount),

    // Since Solo is stubbed out, the proxy needs a token balance for Solo -> Perpetual.
    ctx.perpetual.testing.token.mint(
      ctx.perpetual.contracts.testToken.options.address,
      ctx.perpetual.soloBridgeProxy.address,
      amount,
    ),

    // Set up test data on mock Solo contract.
    ctx.perpetual.testing.solo.setTokenAddress(
      SOLO_USDC_MARKET,
      ctx.perpetual.contracts.testToken.options.address,
    ),
  ]);
}

perpetualDescribe('P1SoloBridgeProxy', init, (ctx: ITestContext) => {
  describe('off-chain helpers', () => {
    it('Signs correctly for hash', async () => {
      const signedTransfer = await ctx.perpetual.soloBridgeProxy.getSignedTransfer(
        defaultTransferToPerpetual,
        SigningMethod.Hash,
      );
      const validSignature = ctx.perpetual.soloBridgeProxy.transferHasValidSignature(
        signedTransfer,
      );
      expect(validSignature).to.be.true;
    });

    it('Signs correctly for typed data', async () => {
      const signedTransfer = await ctx.perpetual.soloBridgeProxy.getSignedTransfer(
        defaultTransferToPerpetual,
        SigningMethod.TypedData,
      );
      const validSignature = ctx.perpetual.soloBridgeProxy.transferHasValidSignature(
        signedTransfer,
      );
      expect(validSignature).to.be.true;
    });

    it('Recognizes invalid signatures', () => {
      const badSignatures = [
        `0x${'00'.repeat(63)}00`,
        `0x${'ab'.repeat(63)}01`,
        `0x${'01'.repeat(70)}01`,
      ];
      badSignatures.map((typedSignature) => {
        const validSignature = ctx.perpetual.soloBridgeProxy.transferHasValidSignature({
          ...defaultTransferToPerpetual,
          typedSignature,
        });
        expect(validSignature).to.be.false;
      });
    });
  });

  describe('bridgeTransfer()', () => {
    it('transfers from Solo -> Perpetual', async () => {
      // Call the function.
      const txResult = await ctx.perpetual.soloBridgeProxy.bridgeTransfer(
        defaultTransferToPerpetualSigned,
      );

      // Check logs.
      checkLogs(txResult, defaultTransferToPerpetual);

      // TODO: Check balances.
    });

    it('transfers from Perpetual -> Solo', async () => {
      const txResult = await ctx.perpetual.soloBridgeProxy.bridgeTransfer(
        defaultTransferToSoloSigned,
      );

      // Check logs.
      checkLogs(txResult, defaultTransferToSolo);

      // TODO: Check balances.
    });

    it('fails if the Solo and Perpetual tokens do not match', async () => {
      // Set up mock data.
      const transfer = getModifiedTransfer({ soloMarketId: SOLO_USDC_MARKET + 1 });

      // Call the function.
      await expectThrow(
        ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer, { from: account }),
        'Solo and Perpetual assets are not the same',
      );
    });

    it('fails if the transfer has expired', async () => {
      const transfer = getModifiedTransfer({ expiration: 1 });
      await expectThrow(
        ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer, { from: account }),
        'Transfer has expired',
      );
    });

    it('fails if the transfer was already executed', async () => {
      const transfer = getModifiedTransfer({ amount: amount / 2 });
      await ctx.perpetual.soloBridgeProxy.bridgeTransfer(
        transfer,
        { from: account },
      );
      await expectThrow(
        ctx.perpetual.soloBridgeProxy.bridgeTransfer(transfer, { from: account }),
        'Transfer was already executed or canceled',
      );
    });

    it('fails if the transfer was canceled', async () => {
      await ctx.perpetual.soloBridgeProxy.cancelTransfer(
        defaultTransferToPerpetual,
        { from: account },
      );
      await expectThrow(
        ctx.perpetual.soloBridgeProxy.bridgeTransfer(defaultTransferToPerpetual, { from: account }),
        'Transfer was already executed or canceled',
      );
    });

    describe('transfer permissions (Solo -> Perpetual)', async () => {
      it('succeeds for account bearing a valid signature', async () => {
      });

      it('succeeds for account owner', async () => {
      });

      it('succeeds for Solo local operator', async () => {
      });

      it('succeeds for Solo global operator', async () => {
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
      });

      it('fails for Perpetual global operator', async () => {
      });
    });

    describe('transfer permissions (Perpetual -> Solo)', async () => {
      it('succeeds for account bearing a valid signature', async () => {
      });

      it('succeeds for account owner', async () => {
      });

      it('succeeds for Perpetual local operator', async () => {
      });

      it('succeeds for Perpetual global operator', async () => {
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
      });

      it('fails for Solo global operator', async () => {
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
        // TODO: Check hash.
        // expect(log.args.transferHash).to.equal();
      });

      it('succeeds for Solo local operator', async () => {
      });

      it('succeeds for Solo global operator', async () => {
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
      });

      it('fails for Perpetual global operator', async () => {
      });
    });

    describe('canceling a transfer (Perpetual -> Solo)', async () => {
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
        // TODO: Check hash.
        // expect(log.args.transferHash).to.equal();
      });

      it('succeeds for Perpetual local operator', async () => {
      });

      it('succeeds for Perpetual global operator', async () => {
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
      });

      it('fails for Solo global operator', async () => {
      });
    });
  });

  // ============ Helper Functions ============

  function getModifiedTransfer(
    args: Partial<SoloBridgeTransfer>,
  ): SoloBridgeTransfer {
    const newTransfer: SoloBridgeTransfer = {
      ...defaultTransferToPerpetual,
      ...args,
    };
    return newTransfer;
  }

  function checkLogs(
    txResult: TxResult,
    transfer: SoloBridgeTransfer,
  ): void {
    const logs = ctx.perpetual.logs.parseLogs(txResult);

    const transferLogs = _.filter(logs, { name: 'LogTransferred' });
    expect(transferLogs.length).to.equal(1);
    const transferLog = transferLogs[0];
    console.log(transferLog.args);
    expect(transferLog.args.account).to.equal(transfer.account);
    expect(transferLog.args.perpetual).to.equal(transfer.perpetual);
    expectBN(transferLog.args.soloAccountNumber).to.equal(transfer.soloAccountNumber);
    // expectBN(transferLog.args.soloMarketId).to.equal(transfer.soloMarketId);
    expect(transferLog.args.toPerpetual).to.equal(transfer.toPerpetual);
    expectBN(transferLog.args.amount).to.equal(transfer.amount);

    if (transfer.toPerpetual) {
      const depositLogs = _.filter(logs, { name: 'LogDeposit' });
      expect(depositLogs.length).to.equal(1);
      const depositLog = depositLogs[0];
      expect(depositLog.args.account).to.equal(transfer.account);
      expectBN(depositLog.args.amount).to.equal(transfer.amount);
    } else {
      const withdrawalLogs = _.filter(logs, { name: 'LogWithdraw' });
      expect(withdrawalLogs.length).to.equal(1);
      const withdrawalLog = withdrawalLogs[0];
      expect(withdrawalLog.args.account).to.equal(transfer.account);
      expect(withdrawalLog.args.destination).to.equal(ctx.perpetual.soloBridgeProxy.address);
      expectBN(withdrawalLog.args.amount).to.equal(transfer.amount);
    }
  }
});
