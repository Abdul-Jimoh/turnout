// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {Turnout} from "../../src/Turnout.sol";
import {Handler} from "./Handler.sol";

contract InvariantTest is Test {
    Turnout internal turnout;
    Handler internal handler;

    function setUp() public {
        vm.warp(1_790_000_000);
        turnout = new Turnout();
        handler = new Handler(turnout);
        targetContract(address(handler));
    }

    function invariant_BalanceMatchesFlows() public view {
        assertEq(address(turnout).balance, handler.deposited() - handler.paidOut());
    }

    function invariant_EscrowCoversEveryEvent() public view {
        uint256 owed;
        for (uint256 i; i < handler.eventCount(); ++i) {
            Turnout.Event memory e = turnout.getEvent(handler.eventIds(i));
            owed += e.soldAmount - e.refundedAmount - e.withdrawnAmount;
        }
        assertEq(address(turnout).balance, owed);
    }

    function invariant_PerEventAccounting() public view {
        for (uint256 i; i < handler.eventCount(); ++i) {
            uint256 eventId = handler.eventIds(i);
            Turnout.Event memory e = turnout.getEvent(eventId);

            assertLe(e.checkedInAmount + e.refundedAmount, e.soldAmount);
            assertLe(e.withdrawnAmount + e.refundedAmount, e.soldAmount);
            if (block.timestamp <= e.endTime + turnout.CLAIM_WINDOW() || e.cancelled) {
                assertLe(e.withdrawnAmount, e.checkedInAmount);
            }
            if (e.cancelled) assertEq(e.checkedInCount, 0);

            (Turnout.TicketView[] memory tickets, uint256 total) =
                turnout.getEventTickets(eventId, 0, type(uint256).max);
            assertEq(total, e.ticketCount);

            uint256 checkedIn;
            uint256 refunded;
            uint256 sold;
            for (uint256 j; j < tickets.length; ++j) {
                sold += tickets[j].price;
                if (tickets[j].status == Turnout.TicketStatus.CheckedIn) checkedIn += tickets[j].price;
                if (tickets[j].status == Turnout.TicketStatus.Refunded) refunded += tickets[j].price;
            }
            assertEq(sold, e.soldAmount);
            assertEq(checkedIn, e.checkedInAmount);
            assertEq(refunded, e.refundedAmount);
        }
    }

    function invariant_SettledTicketsNeverChange() public view {
        for (uint256 i; i < handler.ticketCount(); ++i) {
            uint256 id = handler.ticketIds(i);
            Turnout.TicketStatus expected = handler.settledAs(id);
            if (expected != Turnout.TicketStatus.None) {
                assertEq(uint8(turnout.getTicket(id).status), uint8(expected));
            }
        }
    }
}
