/*

    Copyright 2020 dYdX Trading Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

*/

pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import { Ownable } from "@openzeppelin/contracts/ownership/Ownable.sol";
import { P1Storage } from "./P1Storage.sol";
import { I_P1Funder } from "../intf/I_P1Funder.sol";
import { I_P1Oracle } from "../intf/I_P1Oracle.sol";
import { I_P1Vault } from "../intf/I_P1Vault.sol";


/**
 * @title P1Admin
 * @author dYdX
 *
 * Admin logic contract
 */
contract P1Admin is
    P1Storage,
    Ownable
{
    // ============ Events ============

    event LogSetOperator(
        address operator,
        bool approved
    );

    event LogSetOracle(
        I_P1Oracle oracle
    );

    event LogSetFunder(
        I_P1Funder funder
    );

    event LogSetVault(
        I_P1Vault vault
    );

    // ============ Functions ============

    function setOperator(
        address operator,
        bool approved
    )
        public
        onlyOwner
    {
        _OPERATORS_[operator] = approved;
        emit LogSetOperator(operator, approved);
    }

    function setOracle(
        I_P1Oracle oracle
    )
        public
        onlyOwner
    {
        _ORACLE_ = oracle;
        emit LogSetOracle(oracle);
    }

    function setFunder(
        I_P1Funder funder
    )
        public
        onlyOwner
    {
        _FUNDER_ = funder;
        emit LogSetFunder(funder);
    }

    function setVault(
        I_P1Vault vault
    )
        public
        onlyOwner
    {
        _VAULT_ = vault;
        emit LogSetVault(vault);
    }
}
