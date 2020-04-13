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

import { I_MakerOracle } from "../../../external/maker/I_MakerOracle.sol";
import { BaseMath } from "../../lib/BaseMath.sol";
import { I_P1Oracle } from "../intf/I_P1Oracle.sol";


/**
 * @title P1MakerOracle
 * @author dYdX
 *
 * @notice P1Oracle that reads the price from a Maker V2 Oracle.
 */
contract P1MakerOracle is
    I_P1Oracle
{
    using BaseMath for uint256;

    // ============ Storage ============

    address public _ORACLE_ADDRESS_;

    address public _PERPETUAL_V1_;

    uint256 public _ADJUSTMENT_;

    // ============ Constructor ============

    constructor(
        address perpetualV1,
        address oracleAddress,
        uint256 adjustment
    )
        public
    {
        _PERPETUAL_V1_ = perpetualV1;
        _ORACLE_ADDRESS_ = oracleAddress;
        _ADJUSTMENT_ = adjustment;
    }

    // ============ Public Functions ============

    /**
     * @notice Returns the price of the underlying asset relative to the margin token.
     * @return The price as a fixed-point number with 18 decimals.
     */
    function getPrice()
        external
        view
        returns (uint256)
    {
        require(
            msg.sender == _PERPETUAL_V1_,
            "msg.sender must be PerpetualV1"
        );
        uint256 rawPrice = uint256(I_MakerOracle(_ORACLE_ADDRESS_).read());
        return rawPrice.baseMul(_ADJUSTMENT_);
    }
}
