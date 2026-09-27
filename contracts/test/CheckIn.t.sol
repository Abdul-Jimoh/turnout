// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {BaseTest} from "./utils/BaseTest.sol";
import {MockSmartWallet} from "./utils/MockSmartWallet.sol";
import {Turnout} from "../src/Turnout.sol";

contract CheckInTest is BaseTest {
    uint256 internal eventId;
    uint256[] internal mine;
    uint256[] internal theirs;

    function setUp() public override {
        super.setUp();
        eventId = _createEvent();
        mine = _buy(buyer, eventId, 0, 2);
        uint256[] memory vip = _buy(buyer, eventId, 1, 1);
        mine.push(vip[0]);
        theirs = _buy(buyer2, eventId, 0, 1);

        vm.prank(host);
        turnout.addStaff(eventId, staff);
    }

    function _submit(address caller, uint256[] memory ids, uint256 deadline, bytes memory signature) internal {
        vm.prank(caller);
        turnout.checkIn(ids, deadline, signature);
    }

    function test_HostChecksInSingleTicket() public {
        _warpToDoors();
        _checkIn(buyerKey, _ids(mine[0]));

        assertEq(uint8(turnout.getTicket(mine[0]).status), uint8(Turnout.TicketStatus.CheckedIn));
        assertEq(uint8(turnout.getTicket(mine[1]).status), uint8(Turnout.TicketStatus.Valid));

        Turnout.Event memory e = turnout.getEvent(eventId);
        assertEq(e.checkedInCount, 1);
        assertEq(e.checkedInAmount, REGULAR);
        assertEq(turnout.withdrawable(eventId), REGULAR);
        assertEq(turnout.getHostStats(host).ticketsCheckedIn, 1);
    }

    function test_StaffChecksInWholeGroupAcrossTiers() public {
        _warpToDoors();
        uint256 deadline = block.timestamp + 5 minutes;

        vm.expectEmit(address(turnout));
        emit Turnout.CheckedIn(eventId, mine[0], staff);
        _submit(staff, mine, deadline, _sign(buyerKey, mine, deadline));

        Turnout.Event memory e = turnout.getEvent(eventId);
        assertEq(e.checkedInCount, 3);
        assertEq(e.checkedInAmount, 2 * REGULAR + VIP);
    }

    function test_SmartWalletHolderCanCheckIn() public {
        (address owner, uint256 ownerKey) = makeAddrAndKey("walletOwner");
        MockSmartWallet wallet = new MockSmartWallet(owner);
        vm.deal(address(wallet), 10e18);

        vm.prank(address(wallet));
        uint256 id = turnout.buyTickets{value: REGULAR}(eventId, 0, 1);

        _warpToDoors();
        uint256 deadline = block.timestamp + 5 minutes;
        _submit(staff, _ids(id), deadline, _sign(ownerKey, _ids(id), deadline));

        assertEq(uint8(turnout.getTicket(id).status), uint8(Turnout.TicketStatus.CheckedIn));
    }

    function test_DelegatedEoaCanCheckInWithPlainSignature() public {
        address delegate = address(new MockSmartWallet(address(0)));
        vm.etch(buyer, abi.encodePacked(hex"ef0100", delegate));
        assertGt(buyer.code.length, 0);

        _warpToDoors();
        _checkIn(buyerKey, _ids(mine[0]));
        assertEq(uint8(turnout.getTicket(mine[0]).status), uint8(Turnout.TicketStatus.CheckedIn));
    }

    function test_RevertWhen_SmartWalletRejectsSignature() public {
        (, uint256 strangerKey) = makeAddrAndKey("stranger");
        MockSmartWallet wallet = new MockSmartWallet(makeAddr("walletOwner"));
        vm.deal(address(wallet), 10e18);
        vm.prank(address(wallet));
        uint256 id = turnout.buyTickets{value: REGULAR}(eventId, 0, 1);

        _warpToDoors();
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _sign(strangerKey, _ids(id), deadline);

        vm.expectRevert(Turnout.InvalidSignature.selector);
        _submit(staff, _ids(id), deadline, signature);
    }

    function test_OpensAtCheckInTimeAndClosesAtEnd() public {
        uint256 opensAt = turnout.getEvent(eventId).checkInOpensAt;

        vm.warp(opensAt);
        _checkIn(buyerKey, _ids(mine[0]));

        vm.warp(end);
        _checkIn(buyerKey, _ids(mine[1]));
    }

    function test_RevertWhen_BeforeCheckInOpens() public {
        vm.warp(turnout.getEvent(eventId).checkInOpensAt - 1);
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _sign(buyerKey, _ids(mine[0]), deadline);

        vm.expectRevert(Turnout.CheckInClosed.selector);
        _submit(host, _ids(mine[0]), deadline, signature);
    }

    function test_RevertWhen_AfterEventEnds() public {
        vm.warp(end + 1);
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _sign(buyerKey, _ids(mine[0]), deadline);

        vm.expectRevert(Turnout.CheckInClosed.selector);
        _submit(host, _ids(mine[0]), deadline, signature);
    }

    function test_RevertWhen_CallerNotStaff() public {
        _warpToDoors();
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _sign(buyerKey, _ids(mine[0]), deadline);

        vm.expectRevert(Turnout.NotStaff.selector);
        _submit(buyer2, _ids(mine[0]), deadline, signature);
    }

    function test_RevertWhen_BuyerSubmitsOwnCheckIn() public {
        _warpToDoors();
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _sign(buyerKey, _ids(mine[0]), deadline);

        vm.expectRevert(Turnout.NotStaff.selector);
        _submit(buyer, _ids(mine[0]), deadline, signature);
    }

    function test_RevertWhen_StaffRemoved() public {
        vm.prank(host);
        turnout.removeStaff(eventId, staff);

        _warpToDoors();
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _sign(buyerKey, _ids(mine[0]), deadline);

        vm.expectRevert(Turnout.NotStaff.selector);
        _submit(staff, _ids(mine[0]), deadline, signature);
    }

    function test_RevertWhen_StaffOfAnotherEvent() public {
        uint256 other = _createEvent();
        address otherStaff = makeAddr("otherStaff");
        vm.prank(host);
        turnout.addStaff(other, otherStaff);

        _warpToDoors();
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _sign(buyerKey, _ids(mine[0]), deadline);

        vm.expectRevert(Turnout.NotStaff.selector);
        _submit(otherStaff, _ids(mine[0]), deadline, signature);
    }

    function test_RevertWhen_HostForgesSignature() public {
        (, uint256 hostKey) = makeAddrAndKey("host");
        _warpToDoors();
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _sign(hostKey, _ids(mine[0]), deadline);

        vm.expectRevert(Turnout.InvalidSignature.selector);
        _submit(host, _ids(mine[0]), deadline, signature);
    }

    function test_RevertWhen_SignatureForDifferentTickets() public {
        _warpToDoors();
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _sign(buyerKey, _ids(mine[0]), deadline);

        vm.expectRevert(Turnout.InvalidSignature.selector);
        _submit(host, _ids(mine[1]), deadline, signature);
    }

    function test_RevertWhen_DeadlineTampered() public {
        _warpToDoors();
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _sign(buyerKey, _ids(mine[0]), deadline);

        vm.expectRevert(Turnout.InvalidSignature.selector);
        _submit(host, _ids(mine[0]), deadline + 1, signature);
    }

    function test_RevertWhen_SignatureExpired() public {
        _warpToDoors();
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _sign(buyerKey, _ids(mine[0]), deadline);

        vm.warp(deadline + 1);
        vm.expectRevert(Turnout.InvalidDeadline.selector);
        _submit(host, _ids(mine[0]), deadline, signature);
    }

    function test_RevertWhen_SignatureCollectedAheadOfTime() public {
        uint256 deadline = start;
        bytes memory signature = _sign(buyerKey, _ids(mine[0]), deadline);

        vm.warp(turnout.getEvent(eventId).checkInOpensAt);
        vm.expectRevert(Turnout.InvalidDeadline.selector);
        _submit(host, _ids(mine[0]), deadline, signature);
    }

    function test_RevertWhen_ScannedTwice() public {
        _warpToDoors();
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _sign(buyerKey, _ids(mine[0]), deadline);
        _submit(staff, _ids(mine[0]), deadline, signature);

        vm.expectRevert(Turnout.TicketNotValid.selector);
        _submit(host, _ids(mine[0]), deadline, signature);
    }

    function test_RevertWhen_DuplicateIdInGroup() public {
        _warpToDoors();
        uint256[] memory ids = _ids(mine[0], mine[0]);
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _sign(buyerKey, ids, deadline);

        vm.expectRevert(Turnout.TicketNotValid.selector);
        _submit(host, ids, deadline, signature);
    }

    function test_RevertWhen_GroupMixesHolders() public {
        _warpToDoors();
        uint256[] memory ids = _ids(mine[0], theirs[0]);
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _sign(buyerKey, ids, deadline);

        vm.expectRevert(Turnout.TicketMismatch.selector);
        _submit(host, ids, deadline, signature);
    }

    function test_RevertWhen_GroupMixesEvents() public {
        uint256 other = _createEvent();
        uint256[] memory otherTicket = _buy(buyer, other, 0, 1);

        _warpToDoors();
        uint256[] memory ids = _ids(mine[0], otherTicket[0]);
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _sign(buyerKey, ids, deadline);

        vm.expectRevert(Turnout.TicketMismatch.selector);
        _submit(host, ids, deadline, signature);
    }

    function test_RevertWhen_TicketMissing() public {
        _warpToDoors();
        vm.expectRevert(Turnout.InvalidTicket.selector);
        _submit(host, _ids(999), block.timestamp + 5 minutes, "");
    }

    function test_RevertWhen_EmptyGroup() public {
        _warpToDoors();
        vm.expectRevert(Turnout.InvalidQuantity.selector);
        _submit(host, new uint256[](0), block.timestamp + 5 minutes, "");
    }

    function test_RevertWhen_EventCancelled() public {
        vm.prank(host);
        turnout.cancelEvent(eventId);
        vm.prank(buyer);
        turnout.claimRefund(_ids(mine[0]), buyer);

        _warpToDoors();
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _sign(buyerKey, _ids(mine[0]), deadline);

        vm.expectRevert(Turnout.EventIsCancelled.selector);
        _submit(host, _ids(mine[0]), deadline, signature);
    }
}
