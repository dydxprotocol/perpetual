import { EVM } from '../modules/EVM';
import provider from './Provider';

const evm = new EVM(provider);

export async function resetEVM(id?: string) {
  await evm.resetEVM(id || process.env.RESET_SNAPSHOT_ID);
}

export async function mineAvgBlock() {
  await evm.increaseTime(15);
  await evm.mineBlock();
}

export async function snapshot() {
  return evm.snapshot();
}

export async function fastForward(seconds: number) {
  await evm.increaseTime(seconds);
  await evm.mineBlock();
}
