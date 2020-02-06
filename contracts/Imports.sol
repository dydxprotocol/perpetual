/**
 * Empty contract to ensure the necessary contract are imported by sol-trace.
 *
 * TODO(ken): Find a more elegant solution.
 */

pragma solidity 0.5.16;

/* solium-disable-next-line */
// import { Address } from "@openzeppelin/upgrades/contracts/utils/Address.sol";

/* solium-disable-next-line */
import { Proxy } from "@openzeppelin/upgrades/contracts/upgradeability/Proxy.sol";
/* solium-disable-next-line */
import { BaseUpgradeabilityProxy } from "@openzeppelin/upgrades/contracts/upgradeability/BaseUpgradeabilityProxy.sol";
/* solium-disable-next-line */
import { UpgradeabilityProxy } from "@openzeppelin/upgrades/contracts/upgradeability/UpgradeabilityProxy.sol";
/* solium-disable-next-line */
import { BaseAdminUpgradeabilityProxy } from "@openzeppelin/upgrades/contracts/upgradeability/BaseAdminUpgradeabilityProxy.sol";


contract Imports {}
