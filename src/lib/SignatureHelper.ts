import Web3 from 'web3';
import { stripHexPrefix, combineHexStrings } from './BytesHelper';
import { address } from './types';

export enum SIGNATURE_TYPES {
  NO_PREPEND = 0,
  DECIMAL = 1,
  HEXADECIMAL = 2,
}

export const PREPEND_DEC: string =
  '\x19Ethereum Signed Message:\n32';

export const PREPEND_HEX: string =
  '\x19Ethereum Signed Message:\n\x20';

export const EIP712_DOMAIN_STRING: string =
  'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)';

export const EIP712_DOMAIN_STRUCT = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];

export function isValidSigType(
  sigType: number,
): boolean {
  switch (sigType) {
    case SIGNATURE_TYPES.NO_PREPEND:
    case SIGNATURE_TYPES.DECIMAL:
    case SIGNATURE_TYPES.HEXADECIMAL:
      return true;
    default:
      return false;
  }
}

export function getPrependedHash(
  hash: string,
  sigType: SIGNATURE_TYPES,
): string {
  switch (sigType) {
    case SIGNATURE_TYPES.NO_PREPEND:
      return hash;
    case SIGNATURE_TYPES.DECIMAL:
      return Web3.utils.soliditySha3(
        { t: 'string', v: PREPEND_DEC },
        { t: 'bytes32', v: hash },
      );
    case SIGNATURE_TYPES.HEXADECIMAL:
      return Web3.utils.soliditySha3(
        { t: 'string', v: PREPEND_HEX },
        { t: 'bytes32', v: hash },
      );
    default:
      throw Error(`invalid sigType ${sigType}`);
  }
}

export function ecRecoverTypedSignature(
  hash: string,
  typedSignature: string,
): address {
  if (stripHexPrefix(typedSignature).length !== 66 * 2) {
    return '0x'; // return invalid address instead of throwing error
  }

  const sigType = parseInt(typedSignature.slice(-2), 16);

  let prependedHash: string;
  try {
    prependedHash = getPrependedHash(hash, sigType);
  } catch (e) {
    return '0x'; // return invalid address instead of throwing error
  }

  const signature = typedSignature.slice(0, -2);

  return new Web3().eth.accounts.recover(
    prependedHash,
    signature,
    true, // hash is already prepended
  );
}

export function createTypedSignature(
  signature: string,
  sigType: number,
): string {
  if (!isValidSigType(sigType)) {
    throw new Error(`Invalid signature type: ${sigType}`);
  }
  return `${fixRawSignature(signature)}0${sigType}`;
}

/**
 * Fixes any signatures that don't have a 'v' value of 27 or 28
 */
export function fixRawSignature(
  signature: string,
): string {
  const { v, r, s } = signatureToVRS(signature);

  let trueV: string;
  switch (v) {
    case '00':
      trueV = '1b';
      break;
    case '01':
      trueV = '1c';
      break;
    case '1b':
    case '1c':
      trueV = v;
      break;
    default:
      throw new Error(`Invalid v value: ${v}`);
  }

  return combineHexStrings(r, s, trueV);
}

export function signatureToVRS(
  signature: string,
): {
  v: string,
  r: string,
  s:string,
} {
  const stripped = stripHexPrefix(signature);

  if (stripped.length !== 130) {
    throw new Error(`Invalid raw signature: ${signature}`);
  }

  const r = stripped.substr(0, 64);
  const s = stripped.substr(64, 64);
  const v = stripped.substr(128, 2);

  return { v, r, s };
}
