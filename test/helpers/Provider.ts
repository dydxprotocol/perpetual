require('dotenv-flow').config();

import { ProfilerSubprovider } from '@0x/sol-profiler';
import { RevertTraceSubprovider, TruffleArtifactAdapter } from '@0x/sol-trace';
import Web3 from 'web3';
import ProviderEngine from 'web3-provider-engine';
import RpcSubprovider from 'web3-provider-engine/subproviders/rpc';

import { Provider } from '../../src/lib/types';

const enableProfiler = process.env.ENABLE_SOL_PROFILER === 'true';
const enableTrace = process.env.ENABLE_SOL_TRACE === 'true';

/**
 * Creates a provider engine for use with 0x's Solidity dev tools.
 */
function providerEngine() {
  const artifactAdapter = new TruffleArtifactAdapter(
    '.', // project root
    '0.5.16', // solc version
  );

  const defaultFromAddress = '0x0000000000000000000000000000000000000000';

  const providerEngine = new ProviderEngine();
  if (enableProfiler) {
    const profilerSubprovider = new ProfilerSubprovider(artifactAdapter, defaultFromAddress);
    providerEngine.addProvider(profilerSubprovider);
    console.log('okaaaaaaay');
  } else {
    console.log('oooooops');
  }
  if (enableTrace) {
    const revertTraceSubprovider = new RevertTraceSubprovider(artifactAdapter, defaultFromAddress);
    providerEngine.addProvider(revertTraceSubprovider);
  }
  providerEngine.addProvider(new RpcSubprovider({ rpcUrl: process.env.RPC_NODE_URI }));
  providerEngine.send = providerEngine.sendAsync as any;

  // Prevent web3 from thinking that this provider supports subscriptions.
  // https://github.com/ethereum/web3.js/blob/1.x/packages/web3-core-method/src/index.js#L516-L517
  providerEngine.on = undefined;

  providerEngine.start();
  return providerEngine;
}

let provider: Provider;
if (enableProfiler || enableTrace) {
  provider = providerEngine() as unknown as Provider;
} else {
  provider = new Web3.providers.HttpProvider(process.env.RPC_NODE_URI);
}

export default provider;
