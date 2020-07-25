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
  getOracleAdjustment,
  getInverseOracleAdjustmentExponent,
  getTokenAddress,
  getWethAddress,
  getMinCollateralization,
  getInsuranceFundAddress,
  getInsuranceFee,
  getDeleveragingOperatorAddress,
  getFundingRateProviderAddress,
  getSoloAddress,
} = require('./helpers');

// ============ Constants ============

const SOLO_USDC_MARKET = 2;

// ============ Contracts ============

// Base Protocol
const PerpetualProxy = artifacts.require('PerpetualProxy');
const PerpetualV1 = artifacts.require('PerpetualV1');

// Funding Oracles
const P1FundingOracle = artifacts.require('P1FundingOracle');

// Traders
const P1Orders = artifacts.require('P1Orders');
const P1InverseOrders = artifacts.require('P1InverseOrders');
const P1Deleveraging = artifacts.require('P1Deleveraging');
const P1Liquidation = artifacts.require('P1Liquidation');

// Price Oracles
const P1MakerOracle = artifacts.require('P1MakerOracle');
const P1OracleInverter = artifacts.require('P1OracleInverter');

// Proxies
const P1CurrencyConverterProxy = artifacts.require('P1CurrencyConverterProxy');
const P1LiquidatorProxy = artifacts.require('P1LiquidatorProxy');
const P1SoloBridgeProxy = artifacts.require('P1SoloBridgeProxy');
const P1WethProxy = artifacts.require('P1WethProxy');

// Test Contracts
const TestExchangeWrapper = artifacts.require('Test_ExchangeWrapper');
const TestLib = artifacts.require('Test_Lib');
const TestP1Funder = artifacts.require('Test_P1Funder');
const TestP1Monolith = artifacts.require('Test_P1Monolith');
const TestP1Oracle = artifacts.require('Test_P1Oracle');
const TestP1Trader = artifacts.require('Test_P1Trader');
const TestSolo = artifacts.require('Test_Solo');
const TestToken = artifacts.require('Test_Token');
const TestToken2 = artifacts.require('Test_Token2');
const TestMakerOracle = artifacts.require('Test_MakerOracle');
const WETH9 = artifacts.require('WETH9');

// ============ Main Migration ============

const migration = async (deployer, network, accounts) => {
  await deployTestContracts(deployer, network);
  await deployProtocol(deployer, network, accounts);
  await deployOracles(deployer, network);
  await initializePerpetual(deployer, network);
  await deployTraders(deployer, network);
};

module.exports = migration;

// ============ Deploy Functions ============

async function deployTestContracts(deployer, network) {
  if (isDevNetwork(network)) {
    await Promise.all([
      deployer.deploy(TestExchangeWrapper),
      deployer.deploy(TestLib),
      deployer.deploy(TestP1Funder),
      deployer.deploy(TestP1Monolith),
      deployer.deploy(TestP1Oracle),
      deployer.deploy(TestP1Trader),
      deployer.deploy(TestSolo),
      deployer.deploy(TestToken),
      deployer.deploy(TestToken2),
      deployer.deploy(TestMakerOracle),
      deployer.deploy(WETH9),
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
  // Deploy funding oracle and Maker oracle wrapper.
  await Promise.all([
    deployer.deploy(
      P1FundingOracle,
      getFundingRateProviderAddress(network),
    ),
    deployer.deploy(P1MakerOracle),
  ]);

  // Deploy oracle inverter.
  await deployer.deploy(
    P1OracleInverter,
    P1MakerOracle.address,
    PerpetualProxy.address, // TODO: Supply inverse perpetual address.
    getInverseOracleAdjustmentExponent(network),
  );

  const oracle = await P1MakerOracle.deployed();
  const makerOracle = getMakerPriceOracleAddress(network, TestMakerOracle);
  await Promise.all([
    oracle.setRoute(
      PerpetualProxy.address,
      makerOracle,
    ),
    oracle.setRoute(
      P1OracleInverter.address,
      makerOracle,
    ),
    oracle.setAdjustment(
      makerOracle,
      getOracleAdjustment(network),
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
      P1InverseOrders,
      PerpetualProxy.address,
      getChainId(network),
    ),
    deployer.deploy(
      P1Deleveraging,
      PerpetualProxy.address,
      getDeleveragingOperatorAddress(network),
    ),
    deployer.deploy(
      P1Liquidation,
      PerpetualProxy.address,
    ),
  ]);

  // deploy proxies
  await Promise.all([
    deployer.deploy(
      P1CurrencyConverterProxy,
    ),
    deployer.deploy(
      P1LiquidatorProxy,
      PerpetualProxy.address,
      P1Liquidation.address,
      getInsuranceFundAddress(network),
      getInsuranceFee(network),
    ),
    deployer.deploy(
      P1SoloBridgeProxy,
      getSoloAddress(network, TestSolo),
      getChainId(network),
    ),
    deployer.deploy(
      P1WethProxy,
      getWethAddress(network, WETH9),
    ),
  ]);

  // initialize proxies on non-testnet
  if (!isDevNetwork(network)) {
    const currencyConverterProxy = await P1CurrencyConverterProxy.deployed();
    await currencyConverterProxy.approveMaximumOnPerpetual(PerpetualProxy.address);

    const liquidatorProxy = await P1LiquidatorProxy.deployed();
    await liquidatorProxy.approveMaximumOnPerpetual();

    const soloBridgeProxy = await P1SoloBridgeProxy.deployed();
    await soloBridgeProxy.approveMaximumOnPerpetual(PerpetualProxy.address);
    await soloBridgeProxy.approveMaximumOnSolo(SOLO_USDC_MARKET);

    const wethProxy = await P1WethProxy.deployed();
    await wethProxy.approveMaximumOnPerpetual(PerpetualProxy.address);
  }

  // set global operators
  const perpetual = await PerpetualV1.at(PerpetualProxy.address);
  await Promise.all([
    // TODO: Approve either P1Orders or P1InverseOrders depending on the perpetual market.
    perpetual.setGlobalOperator(P1Orders.address, true),
    perpetual.setGlobalOperator(P1Deleveraging.address, true),
    perpetual.setGlobalOperator(P1Liquidation.address, true),
    perpetual.setGlobalOperator(P1CurrencyConverterProxy.address, true),
    perpetual.setGlobalOperator(P1LiquidatorProxy.address, true),
    perpetual.setGlobalOperator(P1SoloBridgeProxy.address, true),
    perpetual.setGlobalOperator(P1WethProxy.address, true),
  ]);
  if (isDevNetwork(network)) {
    await perpetual.setGlobalOperator(TestP1Trader.address, true);
  }
}

async function initializePerpetual(deployer, network) {
  const perpetual = await PerpetualV1.at(PerpetualProxy.address);
  if (!isDevNetwork(network)) {
    await perpetual.initializeV1(
      getTokenAddress(network),
      P1MakerOracle.address,
      P1FundingOracle.address,
      getMinCollateralization(network),
    );
  }
}
