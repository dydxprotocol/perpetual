// ============ Contracts ============

// Base Protocol
const PerpetualProxy = artifacts.require('PerpetualProxy');
const PerpetualV1 = artifacts.require('PerpetualV1');

// ============ Main Migration ============

const migration = async (deployer, network, accounts) => {
  // deploy the contracts
  await deployer.deploy(PerpetualV1);
  await deployer.deploy(PerpetualProxy);

  // initialize the contracts
  const proxy = await PerpetualProxy.deployed();
  await proxy.initialize(
    PerpetualV1.address, // logic
    accounts[0], // admin
    '0x8129fc1c', // data = bytes4(keccak256("initialize()"))
  );
};

module.exports = migration;
