module.exports = {
  client: require('ganache-cli'),
  providerOptions: {
    hardfork: 'istanbul',
    network_id: 1002,
  },
  skipFiles: [
    'Migrations.sol',
  ],
};
