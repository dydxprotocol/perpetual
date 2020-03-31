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

const {
  getChainId,
  isDevNetwork,
  getMakerPriceOracleAddress,
  getDeployerAddress,
} = require('./helpers');

// ============ Contracts ============

// Base Protocol
const PerpetualProxy = artifacts.require('PerpetualProxy');
const PerpetualV1 = artifacts.require('PerpetualV1');

// Oracles
const P1FundingOracle = artifacts.require('P1FundingOracle');

// Traders
const P1Orders = artifacts.require('P1Orders');
const P1Deleveraging = artifacts.require('P1Deleveraging');
const P1Liquidation = artifacts.require('P1Liquidation');

// Price Oracles
const P1MakerOracle = artifacts.require('P1MakerOracle');

// Test Contracts
const TestLib = artifacts.require('Test_Lib');
const TestP1Funder = artifacts.require('Test_P1Funder');
const TestP1Monolith = artifacts.require('Test_P1Monolith');
const TestP1Oracle = artifacts.require('Test_P1Oracle');
const TestP1Trader = artifacts.require('Test_P1Trader');
const TestToken = artifacts.require('Test_Token');
const TestMakerOracle = artifacts.require('Test_MakerOracle');

// ============ Main Migration ============

const migration = async (deployer, network, accounts) => {
  await Promise.all([
    deployTestContracts(deployer, network),
    deployProtocol(deployer, network, accounts),
  ]);

  await deployOracles(deployer, network);
  await deployTraders(deployer, network);
};

module.exports = migration;

// ============ Deploy Functions ============

async function deployTestContracts(deployer, network) {
  if (isDevNetwork(network)) {
    await Promise.all([
      deployer.deploy(TestLib),
      deployer.deploy(TestP1Funder),
      deployer.deploy(TestP1Monolith),
      deployer.deploy(TestP1Oracle),
      deployer.deploy(TestP1Trader),
      deployer.deploy(TestToken),
      deployer.deploy(TestMakerOracle),
    ]);
  }
}

async function deployProtocol(deployer, network, accounts) {
  await deployer.deploy(PerpetualV1);
  await deployer.deploy(
    PerpetualProxy,
    PerpetualV1.address, // logic
    getDeployerAddress(network, accounts), // admin
    '0x', // data
  );
}

async function deployOracles(deployer, network) {
  await Promise.all([
    deployer.deploy(
      P1FundingOracle,
    ),
    deployer.deploy(
      P1MakerOracle,
      PerpetualProxy.address,
      getMakerPriceOracleAddress(network, TestMakerOracle),
    ),
  ]);
}

async function deployTraders(deployer, network) {
  // deploy traders
  await Promise.all([
    deployer.deploy(
      P1Orders,
      PerpetualProxy.address,
      getChainId(network),
    ),
    deployer.deploy(
      P1Deleveraging,
      PerpetualProxy.address,
    ),
    deployer.deploy(
      P1Liquidation,
      PerpetualProxy.address,
    ),
  ]);

  // set global operators
  const perpetual = await PerpetualV1.at(PerpetualProxy.address);
  await Promise.all([
    perpetual.setGlobalOperator(P1Orders.address, true),
    perpetual.setGlobalOperator(P1Deleveraging.address, true),
    perpetual.setGlobalOperator(P1Liquidation.address, true),
  ]);
  if (isDevNetwork(network)) {
    await perpetual.setGlobalOperator(TestP1Trader.address, true);
  }
}
