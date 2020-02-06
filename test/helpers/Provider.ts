require('dotenv-flow').config();

import { RevertTraceSubprovider, TruffleArtifactAdapter } from '@0x/sol-trace';
import Web3 from 'web3';
import ProviderEngine from 'web3-provider-engine';
import RpcSubprovider from 'web3-provider-engine/subproviders/rpc';

function providerEngine() {
  const artifactAdapter = new TruffleArtifactAdapter(
    '.', // project root
    '0.5.16', // solc version
  );

  const revertTraceSubprovider = new RevertTraceSubprovider(
    artifactAdapter,
    '0x0000000000000000000000000000000000000000',
  );

  const providerEngine = new ProviderEngine();
  providerEngine.addProvider(revertTraceSubprovider);
  providerEngine.addProvider(new RpcSubprovider({ rpcUrl: process.env.RPC_NODE_URI }));
  providerEngine.send = providerEngine.sendAsync as any;

  // https://github.com/ethereum/web3.js/blob/1.x/packages/web3-core-method/src/index.js#L516-L517
  providerEngine.on = undefined;

  providerEngine.start();
  return providerEngine;
}

function httpProvider() {
  return new Web3.providers.HttpProvider(process.env.RPC_NODE_URI);
}

providerEngine();
httpProvider();

export default providerEngine();
// export default httpProvider();

// Web3ProviderEngine does not support synchronous requests.
// https://github.com/MetaMask/web3-provider-engine/issues/309
// providerEngine.send = function (payload: any) {
//   console.log('send', payload.method);

//   return new Promise<any>((resolve, reject) => {
//     providerEngine.sendAsync(payload, (error, response) => {
//       if (error) {
//         console.log('reject', payload.method);
//         reject(error);
//       }
//       console.log('resolve', payload.method);
//       resolve(response);
//     });
//   });
// };

// providerEngine.addProvider(new FilterSubprovider());

// declare module 'json-rpc-engine';

// import JsonRpcEngine from 'json-rpc-engine';
// import providerFromEngine from 'eth-json-rpc-middleware/providerFromEngine';

// const engine = new (JsonRpcEngine as any)();
// const provider = providerFromEngine(engine);
