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

import { I_P1Vault } from "../../protocol/v1/intf/I_P1Vault.sol";

/**
 * @title Test_P1Vault
 * @author dYdX
 *
 * P1Vault for testing
 */
contract Test_P1Vault is
    I_P1Vault
{
    function deposit(
        address from
    )
        external
    {
        // TODO
    }

    function withdraw(
        address to
    )
        external
    {
        // TODO
    }

    function getBalance()
        external
        view
        returns (uint256)
    {
        // TODO
        return 0;
    }
}
