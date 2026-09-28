// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {BaseTest} from "./utils/BaseTest.sol";
import {MockSmartWallet} from "./utils/MockSmartWallet.sol";
import {Turnout} from "../src/Turnout.sol";

contract SettlementTest is BaseTest {
    uint256 internal eventId;
    uint256[] internal mine;
    uint256[] internal theirs;
    address internal payout = makeAddr("payout");

    function setUp() public override {
        super.setUp();
        eventId = _createEvent();
        mine = _buy(buyer, eventId, 0, 2);
        theirs = _buy(buyer2, eventId, 1, 1);
    }

    function _withdraw() internal returns (uint256) {
        vm.prank(host);
        return turnout.withdraw(eventId, payout);
    }

    function _claim(address who, uint256[] memory ids) internal returns (uint256) {
        vm.prank(who);
        return turnout.claimRefund(ids, who);
    }

    function test_HostPaidPerCheckInDuringEvent() public {
        _warpToDoors();
        _checkIn(buyerKey, _ids(mine[0]));
        assertEq(_withdraw(), REGULAR);

        _checkIn(buyer2Key, theirs);
        assertEq(_withdraw(), VIP);

        assertEq(payout.balance, REGULAR + VIP);
        assertEq(address(turnout).balance, REGULAR);
        assertEq(turnout.getEvent(eventId).withdrawnAmount, REGULAR + VIP);
    }

    function test_UnscannedFundsLockedDuringClaimWindow() public {
        _warpToDoors();
        _checkIn(buyerKey, _ids(mine[0]));

        _warpToClaimWindow();
        assertEq(turnout.withdrawable(eventId), REGULAR);

        vm.warp(end + turnout.CLAIM_WINDOW());
        assertEq(turnout.withdrawable(eventId), REGULAR);
    }

    function test_UnclaimedFundsReleasedAfterWindow() public {
        _warpToDoors();
        _checkIn(buyerKey, _ids(mine[0]));
        _withdraw();

        _warpToClaimWindow();
        _claim(buyer2, theirs);

        _warpPastClaimWindow();
        assertEq(_withdraw(), REGULAR);
        assertEq(payout.balance, 2 * REGULAR);
        assertEq(address(turnout).balance, 0);
    }

    function test_EveryoneRefundedWhenHostVanishes() public {
        _warpToClaimWindow();
        assertTrue(turnout.isRefundable(mine[0]));

        assertEq(_claim(buyer, mine), 2 * REGULAR);
        assertEq(_claim(buyer2, theirs), VIP);

        assertEq(address(turnout).balance, 0);
        assertEq(turnout.getHostStats(host).ticketsRefunded, 3);

        _warpPastClaimWindow();
        vm.prank(host);
        vm.expectRevert(Turnout.NothingToWithdraw.selector);
        turnout.withdraw(eventId, host);
    }

    function test_RefundCanGoToAnotherAddress() public {
        _warpToClaimWindow();
        vm.prank(buyer);
        turnout.claimRefund(mine, payout);
        assertEq(payout.balance, 2 * REGULAR);
    }

    function test_SmartWalletCanClaimToEoa() public {
        MockSmartWallet wallet = new MockSmartWallet(buyer);
        uint256 first = wallet.buy{value: REGULAR}(turnout, eventId, 0, 1);

        _warpToClaimWindow();
        wallet.claim(turnout, _ids(first), payout);
        assertEq(payout.balance, REGULAR);
    }

    function test_RevertWhen_RefundBeforeEventEnds() public {
        vm.warp(end);
        vm.prank(buyer);
        vm.expectRevert(Turnout.NotRefundable.selector);
        turnout.claimRefund(mine, buyer);
    }

    function test_RevertWhen_RefundAfterWindowCloses() public {
        _warpPastClaimWindow();
        vm.prank(buyer);
        vm.expectRevert(Turnout.NotRefundable.selector);
        turnout.claimRefund(mine, buyer);
    }

    function test_RefundOnLastSecondOfWindow() public {
        vm.warp(end + turnout.CLAIM_WINDOW());
        _claim(buyer, mine);
    }

    function test_RevertWhen_RefundingCheckedInTicket() public {
        _warpToDoors();
        _checkIn(buyerKey, _ids(mine[0]));

        _warpToClaimWindow();
        vm.prank(buyer);
        vm.expectRevert(Turnout.TicketNotValid.selector);
        turnout.claimRefund(_ids(mine[0]), buyer);
    }

    function test_RevertWhen_RefundingSomeoneElsesTicket() public {
        _warpToClaimWindow();
        vm.prank(buyer);
        vm.expectRevert(Turnout.NotTicketHolder.selector);
        turnout.claimRefund(theirs, buyer);
    }

    function test_RevertWhen_RefundingTwice() public {
        _warpToClaimWindow();
        _claim(buyer, _ids(mine[0]));

        vm.prank(buyer);
        vm.expectRevert(Turnout.TicketNotValid.selector);
        turnout.claimRefund(_ids(mine[0]), buyer);
    }

    function test_RevertWhen_DuplicateIdInRefund() public {
        _warpToClaimWindow();
        vm.prank(buyer);
        vm.expectRevert(Turnout.TicketNotValid.selector);
        turnout.claimRefund(_ids(mine[0], mine[0]), buyer);
    }

    function test_RevertWhen_RefundingNothing() public {
        _warpToClaimWindow();
        vm.prank(buyer);
        vm.expectRevert(Turnout.InvalidQuantity.selector);
        turnout.claimRefund(new uint256[](0), buyer);
    }

    function test_RevertWhen_RefundToZeroAddress() public {
        _warpToClaimWindow();
        vm.prank(buyer);
        vm.expectRevert(Turnout.ZeroAddress.selector);
        turnout.claimRefund(mine, address(0));
    }

    function test_CancelRefundsEveryoneAnytime() public {
        vm.prank(host);
        turnout.cancelEvent(eventId);

        assertEq(_claim(buyer, _ids(mine[0])), REGULAR);

        vm.warp(end + 365 days);
        assertEq(_claim(buyer, _ids(mine[1])), REGULAR);
        assertEq(_claim(buyer2, theirs), VIP);
        assertEq(address(turnout).balance, 0);
        assertEq(turnout.withdrawable(eventId), 0);
        assertEq(turnout.getHostStats(host).eventsCancelled, 1);
    }

    function test_CancelDuringEventWithNoCheckIns() public {
        vm.warp(start + 1 hours);
        vm.prank(host);
        turnout.cancelEvent(eventId);
        assertTrue(turnout.getEvent(eventId).cancelled);
    }

    function test_RevertWhen_CancelAfterFirstCheckIn() public {
        _warpToDoors();
        _checkIn(buyerKey, _ids(mine[0]));

        vm.prank(host);
        vm.expectRevert(Turnout.CannotCancel.selector);
        turnout.cancelEvent(eventId);
    }

    function test_RevertWhen_CancelAfterEventEnds() public {
        _warpPastClaimWindow();
        vm.prank(host);
        vm.expectRevert(Turnout.CannotCancel.selector);
        turnout.cancelEvent(eventId);
    }

    function test_RevertWhen_CancelTwice() public {
        vm.startPrank(host);
        turnout.cancelEvent(eventId);
        vm.expectRevert(Turnout.CannotCancel.selector);
        turnout.cancelEvent(eventId);
        vm.stopPrank();
    }

    function test_RevertWhen_CancelNotHost() public {
        vm.prank(buyer);
        vm.expectRevert(Turnout.NotHost.selector);
        turnout.cancelEvent(eventId);
    }

    function test_RevertWhen_WithdrawNotHost() public {
        _warpToDoors();
        _checkIn(buyerKey, _ids(mine[0]));

        vm.prank(buyer);
        vm.expectRevert(Turnout.NotHost.selector);
        turnout.withdraw(eventId, buyer);
    }

    function test_RevertWhen_WithdrawNothing() public {
        vm.prank(host);
        vm.expectRevert(Turnout.NothingToWithdraw.selector);
        turnout.withdraw(eventId, host);
    }

    function test_RevertWhen_WithdrawToZeroAddress() public {
        _warpToDoors();
        _checkIn(buyerKey, _ids(mine[0]));

        vm.prank(host);
        vm.expectRevert(Turnout.ZeroAddress.selector);
        turnout.withdraw(eventId, address(0));
    }

    function test_EventsDoNotShareFunds() public {
        uint256 other = _createEvent();
        _buy(buyer, other, 0, 1);

        _warpPastClaimWindow();
        assertEq(turnout.withdrawable(eventId), 2 * REGULAR + VIP);
        assertEq(turnout.withdrawable(other), REGULAR);

        _withdraw();
        assertEq(address(turnout).balance, REGULAR);
    }
}
