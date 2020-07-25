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


/**
 * @title I_MakerOracle
 * @author dYdX
 *
 * Interface for the MakerDAO Oracles V2 smart contrats.
 */
interface I_MakerOracle {

    // ============ Getter Functions ============

    // Returns the current value (e.g. BTC/USD * 10**20) as a bytes32.
    function peek()
        external
        view
        returns (bytes32, bool);

    // Requires a fresh price and then returns the current value.
    function read()
        external
        view
        returns (bytes32);

    // Returns the number of signers per poke.
    function bar()
        external
        view
        returns (uint256);

    // Returns the timetamp of the last update.
    function age()
        external
        view
        returns (uint32);

    // ============ State-Changing Functions ============

    // Updates the value of the oracle
    function poke(
        uint256[] calldata val_,
        uint256[] calldata age_,
        uint8[] calldata v,
        bytes32[] calldata r,
        bytes32[] calldata s
    )
        external;
}
