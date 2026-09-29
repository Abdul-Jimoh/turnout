// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {Turnout} from "../src/Turnout.sol";

/// Local development data for the web app. Uses the default anvil mnemonic, so never run it
/// against a public network.
contract Seed is Script {
    string constant MNEMONIC = "test test test test test test test test test test test junk";

    Turnout turnout;

    function run() external {
        require(block.chainid == 31337, "local only");

        uint256 deployer = vm.deriveKey(MNEMONIC, 0);
        uint256 hostA = vm.deriveKey(MNEMONIC, 1);
        uint256 hostB = vm.deriveKey(MNEMONIC, 2);

        vm.broadcast(deployer);
        turnout = new Turnout();
        console.log("Turnout", address(turnout));

        vm.startBroadcast(hostA);
        turnout.setHostName("Lagos Builders Club");
        uint256 demoDay = _create("Arc Demo Day", "Landmark Centre, Lagos", 2 hours, 4 hours, 3);
        uint256 rooftop = _create("Rooftop Sessions Vol. 4", "Victoria Island, Lagos", 5 days, 5 hours, 2);
        uint256 cancelled = _create("Stablecoin Summer Mixer", "Lekki Phase 1", 9 days, 3 hours, 1);
        vm.stopBroadcast();

        vm.startBroadcast(hostB);
        turnout.setHostName("Night Shift Records");
        uint256 gig = _create("Night Shift: Live in Accra", "Alliance Francaise, Accra", 12 days, 4 hours, 3);
        _create("Founders Breakfast", "Online", 20 days, 2 hours, 1);
        vm.stopBroadcast();

        for (uint32 i = 3; i < 9; ++i) {
            uint256 buyer = vm.deriveKey(MNEMONIC, i);
            vm.startBroadcast(buyer);
            _buy(demoDay, 0, 2);
            _buy(rooftop, i % 2 == 0 ? 1 : 0, 1);
            _buy(gig, uint8(i % 3), 1);
            if (i < 5) _buy(cancelled, 0, 1);
            vm.stopBroadcast();
        }

        vm.broadcast(hostA);
        turnout.cancelEvent(cancelled);
    }

    function _create(string memory name, string memory venue, uint256 startsIn, uint64 length, uint256 tierCount)
        internal
        returns (uint256)
    {
        string[3] memory names = ["General", "VIP", "Backstage"];
        uint128[3] memory prices = [uint128(5e18), 25e18, 60e18];
        uint32[3] memory caps = [uint32(120), 30, 8];

        Turnout.TierInput[] memory tiers = new Turnout.TierInput[](tierCount);
        for (uint256 i; i < tierCount; ++i) {
            tiers[i] = Turnout.TierInput({name: names[i], price: prices[i], capacity: caps[i]});
        }

        uint64 start = uint64(block.timestamp + startsIn);
        return turnout.createEvent(
            Turnout.EventInput({
                name: name,
                venue: venue,
                description: "An evening for people building with stablecoins. Tickets are held in escrow and released to the host as guests are checked in at the door.",
                imageURI: "",
                startTime: start,
                endTime: start + length,
                checkInOpensAt: 0,
                tiers: tiers
            })
        );
    }

    function _buy(uint256 eventId, uint8 tier, uint8 quantity) internal {
        Turnout.Tier[] memory tiers = turnout.getTiers(eventId);
        if (tier >= tiers.length) tier = 0;
        turnout.buyTickets{value: uint256(tiers[tier].price) * quantity}(eventId, tier, quantity);
    }
}
