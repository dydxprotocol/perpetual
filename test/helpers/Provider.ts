require('dotenv-flow').config();
import ProviderEngine from 'web3-provider-engine';
import RpcSubprovider from 'web3-provider-engine/subproviders/rpc';
import { RevertTraceSubprovider, TruffleArtifactAdapter } from '@0x/sol-trace';

const artifactAdapter = new TruffleArtifactAdapter(
  '.', // project root
  '0.5.16', // solc version
);

const revertTraceSubprovider = new RevertTraceSubprovider(
  artifactAdapter,
  '0x0000000000000000000000000000000000000000',
);

export const providerEngine = new ProviderEngine();
providerEngine.addProvider(revertTraceSubprovider);
providerEngine.addProvider(new RpcSubprovider({rpcUrl: process.env.RPC_NODE_URI}));
providerEngine.start();
