import srcConfig, { IConfig } from '../src/config';

export interface ITestConfig extends IConfig {
  ENABLE_SOL_TRACE: boolean;
  enableDebugTools: boolean;
}

const config: ITestConfig = {
  ...srcConfig,
  ENABLE_SOL_TRACE: process.env.ENABLE_SOL_TRACE === 'true',
  enableDebugTools: process.env.ENABLE_SOL_TRACE === 'true',
};

export default config;
