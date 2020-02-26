const { ProfilerSubprovider } = require('@0x/sol-profiler');
const { RevertTraceSubprovider, TruffleArtifactAdapter } = require('@0x/sol-trace');
const ProviderEngine = require('web3-provider-engine');
const RpcSubprovider = require('web3-provider-engine/subproviders/rpc');

/**
 * Creates a provider engine for use with 0x's Solidity dev tools.
 */
function getDevProvider(enableProfiler, enableTrace) {
  const artifactAdapter = new TruffleArtifactAdapter(
    '.', // project root
    '0.5.16', // solc version
  );

  const defaultFromAddress = '0x0000000000000000000000000000000000000000';

  const providerEngine = new ProviderEngine();
  if (enableProfiler) {
    console.log('sol-profiler enabled');
    global.profilerSubprovider = new ProfilerSubprovider(artifactAdapter, defaultFromAddress);
    providerEngine.addProvider(global.profilerSubprovider);
  }
  if (enableTrace) {
    console.log('sol-trace enabled');
    const revertTraceSubprovider = new RevertTraceSubprovider(artifactAdapter, defaultFromAddress);
    providerEngine.addProvider(revertTraceSubprovider);
  }
  providerEngine.addProvider(new RpcSubprovider({ rpcUrl: process.env.RPC_NODE_URI }));
  providerEngine.send = providerEngine.sendAsync;

  // Prevent web3 from thinking that this provider supports subscriptions.
  // https://github.com/ethereum/web3.js/blob/1.x/packages/web3-core-method/src/index.js#L516-L517
  providerEngine.on = undefined;

  providerEngine.start();
  return providerEngine;
}

module.exports = {
  getDevProvider,
};
