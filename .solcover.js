module.exports = {
  client: require('ganache-cli'),
  providerOptions: {
    network_id: 1002,
  },
  skipFiles: [
    'Migrations.sol',
    'test/',
  ],
};
