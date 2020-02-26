require('ts-node/register'); // eslint-disable-line
require('dotenv-flow').config(); // eslint-disable-line

const Web3 = require('web3');
const { getDevProvider } = require('./provider');

const enableProfiler = process.env.ENABLE_SOL_PROFILER === 'true';
const enableTrace = process.env.ENABLE_SOL_TRACE === 'true';
const enableDevTools = enableProfiler || enableTrace;
const devProvider = getDevProvider(enableProfiler, enableTrace);

module.exports = {
  compilers: {
    solc: {
      version: enableDevTools ? '0.5.1' : '0.5.16',
      docker: process.env.DOCKER_COMPILER !== 'false',
      parser: 'solcjs',
      settings: {
        optimizer: {
          // TODO(ken): Figure out why sol-trace doesn't seem to run optimizer even when configured.
          enabled: process.env.ENABLE_SOL_TRACE !== 'true',
          runs: 10000,
        },
      },
    },
  },
  networks: {
    test: {
      host: '0.0.0.0',
      port: 8545,
      gasPrice: 1,
      network_id: '1001',
      provider: function() {
        if (enableDevTools) {
          return devProvider;
        }
        return new Web3.providers.HttpProvider(process.env.RPC_NODE_URI);
      },
    },
    coverage: {
      host: '127.0.0.1',
      port: 8555,
      gasPrice: 1,
      network_id: '1002',
    },
    docker: {
      host: 'localhost',
      network_id: '1313',
      port: 8545,
      gasPrice: 1,
    },
  },
  plugins: ['solidity-coverage'],
  mocha: {
    timeout: false,
  },
};
