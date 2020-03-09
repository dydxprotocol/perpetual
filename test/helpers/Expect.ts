import chai from 'chai';
import BigNumber from 'bignumber.js';
chai.use(require('chai-bignumber')(BigNumber));

import { address, BaseValue, BigNumberable } from '../../src/lib/types';

let REQUIRE_MSG = 'VM Exception while processing transaction: revert';
let ASSERT_MSG = 'VM Exception while processing transaction: invalid opcode';

if (process.env.ENABLE_SOL_TRACE !== 'true') {
  REQUIRE_MSG = `Returned error: ${REQUIRE_MSG}`;
  ASSERT_MSG = `Returned error: ${ASSERT_MSG}`;
}

// For solidity function calls that violate require()
export async function expectThrow(promise: Promise<any>, reason?: string) {
  try {
    await promise;
    throw new Error('Did not throw');
  } catch (e) {
    assertCertainError(e, REQUIRE_MSG);
    if (reason && process.env.COVERAGE !== 'true') {
      assertCertainError(e, `${REQUIRE_MSG} ${reason}`);
    }
  }
}

// For solidity function calls that violate assert()
export async function expectAssertFailure(promise: Promise<any>) {
  try {
    await promise;
    throw new Error('Did not throw');
  } catch (e) {
    assertCertainError(e, ASSERT_MSG);
  }
}

// Helper function
function assertCertainError(error: Error, expected_error_msg?: string) {
  // This complication is so that the actual error will appear in truffle test output
  const message = error.message;
  const matchedIndex = message.search(expected_error_msg);
  let matchedString = message;
  if (matchedIndex === 0) {
    matchedString = message.substring(matchedIndex, matchedIndex + expected_error_msg.length);
  }
  chai.expect(matchedString).to.eq(expected_error_msg);
}

export function expect(item: any, message?: string): Chai.Assertion {
  return chai.expect(item, message);
}

export function expectAddressesEqual(arg1: address, arg2: address, message?: string) {
  chai.expect(typeof arg1).to.equal('string', 'expectAddressesEqual arg1 type');
  chai.expect(typeof arg2).to.equal('string', 'expectAddressesEqual arg2 type');
  expect(arg1.toLowerCase()).to.equal(arg2.toLowerCase(), message);
}

export function expectBN(expectedBN: BigNumberable, message?: string): Chai.Assertion {
  return (chai.expect(new BigNumber(expectedBN), message) as any).to.be.bignumber;
}

export function expectBaseValueEqual(arg1: BaseValue, arg2: BaseValue, message?: string) {
  expectBN(arg1.value, message).to.eq(arg2.value);
}
