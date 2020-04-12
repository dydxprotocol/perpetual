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

pragma solidity 0.6.6;
pragma experimental ABIEncoderV2;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";


/**
 * @title Test_Token
 * @author dYdX
 *
 * ERC20 token for testing
 */
/* solium-disable-next-line camelcase */
contract Test_Token is
    ERC20("Test Token", "TEST")
{
    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}
