import { promisify } from 'es6-promisify';
import fs from 'fs';

import deployed from '../migrations/deployed.json';
import { PerpetualMarket } from '../src/lib/types';
import contracts from './Artifacts';

const writeFileAsync = promisify(fs.writeFile);

const NETWORK_IDS = ['1'];

const MARKET_PAIR = process.env.MARKET_PAIR as PerpetualMarket;
if (!MARKET_PAIR) {
  throw new Error('Required env var: MARKET_PAIR');
}
if (!Object.values(PerpetualMarket).includes(MARKET_PAIR)) {
  throw new Error(`Unknown market pair: ${MARKET_PAIR}`);
}

async function run() {

  Object.keys(contracts).forEach((contractName) => {
    const contract = contracts[contractName];

    NETWORK_IDS.forEach((networkId) => {
      if (contract.networks[networkId]) {
        deployed[contractName] = deployed[contractName] || {};
        deployed[contractName][networkId] = deployed[contractName][networkId] || {}

        deployed[contractName][networkId][MARKET_PAIR] = {
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
