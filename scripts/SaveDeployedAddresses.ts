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
