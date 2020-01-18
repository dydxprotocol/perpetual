import { expect } from 'chai';
import { snapshot, resetEVM } from './helpers/EVM';
import { perpetual } from './helpers/Perpetual';

describe('Perpetual', () => {
  let snapshotId: string;

  before(async () => {
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  it('Succeeds', async () => {
    const id = await perpetual.contracts.perpetual.methods.getId().call();
    expect(id).to.equal('1');
  });
});
