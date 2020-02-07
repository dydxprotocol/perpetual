import chai from 'chai';
import BigNumber from 'bignumber.js';
chai.use(require('chai-bignumber')(BigNumber));

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

export function expect(item: any): Chai.Assertion {
  return chai.expect(item);
}

export function expectBN(bn: BigNumber, message?: string): Chai.Assertion {
  return (chai.expect(bn, message) as any).to.be.bignumber;
}
