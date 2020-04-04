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
