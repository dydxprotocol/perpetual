require('dotenv-flow').config();

export interface IConfig {
  COVERAGE: boolean;
  RESET_SNAPSHOT_ID: string;
}

const config: IConfig = {
  COVERAGE: process.env.COVERAGE === 'true',
  RESET_SNAPSHOT_ID: process.env.RESET_SNAPSHOT_ID,
};

export default config;
