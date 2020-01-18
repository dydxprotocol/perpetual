// ============ Contracts ============

// Base Protocol
const Perpetual = artifacts.require('Perpetual');

// ============ Main Migration ============

const migration = async (deployer) => {
  const id = 1;
  await deployer.deploy(Perpetual, id);
};

module.exports = migration;
