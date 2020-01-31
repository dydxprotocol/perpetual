import { ITestContext } from './perpetualDescribe';

export default async function initializeWithTestContracts(ctx: ITestContext): Promise<void> {
  await ctx.perpetual.contracts.send(
    ctx.perpetual.contracts.perpetualV1.methods.initializeV1(
      ctx.perpetual.contracts.testToken.options.address,
      ctx.perpetual.contracts.testP1Oracle.options.address,
      ctx.perpetual.contracts.testP1Funder.options.address,
      '1100000000000000000', // minCollateral
    ),
    { from: ctx.accounts[0] },
  );
  await ctx.perpetual.contracts.send(
    ctx.perpetual.contracts.perpetualV1.methods.setGlobalOperator(
      ctx.perpetual.contracts.testP1Trader.options.address,
      true, // approved
    ),
    { from: ctx.accounts[0] },
  );
}
