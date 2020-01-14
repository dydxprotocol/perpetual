const Migrations = artifacts.require('./Migrations.sol');

const migration = (deployer) => deployer.deploy(Migrations);

module.exports = migration;
