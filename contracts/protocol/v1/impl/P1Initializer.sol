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

import { Initializable } from "@openzeppelin/upgrades/contracts/Initializable.sol";
import { P1Storage } from "./P1Storage.sol";
import { P1Types } from "../lib/P1Types.sol";


/**
 * @title P1Initializer
 * @author dYdX
 *
 * Initializer contract
 */
contract P1Initializer is
    Initializable,
    P1Storage
{
    function initialize()
        public
        initializer
        payable
    {
        _INDEX_ = P1Types.Index({
            positive: 10**18,
            negative: 10**18,
            timestamp: uint32(block.timestamp)
        });
    }
}
