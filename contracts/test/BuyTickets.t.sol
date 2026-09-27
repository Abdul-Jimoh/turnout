// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {BaseTest} from "./utils/BaseTest.sol";
import {Turnout} from "../src/Turnout.sol";

contract BuyTicketsTest is BaseTest {
    uint256 internal eventId;

    function setUp() public override {
        super.setUp();
        eventId = _createEvent();
    }

    function test_EscrowsPaymentAndIssuesTickets() public {
        uint256 balanceBefore = buyer.balance;
        uint256[] memory ids = _buy(buyer, eventId, 0, 3);

        assertEq(ids.length, 3);
        assertEq(address(turnout).balance, 3 * REGULAR);
        assertEq(buyer.balance, balanceBefore - 3 * REGULAR);
        assertEq(host.balance, 100e18);

        Turnout.TicketView memory t = turnout.getTicket(ids[2]);
        assertEq(t.holder, buyer);
        assertEq(t.eventId, eventId);
        assertEq(t.tier, 0);
        assertEq(t.price, REGULAR);
        assertEq(uint8(t.status), uint8(Turnout.TicketStatus.Valid));

        Turnout.Event memory e = turnout.getEvent(eventId);
        assertEq(e.ticketCount, 3);
        assertEq(e.soldAmount, 3 * REGULAR);
        assertEq(turnout.getTiers(eventId)[0].sold, 3);
        assertEq(turnout.getHostStats(host).ticketsSold, 3);
    }

    function test_RepeatPurchasesAcrossTiersAccumulate() public {
        _buy(buyer, eventId, 0, 2);
        _buy(buyer, eventId, 1, 1);
        _buy(buyer2, eventId, 0, 1);

        (Turnout.TicketView[] memory mine, uint256 total) = turnout.getBuyerTickets(buyer, 0, 50);
        assertEq(total, 3);
        assertEq(mine[2].tier, 1);
        assertEq(mine[2].price, VIP);

        (, uint256 eventTotal) = turnout.getEventTickets(eventId, 0, 50);
        assertEq(eventTotal, 4);
        assertEq(address(turnout).balance, 3 * REGULAR + VIP);
    }

    function test_EmitsTicketsPurchased() public {
        vm.expectEmit(address(turnout));
        emit Turnout.TicketsPurchased(eventId, buyer, 1, 1, 2, 2 * VIP);
        _buy(buyer, eventId, 1, 2);
    }

    function test_SellsOutTierExactly() public {
        _buy(buyer, eventId, 1, 10);
        vm.prank(buyer2);
        vm.expectRevert(Turnout.SoldOut.selector);
        turnout.buyTickets{value: VIP}(eventId, 1, 1);

        _buy(buyer2, eventId, 0, 1);
    }

    function test_RevertWhen_UnderpaidOrOverpaid() public {
        vm.startPrank(buyer);
        vm.expectRevert(Turnout.IncorrectPayment.selector);
        turnout.buyTickets{value: 2 * REGULAR - 1}(eventId, 0, 2);

        vm.expectRevert(Turnout.IncorrectPayment.selector);
        turnout.buyTickets{value: 2 * REGULAR + 1}(eventId, 0, 2);
        vm.stopPrank();
    }

    function test_RevertWhen_QuantityZero() public {
        vm.prank(buyer);
        vm.expectRevert(Turnout.InvalidQuantity.selector);
        turnout.buyTickets(eventId, 0, 0);
    }

    function test_RevertWhen_QuantityOverBatchLimit() public {
        vm.prank(buyer);
        vm.expectRevert(Turnout.InvalidQuantity.selector);
        turnout.buyTickets{value: 21 * REGULAR}(eventId, 0, 21);
    }

    function test_RevertWhen_TierMissing() public {
        vm.prank(buyer);
        vm.expectRevert(Turnout.TierNotFound.selector);
        turnout.buyTickets{value: REGULAR}(eventId, 2, 1);
    }

    function test_RevertWhen_SalesClosedAtStart() public {
        vm.warp(start);
        vm.prank(buyer);
        vm.expectRevert(Turnout.SalesClosed.selector);
        turnout.buyTickets{value: REGULAR}(eventId, 0, 1);
    }

    function test_CanBuyUntilJustBeforeStart() public {
        vm.warp(start - 1);
        _buy(buyer, eventId, 0, 1);
    }

    function test_RevertWhen_EventCancelled() public {
        vm.prank(host);
        turnout.cancelEvent(eventId);

        vm.prank(buyer);
        vm.expectRevert(Turnout.EventIsCancelled.selector);
        turnout.buyTickets{value: REGULAR}(eventId, 0, 1);
    }

    function test_RevertWhen_EventMissing() public {
        vm.prank(buyer);
        vm.expectRevert(Turnout.EventNotFound.selector);
        turnout.buyTickets{value: REGULAR}(99, 0, 1);
    }

    function test_TicketIdsAreGlobal() public {
        uint256 second = _createEvent();
        uint256[] memory a = _buy(buyer, eventId, 0, 2);
        uint256[] memory b = _buy(buyer, second, 0, 1);
        assertEq(a[1], 2);
        assertEq(b[0], 3);
        assertEq(turnout.ticketCount(), 3);
    }

    function test_Pagination() public {
        _buy(buyer, eventId, 0, 5);

        (Turnout.TicketView[] memory page, uint256 total) = turnout.getBuyerTickets(buyer, 2, 2);
        assertEq(total, 5);
        assertEq(page.length, 2);
        assertEq(page[0].id, 3);
        assertEq(page[1].id, 4);

        (page,) = turnout.getBuyerTickets(buyer, 4, 10);
        assertEq(page.length, 1);

        (page,) = turnout.getBuyerTickets(buyer, 9, 10);
        assertEq(page.length, 0);

        (page,) = turnout.getBuyerTickets(buyer, 0, type(uint256).max);
        assertEq(page.length, 5);
    }
}
