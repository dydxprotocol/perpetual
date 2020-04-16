/*

    Copyright 2020 dYdX Trading Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

import fs from 'fs';
import { promisify } from 'es6-promisify';
import mkdirp from 'mkdirp';
import contracts from './Artifacts';
import deployed from '../migrations/deployed.json';

const writeFileAsync = promisify(fs.writeFile);

const TEST_NETWORK_ID: string = '1001';
const COVERAGE_NETWORK_ID: string = '1002';

async function clean(): Promise<void> {
  const directory = `${__dirname}/../build/published_contracts/`;
  mkdirp.sync(directory);

  const promises = Object.keys(contracts).map(async (contractName) => {
    const contract = contracts[contractName];

    const cleaned = {
      contractName: contract.contractName,
      abi: contract.abi,
      networks: {},
    };

    if (deployed[contractName]) {
      cleaned.networks = deployed[contractName];
    }

    if (contract.networks[TEST_NETWORK_ID]) {
      cleaned.networks[TEST_NETWORK_ID] = {
        links: contract.networks[TEST_NETWORK_ID].links,
        address: contract.networks[TEST_NETWORK_ID].address,
        transactionHash: contract.networks[TEST_NETWORK_ID].transactionHash,
      };
    }
    if (contract.networks[COVERAGE_NETWORK_ID]) {
      cleaned.networks[COVERAGE_NETWORK_ID] = {
        links: contract.networks[COVERAGE_NETWORK_ID].links,
        address: contract.networks[COVERAGE_NETWORK_ID].address,
        transactionHash: contract.networks[COVERAGE_NETWORK_ID].transactionHash,
      };
    }

    const json = JSON.stringify(cleaned, null, 4);

    const filename = `${contractName}.json`;
    await writeFileAsync(directory + filename, json);

    console.log(`Wrote ${directory}${filename}`);
  });

  await Promise.all(promises);
}

clean()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .then(() => process.exit(0));
