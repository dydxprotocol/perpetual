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

import Web3 from 'web3';

const USAGE = `
Usage:

verify-contract.js CONTRACT_NAME DEPLOYED_ADDRESS
`;

if (process.argv.length !== 4) {
  console.log(USAGE);
  process.exit(1);
}

(async function main() {
  const [, , contractName, deployedAddress] = process.argv;

  const url = process.env.ETHEREUM_HTTP_NODE_MAINNET;
  if (!url) {
    throw new Error('Expected environment variable `ETHEREUM_HTTP_NODE_MAINNET` to be set');
  }

  const provider = new Web3.providers.HttpProvider(url);
  const web3 = new Web3(provider);

  const jsonPath = `../../build/contracts/${contractName}.json`;
  const contractJson = require(jsonPath);

  console.log(`Using network: ${await web3.eth.net.getId()}\n`);
  console.log(
    `Checking bytecode deployed at ${deployedAddress} against ` +
    `the locally compiled bytecode for contract '${contractName}'.`,
  );

  const deployedBytecodeString = await web3.eth.getCode(deployedAddress);
  const expectedBytecodeString = contractJson.deployedBytecode;
  const deployedBytecode = Buffer.from(deployedBytecodeString.slice(2), 'hex');
  const expectedBytecode = Buffer.from(expectedBytecodeString.slice(2), 'hex');

  if (deployedBytecode.length !== expectedBytecode.length) {
    throw new Error(
      `Deployed bytecode length: ${deployedBytecode.length}, ` +
      `Expected bytecode length: ${expectedBytecode.length}`,
    );
  }

  const deployedMetadata = getMetadata(deployedBytecode);
  const expectedMetadata = getMetadata(expectedBytecode);

  if (deployedMetadata.length !== expectedMetadata.length) {
    throw new Error(
      `Deployed bytecode metadata length: ${deployedMetadata.length}, ` +
      `Expected bytecode metadata length: ${expectedMetadata.length}`,
    );
  }

  const metadataLength = deployedMetadata.length;
  const codeLength = deployedBytecode.length - metadataLength;
  const metadataMatch = deployedMetadata.equals(expectedMetadata);

  console.log(`\nMetadata length: ${metadataLength} bytes`);
  console.log(`Bytecode length (non-metadata): ${codeLength} bytes`);
  console.log(`Metadata match: ${metadataMatch}`);

  const deployedCode = deployedBytecode.slice(0, codeLength);
  const expectedCode = expectedBytecode.slice(0, codeLength);

  if (!deployedCode.equals(expectedCode)) {
    throw new Error('Bytecode mismatch.');
  }

  console.log('\nPassed all checks.');
})().catch(console.error);

function getMetadata(bytecode: Buffer): Buffer {
  // The last two bytes should represent the metadata length.
  const length = bytecode.length;
  const metadataLength = bytecode[length - 2] * 2 ** 8 + bytecode[length - 1];
  return bytecode.slice(length - metadataLength);
}
