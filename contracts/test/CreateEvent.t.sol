// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {BaseTest} from "./utils/BaseTest.sol";
import {Turnout} from "../src/Turnout.sol";

contract CreateEventTest is BaseTest {
    function test_StoresEventAndTiers() public {
        uint256 id = _createEvent();

        assertEq(id, 1);
        assertEq(turnout.eventCount(), 1);

        Turnout.Event memory e = turnout.getEvent(id);
        assertEq(e.host, host);
        assertEq(e.name, "Builders Night");
        assertEq(e.venue, "Yaba, Lagos");
        assertEq(e.startTime, start);
        assertEq(e.endTime, end);
        assertFalse(e.cancelled);

        Turnout.Tier[] memory tiers = turnout.getTiers(id);
        assertEq(tiers.length, 2);
        assertEq(tiers[0].name, "Regular");
        assertEq(tiers[0].price, REGULAR);
        assertEq(tiers[0].capacity, 100);
        assertEq(tiers[1].name, "VIP");
        assertEq(tiers[1].price, VIP);

        (uint256[] memory ids, uint256 total) = turnout.getHostEvents(host, 0, 10);
        assertEq(total, 1);
        assertEq(ids[0], id);
        assertEq(turnout.getHostStats(host).eventsCreated, 1);
    }

    function test_DefaultCheckInOpensSixHoursBeforeStart() public {
        uint256 id = _createEvent();
        assertEq(turnout.getEvent(id).checkInOpensAt, start - 6 hours);
    }

    function test_CustomCheckInOpening() public {
        Turnout.EventInput memory input = _input();
        input.checkInOpensAt = start - 24 hours;
        uint256 id = _createEvent(input);
        assertEq(turnout.getEvent(id).checkInOpensAt, start - 24 hours);

        input.checkInOpensAt = start;
        id = _createEvent(input);
        assertEq(turnout.getEvent(id).checkInOpensAt, start);
    }

    function test_EmitsEventCreated() public {
        vm.expectEmit(address(turnout));
        emit Turnout.EventCreated(1, host);
        _createEvent();
    }

    function test_RevertWhen_StartNotInFuture() public {
        Turnout.EventInput memory input = _input();
        input.startTime = uint64(block.timestamp);
        vm.expectRevert(Turnout.InvalidTiming.selector);
        _createEvent(input);
    }

    function test_RevertWhen_EndNotAfterStart() public {
        Turnout.EventInput memory input = _input();
        input.endTime = input.startTime;
        vm.expectRevert(Turnout.InvalidTiming.selector);
        _createEvent(input);
    }

    function test_RevertWhen_EventTooLong() public {
        Turnout.EventInput memory input = _input();
        input.endTime = input.startTime + 30 days + 1;
        vm.expectRevert(Turnout.InvalidTiming.selector);
        _createEvent(input);
    }

    function test_RevertWhen_CheckInOpensAfterStart() public {
        Turnout.EventInput memory input = _input();
        input.checkInOpensAt = start + 1;
        vm.expectRevert(Turnout.InvalidTiming.selector);
        _createEvent(input);
    }

    function test_RevertWhen_CheckInOpensTooEarly() public {
        Turnout.EventInput memory input = _input();
        input.checkInOpensAt = start - 24 hours - 1;
        vm.expectRevert(Turnout.InvalidTiming.selector);
        _createEvent(input);
    }

    function test_RevertWhen_NoTiers() public {
        Turnout.EventInput memory input = _input();
        input.tiers = new Turnout.TierInput[](0);
        vm.expectRevert(Turnout.InvalidTiers.selector);
        _createEvent(input);
    }

    function test_RevertWhen_TooManyTiers() public {
        Turnout.EventInput memory input = _input();
        input.tiers = new Turnout.TierInput[](11);
        for (uint256 i; i < 11; ++i) {
            input.tiers[i] = Turnout.TierInput({name: "GA", price: REGULAR, capacity: 1});
        }
        vm.expectRevert(Turnout.InvalidTiers.selector);
        _createEvent(input);
    }

    function test_RevertWhen_TierHasZeroCapacity() public {
        Turnout.EventInput memory input = _input();
        input.tiers[1].capacity = 0;
        vm.expectRevert(Turnout.InvalidTiers.selector);
        _createEvent(input);
    }

    function test_RevertWhen_TierNameEmpty() public {
        Turnout.EventInput memory input = _input();
        input.tiers[0].name = "";
        vm.expectRevert(Turnout.InvalidTiers.selector);
        _createEvent(input);
    }

    function test_RevertWhen_PriceBelowMinimum() public {
        Turnout.EventInput memory input = _input();
        input.tiers[0].price = 0.009e18;
        vm.expectRevert(Turnout.InvalidPrice.selector);
        _createEvent(input);
    }

    function test_RevertWhen_PriceNotWholeMicroUsdc() public {
        Turnout.EventInput memory input = _input();
        input.tiers[0].price = 5e18 + 1;
        vm.expectRevert(Turnout.InvalidPrice.selector);
        _createEvent(input);
    }

    function test_RevertWhen_NameEmpty() public {
        Turnout.EventInput memory input = _input();
        input.name = "";
        vm.expectRevert(Turnout.InvalidDetails.selector);
        _createEvent(input);
    }

    function test_RevertWhen_DescriptionTooLong() public {
        Turnout.EventInput memory input = _input();
        input.description = string(new bytes(2001));
        vm.expectRevert(Turnout.InvalidDetails.selector);
        _createEvent(input);
    }

    function test_UpdateDetails() public {
        uint256 id = _createEvent();
        vm.prank(host);
        turnout.updateEventDetails(id, "Builders Night II", "Ikeja, Lagos", "New venue.");

        Turnout.Event memory e = turnout.getEvent(id);
        assertEq(e.name, "Builders Night II");
        assertEq(e.venue, "Ikeja, Lagos");
        assertEq(e.startTime, start);
    }

    function test_RevertWhen_UpdateDetailsNotHost() public {
        uint256 id = _createEvent();
        vm.prank(buyer);
        vm.expectRevert(Turnout.NotHost.selector);
        turnout.updateEventDetails(id, "Mine now", "", "");
    }

    function test_RevertWhen_EventNotFound() public {
        vm.expectRevert(Turnout.EventNotFound.selector);
        turnout.getEvent(42);
    }

    function test_SetHostName() public {
        vm.prank(host);
        turnout.setHostName("Arc Lagos");
        assertEq(turnout.hostName(host), "Arc Lagos");
    }

    function test_RevertWhen_HostNameTooLong() public {
        vm.prank(host);
        vm.expectRevert(Turnout.InvalidDetails.selector);
        turnout.setHostName(string(new bytes(51)));
    }
}
