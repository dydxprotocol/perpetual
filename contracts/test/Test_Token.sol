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

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


/**
 * @title Test_Token
 * @author dYdX
 *
 * ERC20 token for testing
 */
contract Test_Token is IERC20 {
    using SafeMath for uint256;

    uint256 supply;
    mapping (address => uint256) balances;
    mapping (address => mapping (address => uint256)) allowed;

    event Mint(address owner, uint256 value);

    function mintTo(address who, uint256 amount) external {
        supply = supply.add(amount);
        balances[who] = balances[who].add(amount);
        emit Mint(who, amount);
        emit Transfer(address(0), who, amount);
    }

    function totalSupply() external view returns (uint256) {
        return supply;
    }

    function balanceOf(address who) external view returns (uint256) {
        return balances[who];
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return allowed[owner][spender];
    }

    function symbol() external pure returns (string memory) {
        return "TEST";
    }

    function name() external pure returns (string memory) {
        return "Test Token";
    }

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        if (balances[msg.sender] >= value) {
            balances[msg.sender] = balances[msg.sender].sub(value);
            balances[to] = balances[to].add(value);
            emit Transfer(
                msg.sender,
                to,
                value
            );
            return true;
        } else {
            return false;
        }
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        if (balances[from] >= value && allowed[from][msg.sender] >= value) {
            balances[to] = balances[to].add(value);
            balances[from] = balances[from].sub(value);
            allowed[from][msg.sender] = allowed[from][msg.sender].sub(value);
            emit Transfer(
                from,
                to,
                value
            );
            return true;
        } else {
            return false;
        }
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowed[msg.sender][spender] = value;
        emit Approval(
            msg.sender,
            spender,
            value
        );
        return true;
    }
}
