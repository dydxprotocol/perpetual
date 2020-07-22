import fs from 'fs';
import _ from 'lodash';

import deployed from '../migrations/deployed.json';
import { PerpetualMarket } from '../src/lib/types';
import contracts from './Artifacts';

const NETWORK_IDS = ['1', '42'];

const MARKET_PAIR = process.env.MARKET_PAIR as PerpetualMarket;

/**
 * Copy deployed contract info for public networks from build/contracts to deployed.json.
 *
 * The market pair must be specified, and the data will be stored under that pair in deployed.json.
 */
async function run() {

  Object.keys(contracts).forEach((contractName) => {
    const contract = contracts[contractName];

    NETWORK_IDS.forEach((networkId) => {
      if (contract.networks[networkId]) {
        // Only validate MARKET_PAIR if it's actually used.
        if (!MARKET_PAIR) {
          throw new Error('Required env var: MARKET_PAIR');
        }
        if (!Object.values(PerpetualMarket).includes(MARKET_PAIR)) {
          throw new Error(`Unknown market pair: ${MARKET_PAIR}`);
        }

        deployed[contractName] = deployed[contractName] || {};
        deployed[contractName][MARKET_PAIR] = deployed[contractName][MARKET_PAIR] || {};
        deployed[contractName][MARKET_PAIR][networkId] = _.pick(
          contract.networks[networkId],
          ['links', 'address', 'transactionHash'],
        );
      }
    });
  });

  const json = `${JSON.stringify(deployed, null, 4)}\n`;

  const filepath = `${__dirname}/../migrations/deployed.json`;
  fs.writeFileSync(filepath, json);
  console.log('Wrote deployed.json');
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .then(() => process.exit(0));
