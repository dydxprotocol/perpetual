import Web3 from 'web3';

import { Contracts } from './Contracts';
import { Orders } from './Orders';

const EIP712_DOMAIN_NAME = 'P1InverseOrders';

export class InverseOrders extends Orders {
  constructor(
    contracts: Contracts,
    web3: Web3,
  ) {
    super(contracts, web3, EIP712_DOMAIN_NAME, contracts.p1InverseOrders);
  }
}
