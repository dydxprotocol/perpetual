require('dotenv-flow').config();

import { Perpetual } from '../../src/Perpetual';
import { provider } from './Provider';

export const perpetual = new Perpetual(
  provider,
  Number(process.env.NETWORK_ID),
);

export const getPerpetual = async () => {
  return {
    perpetual: Perpetual,
  };
};
