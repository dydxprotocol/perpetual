<p align="center"><img src="https://s3.amazonaws.com/dydx-assets/logo_large_white.png" width="256" /></p>

<div align="center">
  <a href="https://circleci.com/gh/dydxprotocol/workflows/perpetual/tree/master" style="text-decoration:none;">
    <img src="https://img.shields.io/circleci/project/github/dydxprotocol/perpetual.svg" alt='CI Status' />
  </a>
  <a href='https://www.npmjs.com/package/@dydxprotocol/perpetual' style="text-decoration:none;">
    <img src='https://img.shields.io/npm/v/@dydxprotocol/perpetual.svg' alt='NPM' />
  </a>
  <a href='https://coveralls.io/github/dydxprotocol/perpetual' style="text-decoration:none;">
    <img src='https://coveralls.io/repos/github/dydxprotocol/perpetual/badge.svg?t=cPGDk7' alt='Coverage Status' />
  </a>
  <a href='https://github.com/dydxprotocol/perpetual/blob/master/LICENSE' style="text-decoration:none;">
    <img src='https://img.shields.io/github/license/dydxprotocol/protocol.svg?longCache=true' alt='License' />
  </a>
  <a href='https://t.me/joinchat/GBnMlBb9mQblQck2pThTgw' style="text-decoration:none;">
    <img src='https://img.shields.io/badge/chat-on%20telegram-9cf.svg?longCache=true' alt='Telegram' />
  </a>
</div>

> Ethereum Smart Contracts and TypeScript client library for the dYdX Perpetual Contracts Protocol. Currently used by [trade.dydx.exchange](https://trade.dydx.exchange).

**Full Documentation at [docs.dydx.exchange](https://docs.dydx.exchange).**

## Table of Contents

 - [Documentation](#documentation)
 - [Install](#install)
 - [Contracts](#contracts)
 - [Security](#security)
 - [Development](#development)
 - [Maintainers](#maintainers)
 - [License](#license)

## Documentation

Check out our full documentation at [docs.dydx.exchange](https://docs.dydx.exchange):
* [Protocol Overview](https://docs.dydx.exchange/#/perpetual-protocol)
* [Perpetual Guide and Contract Specification](https://docs.dydx.exchange/#/perpetual-guide)

## Install

`npm i -s @dydxprotocol/perpetual`

## Contracts

### Mainnet

|Contract Name|Description|Address|
|---|---|---|
|[`PerpetualProxy`](contracts/protocol/PerpetualProxy.sol)|Proxy contract and entrypoint for the core protocol|[0x07aBe965500A49370D331eCD613c7AC47dD6e547](https://etherscan.io/address/0x07aBe965500A49370D331eCD613c7AC47dD6e547)|
|[`PerpetualV1`](contracts/protocol/v1/PerpetualV1.sol)|Upgradeable logic contract for the core protocol|[0xE883b3efdaE637fC599b467478a23199778F2cCf](https://etherscan.io/address/0xE883b3efdaE637fC599b467478a23199778F2cCf)|
|[`P1FundingOracle`](contracts/protocol/v1/oracles/P1FundingOracle.sol)|Funding rate oracle|[0x4525D2B71f7f018c9EBddFcD336852A85404e75B](https://etherscan.io/address/0x4525D2B71f7f018c9EBddFcD336852A85404e75B)|
|[`P1MakerOracle`](contracts/protocol/v1/oracles/P1MakerOracle.sol)|Price oracle|[0x538038E526517680735568f9C5342c6E68bbDA12](https://etherscan.io/address/0x538038E526517680735568f9C5342c6E68bbDA12)|
|[`P1Orders`](contracts/protocol/v1/traders/P1Orders.sol)|Trader contract for limit and stop-limit orders|[0x3ea6F88eC8F7b24Bb3Ad206fa80124210e8e28F3](https://etherscan.io/address/0x3ea6F88eC8F7b24Bb3Ad206fa80124210e8e28F3)|
|[`P1Liquidation`](contracts/protocol/v1/traders/P1Liquidation.sol)|Trader contract for liquidations|[0x18Ba3F12f9d3699dE7D451cA97ED55Cd33DD0f80](https://etherscan.io/address/0x18Ba3F12f9d3699dE7D451cA97ED55Cd33DD0f80)|
|[`P1LiquidationProxy`](contracts/protocol/v1/traders/P1Liquidation.sol)|Proxy contract for doing liquidations that contribute to an insurance fund|[0x51C72bEfAe54D365A9D0C08C486aee4F99285e08](https://etherscan.io/address/0x51C72bEfAe54D365A9D0C08C486aee4F99285e08)|
|[`P1Deleveraging`](contracts/protocol/v1/traders/P1Deleveraging.sol)|Trader contract for deleveraging|[0x9C6C96727d1Cf2F183a8ef77E274621F26D728f8](https://etherscan.io/address/0x9C6C96727d1Cf2F183a8ef77E274621F26D728f8)|

## Security

### Independent Audits

The smart contracts were audited independently by
[Zeppelin Solutions](https://zeppelin.solutions/) at commit [`c5e2b0e`](https://github.com/dydxprotocol/perpetual/tree/c5e2b0e58aaf532d2c8b1f658d1df2f6a3385318/contracts), excluding [`P1Orders.sol`](contracts/protocol/v1/P1Orders.sol).

**[Zeppelin Solutions Audit Report](https://blog.openzeppelin.com/dydx-perpetual-audit/)**

### Code Coverage

All production smart contracts are tested and have 100% line and branch coverage.

### Vulnerability Disclosure Policy

The disclosure of security vulnerabilities helps us ensure the security of our users.

**How to report a security vulnerability?**

If you believe you’ve found a security vulnerability in one of our contracts or platforms,
send it to us by emailing [security@dydx.exchange](mailto:security@dydx.exchange).
Please include the following details with your report:

* A description of the location and potential impact of the vulnerability.

* A detailed description of the steps required to reproduce the vulnerability.

**Scope**

Any vulnerability not previously disclosed by us or our independent auditors in their reports.

**Guidelines**

We require that all reporters:

* Make every effort to avoid privacy violations, degradation of user experience,
disruption to production systems, and destruction of data during security testing.

* Use the identified communication channels to report vulnerability information to us.

* Keep information about any vulnerabilities you’ve discovered confidential between yourself and
dYdX until we’ve had 30 days to resolve the issue.

If you follow these guidelines when reporting an issue to us, we commit to:

* Not pursue or support any legal action related to your findings.

* Work with you to understand and resolve the issue quickly
(including an initial confirmation of your report within 72 hours of submission).

* Grant a monetary reward based on the [OWASP risk assessment methodology](https://medium.com/dydxderivatives/announcing-bug-bounties-for-the-dydx-margin-trading-protocol-d0c817d1cda4).


## Development

### Compile Contracts

Requires a running [docker](https://docker.com) engine.

`npm run build`

### Compile TypeScript

`npm run build:js`

### Test

Requires a running [docker](https://docker.com) engine.

**Start test node:**

`docker-compose up`

**Deploy contracts to test node & run tests:**

`npm test`

**Just run tests (contracts must already be deployed to test node):**

`npm run test_only`

**Just deploy contracts to test node:**

`npm run deploy_test`

## Maintainers

 - **Brendan Chou**
 [@brendanchou](https://github.com/BrendanChou)
 [`brendan@dydx.exchange`](mailto:brendan@dydx.exchange)

 - **Ken Schiller**
 [@kenadia](https://github.com/Kenadia)
 [`ken@dydx.exchange`](mailto:ken@dydx.exchange)

## License

[Apache-2.0](./blob/master/LICENSE)
