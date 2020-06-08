import { BaseValue, BigNumberable, address } from '../../src';
import { ITestContext } from './perpetualDescribe';

export interface PerpetualOptions {
  token?: address;
  oracle?: address;
  funder?: address;
  minCollateral?: BigNumberable;
}

/**
 * Initialize the perpetual smart contract, using test contracts by default.
 */
export default async function initializePerpetual(
  ctx: ITestContext,
  options: PerpetualOptions = {},
): Promise<void> {
  await ctx.perpetual.contracts.send(
    ctx.perpetual.contracts.perpetualV1.methods.initializeV1(
      options.token || ctx.perpetual.contracts.testToken.options.address,
      options.oracle || ctx.perpetual.testing.oracle.address,
      options.funder || ctx.perpetual.testing.funder.address,
      options.minCollateral || new BaseValue('1.1').toSolidity(), // minCollateral
    ),
    { from: ctx.accounts[0] },
  );
}
