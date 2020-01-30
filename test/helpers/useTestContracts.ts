import { Perpetual } from '../../src/Perpetual';

import { address } from '../../src/lib/types';

export async function useTestContracts(
  perpetual: Perpetual,
  accounts: address[],
) {
  await perpetual.contracts.call(
    perpetual.contracts.perpetualV1.methods.setFunder(
      perpetual.contracts.testP1Funder.options.address,
    ),
    { from: accounts[0] },
  );
  await perpetual.contracts.call(
    perpetual.contracts.perpetualV1.methods.setOracle(
      perpetual.contracts.testP1Oracle.options.address,
    ),
    { from: accounts[0] },
  );
}
