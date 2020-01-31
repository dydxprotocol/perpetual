import { Perpetual } from '../../src/Perpetual';

import { address } from '../../src/lib/types';

export default async function initializeWithTestContracts(
  perpetual: Perpetual,
  accounts: address[],
) {
  await perpetual.contracts.send(
    perpetual.contracts.perpetualV1.methods.initializeV1(
      perpetual.contracts.testToken.options.address,
      perpetual.contracts.testP1Oracle.options.address,
      perpetual.contracts.testP1Funder.options.address,
      '1100000000000000000', // minCollateral
    ),
    { from: accounts[0] },
  );
}
