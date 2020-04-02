import _ from 'lodash';
import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';

import { Contracts } from '../../src/modules/Contracts';
import {
  Provider,
  address,
} from '../../src/lib/types';

// JSON
const jsonFolder = `../../${process.env.COVERAGE ? '.coverage_artifacts' : 'build'}/contracts/`;
const testLibJson = require(`${jsonFolder}Test_Lib.json`);
const testP1FunderJson = require(`${jsonFolder}Test_P1Funder.json`);
const testP1MonolithJson = require(`${jsonFolder}Test_P1Monolith.json`);
const testP1OracleJson = require(`${jsonFolder}Test_P1Oracle.json`);
const testP1TraderJson = require(`${jsonFolder}Test_P1Trader.json`);
const testTokenJson = require(`${jsonFolder}Test_Token.json`);
const testMakerOracleJson = require(`${jsonFolder}Test_MakerOracle.json`);

export class TestContracts extends Contracts {
  private testContractsList: { contract: Contract, json: any }[] = [];

  // Test contract instances
  public testLib: Contract;
  public testP1Funder: Contract;
  public testP1Monolith: Contract;
  public testP1Oracle: Contract;
  public testP1Trader: Contract;
  public testToken: Contract;
  public testMakerOracle: Contract;

  constructor(
    provider: Provider,
    networkId: number,
    web3: Web3,
  ) {
    super(provider, networkId, web3);

    // Test contracts
    this.testLib = this.addTestContract(testLibJson);
    this.testP1Funder = this.addTestContract(testP1FunderJson);
    this.testP1Monolith = this.addTestContract(testP1MonolithJson);
    this.testP1Oracle = this.addTestContract(testP1OracleJson);
    this.testP1Trader = this.addTestContract(testP1TraderJson);
    this.testToken = this.addTestContract(testTokenJson);
    this.testMakerOracle = this.addTestContract(testMakerOracleJson);

    this.setProvider(provider, networkId);
    this.setDefaultAccount(this.web3.eth.defaultAccount);
  }

  public setProvider(
    provider: Provider,
    networkId: number,
  ): void {
    super.setProvider(provider, networkId);
    if (this.testContractsList) {
      this.testContractsList.forEach(
        contract => this.setContractProvider(
          contract.contract,
          contract.json,
          provider,
          networkId,
        ),
      );
    }
  }

  public setDefaultAccount(
    account: address,
  ): void {
    super.setDefaultAccount(account);
    if (this.testContractsList) {
      this.testContractsList.forEach(
        contract => contract.contract.options.from = account,
      );
    }
  }

  /**
   * Add the contract to the test contract list.
   *
   * Won't add to the base class contract list, so test contracts won't be used for parsing logs
   * and won't be included in gas usage stats.
   */
  private addTestContract(json: { abi: AbiItem }): Contract {
    const contract = new this.web3.eth.Contract(json.abi);
    this.testContractsList.push({ contract, json });
    return contract;
  }
}
