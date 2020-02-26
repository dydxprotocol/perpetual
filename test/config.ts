import srcConfig, { IConfig } from '../src/config';

export interface ITestConfig extends IConfig {
  DEBUG_GAS_USAGE_BY_FUNCTION: boolean;
  ENABLE_SOL_TRACE: boolean;
  enableDebugTools: boolean;
}

const config: ITestConfig = {
  ...srcConfig,
  DEBUG_GAS_USAGE_BY_FUNCTION: process.env.DEBUG_GAS_USAGE_BY_FUNCTION === 'true',
  ENABLE_SOL_TRACE: process.env.ENABLE_SOL_TRACE === 'true',
  enableDebugTools: process.env.ENABLE_SOL_TRACE === 'true',
};

export default config;
