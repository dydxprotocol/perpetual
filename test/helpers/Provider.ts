require('dotenv-flow').config();

import { RevertTraceSubprovider, TruffleArtifactAdapter } from '@0x/sol-trace';
import Web3 from 'web3';
import ProviderEngine from 'web3-provider-engine';
import RpcSubprovider from 'web3-provider-engine/subproviders/rpc';

import { Provider } from '../../src/lib/types';

function providerEngine() {
  const artifactAdapter = new TruffleArtifactAdapter(
    '.', // project root
    '0.5.16', // solc version
  );

  const revertTraceSubprovider = new RevertTraceSubprovider(
    artifactAdapter,
    '0x0000000000000000000000000000000000000000', // default from address
  );

  const providerEngine = new ProviderEngine();
  providerEngine.addProvider(revertTraceSubprovider);
  providerEngine.addProvider(new RpcSubprovider({ rpcUrl: process.env.RPC_NODE_URI }));
  providerEngine.send = providerEngine.sendAsync as any;

  // Prevent web3 from thinking that this provider supports subscriptions.
  // https://github.com/ethereum/web3.js/blob/1.x/packages/web3-core-method/src/index.js#L516-L517
  providerEngine.on = undefined;

  providerEngine.start();
  return providerEngine;
}

function httpProvider() {
  return new Web3.providers.HttpProvider(process.env.RPC_NODE_URI);
}

const provider: Provider = process.env.ENABLE_SOL_TRACE === 'true' ?
  (providerEngine() as unknown as Provider) : httpProvider();

export default provider;
