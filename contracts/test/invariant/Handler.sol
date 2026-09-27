// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {Turnout} from "../../src/Turnout.sol";

contract Handler is Test {
    Turnout internal immutable turnout;

    address[] internal hosts;
    address[] internal buyers;
    mapping(address => uint256) internal keyOf;

    uint256[] public eventIds;
    uint256[] public ticketIds;
    mapping(uint256 => Turnout.TicketStatus) public settledAs;

    uint256 public deposited;
    uint256 public paidOut;

    constructor(Turnout turnout_) {
        turnout = turnout_;
        for (uint256 i; i < 3; ++i) {
            hosts.push(makeAddr(string(abi.encodePacked("host", i))));
        }
        for (uint256 i; i < 6; ++i) {
            (address buyer, uint256 key) = makeAddrAndKey(string(abi.encodePacked("buyer", i)));
            buyers.push(buyer);
            keyOf[buyer] = key;
        }
    }

    function eventCount() external view returns (uint256) {
        return eventIds.length;
    }

    function ticketCount() external view returns (uint256) {
        return ticketIds.length;
    }

    function createEvent(uint256 hostSeed, uint256 startIn, uint256 duration, uint256 rawPrice, uint256 vipPrice)
        external
    {
        address host = hosts[hostSeed % hosts.length];
        uint64 start = uint64(block.timestamp + bound(startIn, 1 hours, 10 days));

        Turnout.TierInput[] memory tiers = new Turnout.TierInput[](2);
        tiers[0] = Turnout.TierInput({name: "Regular", price: uint128(bound(rawPrice, 1e4, 1e9) * 1e12), capacity: 50});
        tiers[1] = Turnout.TierInput({name: "VIP", price: uint128(bound(vipPrice, 1e4, 1e9) * 1e12), capacity: 10});

        vm.prank(host);
        uint256 id = turnout.createEvent(
            Turnout.EventInput({
                name: "Fuzz Night",
                venue: "",
                description: "",
                startTime: start,
                endTime: start + uint64(bound(duration, 1 hours, 3 days)),
                checkInOpensAt: 0,
                tiers: tiers
            })
        );
        eventIds.push(id);
    }

    function buy(uint256 eventSeed, uint256 buyerSeed, uint256 tierSeed, uint256 quantitySeed) external {
        uint256 eventId = _onSale(eventSeed);
        if (eventId == 0) return;

        uint8 tier = uint8(tierSeed % 2);
        Turnout.Tier memory t = turnout.getTiers(eventId)[tier];
        uint256 left = t.capacity - t.sold;
        if (left == 0) return;
        uint8 quantity = uint8(bound(quantitySeed, 1, left < 5 ? left : 5));

        address buyer = buyers[buyerSeed % buyers.length];
        uint256 cost = uint256(t.price) * quantity;
        vm.deal(buyer, buyer.balance + cost);

        vm.prank(buyer);
        uint256 first = turnout.buyTickets{value: cost}(eventId, tier, quantity);
        deposited += cost;
        for (uint256 i; i < quantity; ++i) {
            ticketIds.push(first + i);
        }
    }

    function checkIn(uint256 ticketSeed, uint256 groupSize) external {
        if (ticketIds.length == 0) return;
        Turnout.TicketView memory first = turnout.getTicket(ticketIds[ticketSeed % ticketIds.length]);
        Turnout.Event memory e = turnout.getEvent(first.eventId);
        if (first.status != Turnout.TicketStatus.Valid || e.cancelled || block.timestamp > e.endTime) return;
        if (block.timestamp < e.checkInOpensAt) {
            vm.warp(e.checkInOpensAt + bound(groupSize, 0, e.endTime - e.checkInOpensAt));
        }

        (Turnout.TicketView[] memory owned,) = turnout.getBuyerTickets(first.holder, 0, type(uint256).max);
        uint256[] memory group = new uint256[](bound(groupSize, 1, 4));
        uint256 n;
        for (uint256 i; i < owned.length && n < group.length; ++i) {
            if (owned[i].eventId == first.eventId && owned[i].status == Turnout.TicketStatus.Valid) {
                group[n++] = owned[i].id;
            }
        }
        assembly {
            mstore(group, n)
        }

        uint256 deadline = block.timestamp + 5 minutes;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(keyOf[first.holder], turnout.checkInDigest(group, deadline));

        vm.prank(e.host);
        turnout.checkIn(group, deadline, abi.encodePacked(r, s, v));
        for (uint256 i; i < n; ++i) {
            settledAs[group[i]] = Turnout.TicketStatus.CheckedIn;
        }
    }

    function claimRefund(uint256 ticketSeed) external {
        if (ticketIds.length == 0) return;
        uint256 id = ticketIds[ticketSeed % ticketIds.length];
        Turnout.TicketView memory t = turnout.getTicket(id);
        Turnout.Event memory e = turnout.getEvent(t.eventId);
        if (!e.cancelled && block.timestamp <= e.endTime) {
            vm.warp(e.endTime + 1 + bound(ticketSeed, 0, turnout.CLAIM_WINDOW() - 1));
        }
        if (!turnout.isRefundable(id)) return;

        uint256[] memory ids = new uint256[](1);
        ids[0] = id;

        vm.prank(t.holder);
        paidOut += turnout.claimRefund(ids, t.holder);
        settledAs[id] = Turnout.TicketStatus.Refunded;
    }

    function withdraw(uint256 eventSeed) external {
        if (eventIds.length == 0) return;
        uint256 eventId = eventIds[eventSeed % eventIds.length];
        if (turnout.withdrawable(eventId) == 0) return;

        vm.prank(turnout.getEvent(eventId).host);
        paidOut += turnout.withdraw(eventId, makeAddr("payout"));
    }

    function cancel(uint256 eventSeed) external {
        if (eventIds.length == 0) return;
        uint256 eventId = eventIds[eventSeed % eventIds.length];
        Turnout.Event memory e = turnout.getEvent(eventId);
        if (e.cancelled || e.checkedInCount != 0 || block.timestamp > e.endTime) return;

        vm.prank(e.host);
        turnout.cancelEvent(eventId);
    }

    function warp(uint256 seconds_) external {
        vm.warp(block.timestamp + bound(seconds_, 1 minutes, 12 hours));
    }

    function _onSale(uint256 seed) internal view returns (uint256) {
        uint256 n = eventIds.length;
        for (uint256 i; i < n; ++i) {
            uint256 eventId = eventIds[(seed % n + i) % n];
            Turnout.Event memory e = turnout.getEvent(eventId);
            if (!e.cancelled && block.timestamp < e.startTime) return eventId;
        }
        return 0;
    }
}
