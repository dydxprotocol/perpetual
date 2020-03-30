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

import { I_MakerOracle } from "../../external/maker/I_MakerOracle.sol";


/**
 * @title Test_MakerOracle
 * @author dYdX
 *
 * MakerOracle for testing
 */
/* solium-disable-next-line camelcase */
contract Test_MakerOracle is
    I_MakerOracle
{
    uint256 public _PRICE_ = 0;
    bool public _VALID_ = true;

    // ============ Set Functions ============

    function setPrice(
        uint256 newPrice
    )
        external
    {
        _PRICE_ = newPrice;
    }

    function setValidity(
        bool valid
    )
        external
    {
        _VALID_ = valid;
    }

    // ============ Get Functions ============

    function read()
        external
        view
        returns (bytes32)
    {
        require(
            _VALID_,
            "Median/invalid-price-feed"
        );
        return bytes32(_PRICE_);
    }

    function peek()
        external
        view
        returns (bytes32, bool)
    {
        return (bytes32(_PRICE_), _VALID_);
    }
}
