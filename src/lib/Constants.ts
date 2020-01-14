import BigNumber from 'bignumber.js';

const ONE_MINUTE_IN_SECONDS = new BigNumber(60);
const ONE_HOUR_IN_SECONDS = ONE_MINUTE_IN_SECONDS.times(60);
const ONE_DAY_IN_SECONDS = ONE_HOUR_IN_SECONDS.times(24);
const ONE_YEAR_IN_SECONDS = ONE_DAY_IN_SECONDS.times(365);

export const INTEGERS = {
  ONE_MINUTE_IN_SECONDS,
  ONE_HOUR_IN_SECONDS,
  ONE_DAY_IN_SECONDS,
  ONE_YEAR_IN_SECONDS,
  ZERO: new BigNumber(0),
  ONE: new BigNumber(1),
};

export const ADDRESSES = {
  ZERO: '0x0000000000000000000000000000000000000000',
  TEST: [
    '0x06012c8cf97bead5deae237070f9587f8e7a266d',
    '0x22012c8cf97bead5deae237070f9587f8e7a266d',
    '0x33012c8cf97bead5deae237070f9587f8e7a266d',
    '0x44012c8cf97bead5deae237070f9587f8e7a266d',
    '0x55012c8cf97bead5deae237070f9587f8e7a266d',
    '0x66012c8cf97bead5deae237070f9587f8e7a266d',
    '0x77012c8cf97bead5deae237070f9587f8e7a266d',
    '0x88012c8cf97bead5deae237070f9587f8e7a266d',
    '0x99012c8cf97bead5deae237070f9587f8e7a266d',
    '0xaa012c8cf97bead5deae237070f9587f8e7a266d',
  ],
};
