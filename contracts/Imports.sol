/**
 * Empty contract to ensure the necessary contracts are imported by sol-trace.
 *
 * TODO(ken): Find a more elegant solution.
 */

pragma solidity 0.5.16;

// Keep the following commented import--the comment is enough to get sol-trace to include the file,
//   although the import itself fails.
// import { Address } from "@openzeppelin/upgrades/contracts/utils/Address.sol";
import { Proxy } from "@openzeppelin/upgrades/contracts/upgradeability/Proxy.sol";
import { BaseUpgradeabilityProxy } from "@openzeppelin/upgrades/contracts/upgradeability/BaseUpgradeabilityProxy.sol";
import { UpgradeabilityProxy } from "@openzeppelin/upgrades/contracts/upgradeability/UpgradeabilityProxy.sol";
import { BaseAdminUpgradeabilityProxy } from "@openzeppelin/upgrades/contracts/upgradeability/BaseAdminUpgradeabilityProxy.sol";


contract Imports {}
