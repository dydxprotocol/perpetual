import BigNumber from 'bignumber.js';
import Web3 from 'web3';

import { address, BigNumberable } from './types';

export function combineHexStrings(...args: string[]): string {
  return `0x${args.map(stripHexPrefix).join('')}`;
}

export function addressToBytes32(input: address): string {
  return `0x000000000000000000000000${ stripHexPrefix(input) }`;
}

export function bnToBytes32(bn: BigNumberable): string {
  return `0x${new BigNumber(bn).toString(16).padStart(64, '0')}`;
}

export function boolToBytes32(b: boolean): string {
  return `0x${ '0'.repeat(63) }${ b ? '1' : 0 }`;
}

export function hashString(input: string) {
  return Web3.utils.soliditySha3({ t: 'string', v: input });
}

export function hashBytes(input: string) {
  // javascript soliditySha3 has a problem with empty bytes arrays, so manually return the same
  // value that solidity does for keccak256 of an empty bytes array
  if (!stripHexPrefix(input)) {
    return '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';
  }
  return Web3.utils.soliditySha3({ t: 'bytes', v: `0x${ stripHexPrefix(input) }` });
}

export function stripHexPrefix(input: string) {
  if (input.startsWith('0x')) {
    return input.slice(2);
  }
  return input;
}

export function addressesAreEqual(
  addressOne: string,
  addressTwo: string,
): boolean {
  return addressOne && addressTwo &&
    (stripHexPrefix(addressOne).toLowerCase() === stripHexPrefix(addressTwo).toLowerCase());
}
