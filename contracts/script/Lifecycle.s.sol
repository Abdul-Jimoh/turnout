// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {Turnout} from "../src/Turnout.sol";

/// Runs one event through check-in and payout, and a second one through cancellation and refund,
/// against a deployed Turnout. Signs as both HOST and BUYER, so both wallets must be supplied.
contract Lifecycle is Script {
    uint128 constant REGULAR = 0.1e18;
    uint128 constant VIP = 0.25e18;

    Turnout turnout;
    address host;
    address buyer;

    uint256 liveEvent;
    uint256 cancelledEvent;
    uint256 firstRegular;
    uint256 vipTicket;
    uint256 refundableTicket;

    function run() external {
        turnout = Turnout(vm.envAddress("TURNOUT_ADDRESS"));
        host = vm.envAddress("HOST");
        buyer = vm.envAddress("BUYER");

        _createEvents();
        _buyTickets();
        _checkInAndWithdraw();
        _cancelAndRefund();

        console.log("events", liveEvent, cancelledEvent);
        console.log("left unscanned", firstRegular + 1);
    }

    function _createEvents() internal {
        uint64 start = uint64(block.timestamp + 30 minutes);

        vm.startBroadcast(host);
        (bool ok,) = buyer.call{value: 1e18}("");
        require(ok, "funding buyer failed");
        liveEvent = turnout.createEvent(_event("Turnout Testnet Night", start));
        cancelledEvent = turnout.createEvent(_event("Turnout Rained Out", start));
        vm.stopBroadcast();
    }

    function _buyTickets() internal {
        vm.startBroadcast(buyer);
        firstRegular = turnout.buyTickets{value: 2 * REGULAR}(liveEvent, 0, 2);
        vipTicket = turnout.buyTickets{value: VIP}(liveEvent, 1, 1);
        refundableTicket = turnout.buyTickets{value: REGULAR}(cancelledEvent, 0, 1);
        vm.stopBroadcast();
    }

    // One regular ticket is left unscanned so the claim window can be exercised after the event.
    function _checkInAndWithdraw() internal {
        uint256[] memory group = new uint256[](2);
        group[0] = firstRegular;
        group[1] = vipTicket;
        uint256 deadline = block.timestamp + 8 minutes;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(buyer, turnout.checkInDigest(group, deadline));

        vm.startBroadcast(host);
        turnout.checkIn(group, deadline, abi.encodePacked(r, s, v));
        console.log("host withdrew", turnout.withdraw(liveEvent, host));
        vm.stopBroadcast();
    }

    function _cancelAndRefund() internal {
        vm.broadcast(host);
        turnout.cancelEvent(cancelledEvent);

        uint256[] memory ids = new uint256[](1);
        ids[0] = refundableTicket;
        vm.broadcast(buyer);
        console.log("buyer refunded", turnout.claimRefund(ids, buyer));
    }

    function _event(string memory name, uint64 start) internal pure returns (Turnout.EventInput memory) {
        Turnout.TierInput[] memory tiers = new Turnout.TierInput[](2);
        tiers[0] = Turnout.TierInput({name: "Regular", price: REGULAR, capacity: 50});
        tiers[1] = Turnout.TierInput({name: "VIP", price: VIP, capacity: 5});
        return Turnout.EventInput({
            name: name,
            venue: "Online",
            description: "Lifecycle run on Arc testnet.",
            imageURI: "",
            startTime: start,
            endTime: start + 1 hours,
            checkInOpensAt: 0,
            tiers: tiers
        });
    }
}
