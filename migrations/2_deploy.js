const { isDevNetwork } = require('./helpers');

// ============ Contracts ============

// Base Protocol
const PerpetualProxy = artifacts.require('PerpetualProxy');
const PerpetualV1 = artifacts.require('PerpetualV1');

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
      deployer.deploy(TestMakerOracle),
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
