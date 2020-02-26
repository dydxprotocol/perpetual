require('dotenv-flow').config();

export interface IConfig {
  DEBUG_GAS_USAGE_BY_FUNCTION: boolean;
  COVERAGE: boolean;
  RESET_SNAPSHOT_ID: string;
}

const config: IConfig = {
  COVERAGE: process.env.COVERAGE === 'true',
  DEBUG_GAS_USAGE_BY_FUNCTION: process.env.DEBUG_GAS_USAGE_BY_FUNCTION === 'true',
  RESET_SNAPSHOT_ID: process.env.RESET_SNAPSHOT_ID,
};

export default config;
