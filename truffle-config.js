require('ts-node/register');
require('dotenv-flow').config();

module.exports = {
  compilers: {
    solc: {
      version: '0.6.1',
      docker: !process.env.COVERALLS_REPO_TOKEN,
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
  },
  plugins: ['solidity-coverage'],
};
