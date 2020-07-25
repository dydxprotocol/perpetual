import { expect } from './helpers/Expect';
import initializePerpetual from './helpers/initializePerpetual';
import { ITestContext, perpetualDescribe } from './helpers/perpetualDescribe';

perpetualDescribe('Function Signatures', initializePerpetual, (ctx: ITestContext) => {
  it('Checks for collisions', async () => {
    const signatures = {};

    // For each contract...
    ctx.perpetual.contracts.contractsList.forEach((contractInfo) => {

      // For each method...
      for (const method in contractInfo.contract.methods) {
        // Ignore non-function-signatures.
        if (!isFunctionSignature(method)) {
          continue;
        }

        // Get the four-byte solidity function signature.
        const fourByte = toFourByte(method);

        // Expect no collision.
        if (signatures[fourByte]) {
          expect(signatures[fourByte]).equals(
            method,
            `colliding four-byte signatures for ${signatures[fourByte]} and ${method}`,
          );
        }

        // Save the function signature in the signature mapping.
        signatures[fourByte] = method;
      }
    });
  });

  function toFourByte(method: string): string {
    return ctx.perpetual.web3.utils.keccak256(method).substr(0, 10).toLowerCase();
  }

  function isFunctionSignature(method: string): boolean {
    return method.includes('(') && method.includes(')');
  }
});
