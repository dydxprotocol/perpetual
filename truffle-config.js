require('ts-node/register');
require('dotenv-flow').config();

module.exports = {
  compilers: {
    solc: {
      version: '0.6.1',
      docker: false,
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
  },
  plugins: ['solidity-coverage'],
};
