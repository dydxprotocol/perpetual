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

const BigNumber = require('bignumber.js');

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

/**
 * Returns the Solidity representation of a daily funding rate.
 *
 * The funding rate and its bounds are represented as fixed-point numbers with 36 decimals.
 *
 * See the FundingRate class in src/lib/types.ts.
 */
function dailyFundingRateToSolidity(dailyRate) {
  // Apply the shift before division to avoid losing precision.
  const ratePerSecondFixed36 = new BigNumber(dailyRate).shiftedBy(36).div(24 * 60 * 60);
  return ratePerSecondFixed36.toFixed(0);
}

module.exports = {
  dailyFundingRateToSolidity,
  getChainId,
  isDevNetwork,
};
