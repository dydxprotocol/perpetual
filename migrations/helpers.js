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

function getMakerPriceOracleAddress(network, devAddress) {
  if (isMainnet(network)) {
    return '0x064409168198A7E9108036D072eF59F923dEDC9A';
  }
  if (isDevNetwork(network)) {
    return devAddress;
  }
  throw new Error('Cannot find MakerPriceOracle');
}

module.exports = {
  getChainId,
  isDevNetwork,
  getPartiallyDelayedMultisigAddress,
  getMakerPriceOracleAddress,
};
