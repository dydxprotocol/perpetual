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

const { isDevNetwork } = require('./helpers');

// ============ Contracts ============

// Base Protocol
const PerpetualProxy = artifacts.require('PerpetualProxy');
const PerpetualV1 = artifacts.require('PerpetualV1');

// Test Contracts
const Test_P1Oracle = artifacts.require('Test_P1Funder');
const Test_P1Oracle = artifacts.require('Test_P1Oracle');
const Test_P1Oracle = artifacts.require('Test_P1Trader');

// ============ Main Migration ============

const migration = async (deployer, network, accounts) => {
  await Promise.all([
    deployTestContracts(deployer, network),
    deployProtocol(deployer, network),
  ]);

  // initialize the contracts
  const perpetualV1 = await PerpetualV1.at(PerpetualProxy.address);
  perpetualV1.initializeV1(
    '0x0000000000000000000000000000000000000000', // TODO: token
    '0x0000000000000000000000000000000000000000', // TODO: oracle
    '0x0000000000000000000000000000000000000000', // TODO: funder
    '1100000000000000000', // minCollateral
  );
};

module.exports = migration;

// ============ Deploy Functions ============

async function deployTestContracts(deployer, network) {
  if (isDevNetwork(network)) {
    await Promise.all([
      deployer.deploy(Test_P1Funder),
      deployer.deploy(Test_P1Oracle),
      deployer.deploy(Test_P1Trader),
    ]);
  }
}

async function deployProtocol(deployer, _network) {
  await deployer.deploy(PerpetualV1);
  await deployer.deploy(
    PerpetualProxy,
    PerpetualV1.address, // logic
    accounts[0], // admin
    '0x', // data
  );
}
