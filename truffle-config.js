require('ts-node/register'); // eslint-disable-line
require('dotenv-flow').config(); // eslint-disable-line

module.exports = {
  compilers: {
    solc: {
      version: '0.5.16',
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
