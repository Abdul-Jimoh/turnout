// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {BaseTest} from "./utils/BaseTest.sol";
import {Turnout} from "../src/Turnout.sol";

contract StaffTest is BaseTest {
    uint256 internal eventId;
    address internal door2 = makeAddr("door2");

    function setUp() public override {
        super.setUp();
        eventId = _createEvent();
    }

    function test_AddStaffAndForwardGas() public {
        vm.expectEmit(address(turnout));
        emit Turnout.StaffAdded(eventId, staff);

        vm.prank(host);
        turnout.addStaff{value: 1e18}(eventId, staff);

        assertTrue(turnout.isStaff(eventId, staff));
        assertEq(staff.balance, 1e18);
        assertEq(address(turnout).balance, 0);
    }

    function test_TopUpExistingStaff() public {
        vm.startPrank(host);
        turnout.addStaff{value: 1e18}(eventId, staff);
        turnout.addStaff{value: 0.5e18}(eventId, staff);
        vm.stopPrank();

        assertEq(staff.balance, 1.5e18);
        assertEq(turnout.getStaff(eventId).length, 1);
    }

    function test_MultipleDoors() public {
        vm.startPrank(host);
        turnout.addStaff(eventId, staff);
        turnout.addStaff(eventId, door2);
        vm.stopPrank();

        address[] memory doors = turnout.getStaff(eventId);
        assertEq(doors.length, 2);

        uint256[] memory a = _buy(buyer, eventId, 0, 1);
        uint256[] memory b = _buy(buyer2, eventId, 0, 1);
        _warpToDoors();

        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory sigA = _sign(buyerKey, a, deadline);
        bytes memory sigB = _sign(buyer2Key, b, deadline);

        vm.prank(staff);
        turnout.checkIn(a, deadline, sigA);
        vm.prank(door2);
        turnout.checkIn(b, deadline, sigB);

        assertEq(turnout.getEvent(eventId).checkedInCount, 2);
    }

    function test_RemoveStaff() public {
        vm.startPrank(host);
        turnout.addStaff(eventId, staff);

        vm.expectEmit(address(turnout));
        emit Turnout.StaffRemoved(eventId, staff);
        turnout.removeStaff(eventId, staff);
        vm.stopPrank();

        assertFalse(turnout.isStaff(eventId, staff));
        assertEq(turnout.getStaff(eventId).length, 0);
    }

    function test_RevertWhen_AddStaffNotHost() public {
        vm.prank(staff);
        vm.expectRevert(Turnout.NotHost.selector);
        turnout.addStaff(eventId, staff);
    }

    function test_RevertWhen_RemoveStaffNotHost() public {
        vm.prank(host);
        turnout.addStaff(eventId, staff);

        vm.prank(staff);
        vm.expectRevert(Turnout.NotHost.selector);
        turnout.removeStaff(eventId, staff);
    }

    function test_RevertWhen_AddZeroAddress() public {
        vm.prank(host);
        vm.expectRevert(Turnout.ZeroAddress.selector);
        turnout.addStaff(eventId, address(0));
    }
}
