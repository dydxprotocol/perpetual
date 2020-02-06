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
} = require('./helpers');

// ============ Contracts ============

// Base Protocol
const PerpetualProxy = artifacts.require('PerpetualProxy');
const PerpetualV1 = artifacts.require('PerpetualV1');
const P1Orders = artifacts.require('P1Orders');

// Test Contracts
const TestP1Funder = artifacts.require('Test_P1Funder');
const TestP1Oracle = artifacts.require('Test_P1Oracle');
const TestP1Trader = artifacts.require('Test_P1Trader');
const TestToken = artifacts.require('Test_Token');

// ============ Main Migration ============

const migration = async (deployer, network, accounts) => {
  await Promise.all([
    deployTestContracts(deployer, network),
    deployProtocol(deployer, network, accounts),
  ]);

  // await deployTraders(deployer, network, accounts);
};

module.exports = migration;

// ============ Deploy Functions ============

async function deployTestContracts(deployer, network) {
  if (isDevNetwork(network)) {
    await Promise.all([
      deployer.deploy(TestP1Funder),
      deployer.deploy(TestP1Oracle),
      deployer.deploy(TestP1Trader),
      deployer.deploy(TestToken),
    ]);
    // console.log(`TestP1Funder: ${TestP1Funder.address}`);
    // console.log(`TestP1Oracle: ${TestP1Oracle.address}`);
    // console.log(`TestP1Trader: ${TestP1Trader.address}`);
    // console.log(`TestToken: ${TestToken.address}`);
  }
}

async function deployProtocol(deployer, network, accounts) {
  await deployer.deploy(PerpetualV1);
  // await deployer.deploy(
  //   PerpetualProxy,
  //   PerpetualV1.address, // logic
  //   accounts[0], // admin
  //   '0x', // data
  // );
  // console.log(`PerpetualV1: ${PerpetualV1.address}`);
  // console.log(`PerpetualProxy: ${PerpetualProxy.address}`);
}

// async function deployTraders(deployer, network, accounts) {
//   // const perpetualAddress = PerpetualV1.address;
//   const perpetualAddress = PerpetualProxy.address;

//   // deploy traders
//   await Promise.all([
//     deployer.deploy(
//       P1Orders,
//       perpetualAddress,
//       getChainId(network),
//     ),
//   ]);
//   console.log(`P1Orders: ${P1Orders.address}`);

//   // set global operators
//   const perpetual = await PerpetualV1.at(perpetualAddress);
//   console.log('go', (await PerpetualV1.deployed()).address);
//   await Promise.all([
//     perpetual.setGlobalOperator(P1Orders.address, true, { from: accounts[0] }),
//   ]);
// }
