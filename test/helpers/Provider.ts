require('dotenv-flow').config();

import Web3 from 'web3';

export default new Web3.providers.HttpProvider(process.env.RPC_NODE_URI);
