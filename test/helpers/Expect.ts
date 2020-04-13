import chai from 'chai';
import BigNumber from 'bignumber.js';
chai.use(require('chai-bignumber')(BigNumber));

import { address, BaseValue, BigNumberable } from '../../src/lib/types';

const REQUIRE_MSG = 'Returned error: VM Exception while processing transaction: revert';
const ASSERT_MSG = 'Returned error: VM Exception while processing transaction: invalid opcode';

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

/**
 * Compare two BaseValue's according to the precision level used in Solidity (18 decimals).
 */
export function expectBaseValueEqual(arg1: BaseValue, arg2: BaseValue, message?: string) {
  const value1 = arg1.value.decimalPlaces(18);
  const value2 = arg2.value.decimalPlaces(18);
  expectBN(value1, message).to.equal(value2);
}

/**
 * Compare two BaseValue's according to the precision level used in Solidity (18 decimals).
 */
export function expectBaseValueNotEqual(arg1: BaseValue, arg2: BaseValue, message?: string) {
  const value1 = arg1.value.decimalPlaces(18);
  const value2 = arg2.value.decimalPlaces(18);
  expectBN(value1, message).not.to.equal(value2);
}
