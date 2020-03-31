require('ts-node/register'); // eslint-disable-line
require('dotenv-flow').config(); // eslint-disable-line
const HDWalletProvider = require('@truffle/hdwallet-provider'); // eslint-disable-line

module.exports = {
  compilers: {
    solc: {
      version: '0.5.16',
      docker: process.env.DOCKER_COMPILER !== 'false',
      parser: 'solcjs',
      settings: {
        optimizer: {
          enabled: true,
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
    mainnet: {
      network_id: '1',
      provider: () => new HDWalletProvider(
        [process.env.DEPLOYER_PRIVATE_KEY],
        process.env.ETHEREUM_WS_NODE_MAINNET,
        0,
        1,
      ),
      gasPrice: Number(process.env.GAS_PRICE),
      gas: 4900000,
      from: process.env.DEPLOYER_ACCOUNT,
      timeoutBlocks: 500,
    },
    kovan: {
      network_id: '42',
      provider: () => new HDWalletProvider(
        [process.env.DEPLOYER_PRIVATE_KEY],
        process.env.ETHEREUM_WS_NODE_KOVAN,
        0,
        1,
      ),
      gasPrice: 1100000000, // 1.1 gwei
      gas: 6900000,
      from: process.env.DEPLOYER_ACCOUNT,
      timeoutBlocks: 500,
    },
  },
  plugins: ['solidity-coverage'],
  mocha: {
    timeout: false,
  },
};
