import { BaseValue } from '../../src';
import { ITestContext } from './perpetualDescribe';

export default async function initializeWithTestContracts(ctx: ITestContext): Promise<void> {
  const chainId = await ctx.perpetual.web3.eth.net.getId();
  await ctx.perpetual.contracts.send(
    ctx.perpetual.contracts.perpetualV1.methods.initializeV1(
      chainId,
      ctx.perpetual.contracts.testToken.options.address,
      ctx.perpetual.contracts.testP1Oracle.options.address,
      ctx.perpetual.contracts.testP1Funder.options.address,
      new BaseValue('1.1').toSolidity(), // minCollateral
    ),
    { from: ctx.accounts[0] },
  );
}
