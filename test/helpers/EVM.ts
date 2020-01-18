import { perpetual } from './Perpetual';

export async function resetEVM(id?: string) {
  await perpetual.testing.evm.resetEVM(id || process.env.RESET_SNAPSHOT_ID);
}

export async function mineAvgBlock() {
  // Increase time so that tests must update the index
  await perpetual.testing.evm.increaseTime(15);
  await perpetual.testing.evm.mineBlock();
}

export async function snapshot() {
  return perpetual.testing.evm.snapshot();
}

export async function fastForward(seconds: number) {
  await perpetual.testing.evm.increaseTime(seconds);
  await perpetual.testing.evm.mineBlock();
}
