import fs from 'fs';
import _ from 'lodash';
import mkdirp from 'mkdirp';

import deployed from '../migrations/deployed.json';
import externalDeployed from '../migrations/external_deployed.json';
import { PerpetualMarket } from '../src/lib/types';
import contracts from './Artifacts';

const TEST_NETWORK_ID: string = '1001';
const COVERAGE_NETWORK_ID: string = '1002';

/**
 * Write JSON artifacts to build/published_contracts, including only unnecessary data.
 *
 * Also, copy deployed contract information back to build/contracts, including market pair info.
 */
async function clean(): Promise<void> {
  const buildDir = `${__dirname}/../build/contracts/`;
  const publishDir = `${__dirname}/../build/published_contracts/`;
  mkdirp.sync(publishDir);

  await Promise.all(Object.keys(contracts).map(async (contractName) => {
    const contract = contracts[contractName];

    const cleaned = {
      contractName: contract.contractName,
      abi: contract.abi,
      networks: {},
    };

    if (deployed[contractName]) {
      cleaned.networks = deployed[contractName];
    } else if (externalDeployed[contractName]) {
      cleaned.networks = externalDeployed[contractName];
    }

    // During testing, use the same instance of the contract regardless of market pair.
    Object.values(PerpetualMarket).forEach((market) => {
      cleaned.networks[market] = cleaned.networks[market] || {};
      if (contract.networks[TEST_NETWORK_ID]) {
        cleaned.networks[market][TEST_NETWORK_ID] = _.pick(
          contract.networks[TEST_NETWORK_ID],
          ['links', 'address', 'transactionHash'],
        );
      }
      if (contract.networks[COVERAGE_NETWORK_ID]) {
        cleaned.networks[market][COVERAGE_NETWORK_ID] = _.pick(
          contract.networks[COVERAGE_NETWORK_ID],
          ['links', 'address', 'transactionHash'],
        );
      }
    });

    // Write cleaned JSON artifacts to build/published_contracts.
    const publishJson = JSON.stringify(cleaned, null, 4);
    const publishFilepath = `${publishDir}${contractName}.json`;
    fs.writeFileSync(publishFilepath, publishJson);
    console.log(`Wrote ${publishFilepath}`);

    // Copy deployed contract information, with market pairs, to build/contracts.
    const buildFilepath = `${buildDir}${contractName}.json`;
    contract.networks = {
      ...contract.networks,
      ...cleaned.networks,
    };
    const buildJson = JSON.stringify(contract, null, 4);
    fs.writeFileSync(buildFilepath, buildJson);
    console.log(`Wrote ${buildFilepath}`);
  }));
}

clean()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .then(() => process.exit(0));
