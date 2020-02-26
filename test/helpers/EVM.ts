import config from '../config';
import { getPerpetual } from './Perpetual';

export async function resetEVM(id?: string) {
  const perpetual = await getPerpetual();
  await perpetual.testing.evm.resetEVM(id || config.RESET_SNAPSHOT_ID);
}

export async function mineAvgBlock() {
  // Increase time to ensure the index gets updated during tests.
  const perpetual = await getPerpetual();
  await perpetual.testing.evm.increaseTime(15);
  await perpetual.testing.evm.mineBlock();
}

export async function snapshot() {
  const perpetual = await getPerpetual();
  return perpetual.testing.evm.snapshot();
}

export async function fastForward(seconds: number) {
  const perpetual = await getPerpetual();
  await perpetual.testing.evm.increaseTime(seconds);
  await perpetual.testing.evm.mineBlock();
}
