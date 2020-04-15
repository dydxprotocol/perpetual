/*

    Copyright 2020 dYdX Trading Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

function getChainId(network) {
  if (isMainnet(network)) {
    return 1;
  }
  if (isKovan(network)) {
    return 42;
  }
  if (network.startsWith('coverage')) {
    return 1002;
  }
  if (network.startsWith('docker')) {
    return 1313;
  }
  if (network.startsWith('test')) {
    return 1001;
  }
  throw new Error('No chainId for network', network);
}

function isDevNetwork(network) {
  verifyNetwork(network);
  return network.startsWith('development')
      || network.startsWith('test')
      || network.startsWith('test_ci')
      || network.startsWith('develop')
      || network.startsWith('dev')
      || network.startsWith('docker')
      || network.startsWith('coverage');
}

// ============ Helper Functions ============

function isMainnet(network) {
  verifyNetwork(network);
  return network.startsWith('mainnet');
}

function isKovan(network) {
  verifyNetwork(network);
  return network.startsWith('kovan');
}

function verifyNetwork(network) {
  if (!network) {
    throw new Error('No network provided');
  }
}

function getPartiallyDelayedMultisigAddress(network) {
  if (isMainnet(network)) {
    return '0xba2906b18B069b40C6D2CAFd392E76ad479B1B53';
  }
  if (isKovan(network)) {
    return '0x3d62d8b3ef034e0fde7de8fec4f557a3e6e4efa1';
  }
  throw new Error('Cannot find Admin Multisig');
}

function getMakerPriceOracleAddress(network, devContract) {
  if (isMainnet(network)) {
    return '0x064409168198A7E9108036D072eF59F923dEDC9A';
  }
  if (isKovan(network)) {
    return '0xf8A9Faa25186B14EbF02e7Cd16e39152b85aEEcd';
  }
  if (isDevNetwork(network)) {
    return devContract.address;
  }
  throw new Error('Cannot find MakerPriceOracle');
}

function getDeployerAddress(network, accounts) {
  if (isMainnet(network) || isKovan(network)) {
    return process.env.DEPLOYER_ACCOUNT;
  }
  if (isDevNetwork(network)) {
    return accounts[0];
  }
  throw new Error('Cannot find Deployer address');
}

function getOracleAdjustment(network) {
  if (isMainnet(network) || isKovan(network)) {
    return '10000000000000000'; // 0.01e18
  }
  if (isDevNetwork(network)) {
    return '1000000000000000000'; // 1e18
  }
  throw new Error('Cannot find oracle adjustment');
}

function getTokenAddress(network) {
  if (isMainnet(network)) {
    return '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'; // USDC
  }
  if (isKovan(network)) {
    return '0x0000000000000000000000000000000000000000'; // null
  }
  throw new Error('Cannot find token address');
}

function getMinCollateralization(network) {
  if (isMainnet(network) || isKovan(network)) {
    return '107500000000000000'; // 107.5%
  }
  throw new Error('Cannot find minimum collateralization');
}

module.exports = {
  getChainId,
  isDevNetwork,
  getPartiallyDelayedMultisigAddress,
  getMakerPriceOracleAddress,
  getDeployerAddress,
  getOracleAdjustment,
  getTokenAddress,
  getMinCollateralization,
};
