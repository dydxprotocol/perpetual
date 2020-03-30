import fs from 'fs';
import { promisify } from 'es6-promisify';
import contracts from './Artifacts';
import deployed from '../migrations/deployed.json';

const writeFileAsync = promisify(fs.writeFile);

const NETWORK_IDS = ['1', '42'];

async function run() {

  Object.keys(contracts).forEach((contractName) => {
    const contract = contracts[contractName];

    NETWORK_IDS.forEach((networkId) => {
      if (contract.networks[networkId]) {
        deployed[contractName] = deployed[contractName] || {};

        deployed[contractName][networkId] = {
          links: contract.networks[networkId].links,
          address: contract.networks[networkId].address,
          transactionHash: contract.networks[networkId].transactionHash,
        };
      }
    });
  });

  const json = JSON.stringify(deployed, null, 4) + '\n';

  const filepath = `${__dirname}/../migrations/deployed.json`;
  await writeFileAsync(filepath, json);
  console.log('Wrote deployed.json');
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .then(() => process.exit(0));
