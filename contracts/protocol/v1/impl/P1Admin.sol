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

import { P1Storage } from "./P1Storage.sol";
import { BaseMath } from "../../lib/BaseMath.sol";
import { I_P1Funder } from "../intf/I_P1Funder.sol";
import { I_P1Oracle } from "../intf/I_P1Oracle.sol";


/**
 * @title P1Admin
 * @author dYdX
 *
 * Admin logic contract
 */
contract P1Admin is
    P1Storage
{
    // ============ Events ============

    event LogSetGlobalOperator(
        address operator,
        bool approved
    );

    event LogSetOracle(
        address oracle
    );

    event LogSetFunder(
        address funder
    );

    event LogSetMinCollateral(
        uint256 minCollateral
    );

    // ============ Functions ============

    function setGlobalOperator(
        address operator,
        bool approved
    )
        external
        onlyAdmin
        nonReentrant
    {
        _GLOBAL_OPERATORS_[operator] = approved;
        emit LogSetGlobalOperator(operator, approved);
    }

    function setOracle(
        address oracle
    )
        external
        onlyAdmin
        nonReentrant
    {
        require(
            I_P1Oracle(oracle).getPrice() != 0,
            "New oracle cannot return a zero price"
        );
        _ORACLE_ = oracle;
        emit LogSetOracle(oracle);
    }

    function setFunder(
        address funder
    )
        external
        onlyAdmin
        nonReentrant
    {
        // call getFunding to ensure that no reverts occur
        I_P1Funder(funder).getFunding(0);

        _FUNDER_ = funder;
        emit LogSetFunder(funder);
    }

    function setMinCollateral(
        uint256 minCollateral
    )
        external
        onlyAdmin
        nonReentrant
    {
        require(
            minCollateral >= BaseMath.base(),
            "The collateral requirement cannot be under 100%"
        );
        _MIN_COLLATERAL_ = minCollateral;
        emit LogSetMinCollateral(minCollateral);
    }
}
