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

import { expect } from './helpers/Expect';

import perpetualProxyJson from '../build/contracts/PerpetualProxy.json';
import perpetualV1Json from '../build/contracts/PerpetualV1.json';

describe('Bytecode Size', () => {
  it('Has a bytecode that does not exceed the maximum', async () => {
    if (process.env.COVERAGE === 'true') {
      return;
    }

    // Max size is 0x6000 (= 24576) bytes
    const maxSize = 24576 * 2; // 2 characters per byte
    expect(perpetualProxyJson.deployedBytecode.length).is.lessThan(maxSize);
    expect(perpetualV1Json.deployedBytecode.length).is.lessThan(maxSize);
  });
});
