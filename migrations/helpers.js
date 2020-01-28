function isDevNetwork(network) {
  verifyNetwork(network);
  return network.startsWith('development')
      || network.startsWith('test')
      || network.startsWith('test_ci')
      || network.startsWith('develop')
      || network.startsWith('dev')
      || network.startsWith('docker')
      || network.startsWith('coverage');
}

function verifyNetwork(network) {
  if (!network) {
    throw new Error('No network provided');
  }
}

module.exports = {
  isDevNetwork,
};
