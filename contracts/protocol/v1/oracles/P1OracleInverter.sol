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

import { BaseMath } from "../../lib/BaseMath.sol";
import { I_P1Oracle } from "../intf/I_P1Oracle.sol";


/**
 * @title P1OracleInverter
 * @author dYdX
 *
 * @notice P1Oracle that returns the inverted price (i.e. flips base and quote currencies) of
 * another P1Oracle.
 */
contract P1OracleInverter is
    I_P1Oracle
{
    using BaseMath for uint256;

    // ============ Storage ============

    // The underlying P1Oracle to get and invert the price of.
    address public _ORACLE_;

    // The address with permission to get the oracle price.
    address public _READER_;

    // A constant factor to adjust the price by, as a fixed-point number with 18 decimal places.
    uint256 public _ADJUSTMENT_;

    // ============ Constructor ============

    constructor(
        address oracle,
        address reader,
        uint256 adjustment
    )
        public
    {
        _ORACLE_ = oracle;
        _READER_ = reader;
        _ADJUSTMENT_ = adjustment;
    }

    // ============ Public Functions ============

    /**
     * @notice Returns the oracle price, inverted.
     *
     * @return The inverted price as a fixed-point number with 18 decimals.
     */
    function getPrice()
        external
        view
        returns (uint256)
    {
        require(
            msg.sender == _READER_,
            "P1OracleInverter: Sender not authorized to get price"
        );
        uint256 rawPrice = I_P1Oracle(_ORACLE_).getPrice();
        uint256 invertedPrice = rawPrice.baseReciprocal();
        uint256 result = invertedPrice.baseMul(_ADJUSTMENT_);
        return result;
    }
}
