// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {Turnout} from "../src/Turnout.sol";

contract Deploy is Script {
    function run() external returns (Turnout turnout) {
        vm.startBroadcast();
        turnout = new Turnout();
        vm.stopBroadcast();

        console.log("Turnout deployed at", address(turnout));
    }
}
