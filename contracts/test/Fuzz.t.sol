// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {BaseTest} from "./utils/BaseTest.sol";
import {Turnout} from "../src/Turnout.sol";

contract FuzzTest is BaseTest {
    function _singleTierEvent(uint128 price, uint32 capacity) internal returns (uint256) {
        Turnout.EventInput memory input = _input();
        input.tiers = new Turnout.TierInput[](1);
        input.tiers[0] = Turnout.TierInput({name: "GA", price: price, capacity: capacity});
        return _createEvent(input);
    }

    function _boundPrice(uint256 raw) internal pure returns (uint128) {
        return uint128(bound(raw, 1e4, 1e12) * 1e12);
    }

    function testFuzz_BuyChargesExactly(uint256 rawPrice, uint32 capacity, uint8 quantity) public {
        uint128 price = _boundPrice(rawPrice);
        capacity = uint32(bound(capacity, 1, 1000));
        quantity = uint8(bound(quantity, 1, 20));
        uint256 eventId = _singleTierEvent(price, capacity);

        uint256 cost = uint256(price) * quantity;
        vm.deal(buyer, cost);
        vm.prank(buyer);
        if (quantity > capacity) {
            vm.expectRevert(Turnout.SoldOut.selector);
            turnout.buyTickets{value: cost}(eventId, 0, quantity);
            return;
        }
        turnout.buyTickets{value: cost}(eventId, 0, quantity);

        assertEq(address(turnout).balance, cost);
        assertEq(buyer.balance, 0);
        assertEq(turnout.getEvent(eventId).soldAmount, cost);
    }

    /// Every ticket ends up paid to exactly one side, whatever mix of check-ins and refund claims happens.
    function testFuzz_FullSettlement(uint256 rawPrice, uint8 buyerCount, uint32 checkInMask, uint32 claimMask) public {
        uint128 price = _boundPrice(rawPrice);
        buyerCount = uint8(bound(buyerCount, 1, 20));
        uint256 eventId = _singleTierEvent(price, 100);

        address[] memory buyers = new address[](buyerCount);
        uint256[] memory keys = new uint256[](buyerCount);
        uint256[] memory tickets = new uint256[](buyerCount);
        for (uint256 i; i < buyerCount; ++i) {
            (buyers[i], keys[i]) = makeAddrAndKey(string(abi.encodePacked("fan", i)));
            vm.deal(buyers[i], price);
            tickets[i] = _buy(buyers[i], eventId, 0, 1)[0];
        }

        _warpToDoors();
        uint256 attended;
        for (uint256 i; i < buyerCount; ++i) {
            if ((checkInMask >> i) & 1 == 1) {
                _checkIn(keys[i], _ids(tickets[i]));
                ++attended;
            }
        }

        if (attended > 0) {
            vm.prank(host);
            turnout.withdraw(eventId, host);
        }

        _warpToClaimWindow();
        uint256 refunded;
        for (uint256 i; i < buyerCount; ++i) {
            bool scanned = (checkInMask >> i) & 1 == 1;
            if (!scanned && (claimMask >> i) & 1 == 1) {
                vm.prank(buyers[i]);
                turnout.claimRefund(_ids(tickets[i]), buyers[i]);
                assertEq(buyers[i].balance, price);
                ++refunded;
            }
        }

        _warpPastClaimWindow();
        if (buyerCount > refunded + attended) {
            vm.prank(host);
            turnout.withdraw(eventId, host);
        }

        Turnout.Event memory e = turnout.getEvent(eventId);
        assertEq(address(turnout).balance, 0);
        assertEq(host.balance - 100e18, uint256(price) * (buyerCount - refunded));
        assertEq(e.withdrawnAmount + e.refundedAmount, e.soldAmount);
        assertEq(turnout.withdrawable(eventId), 0);
    }

    function testFuzz_CheckInOnlyInsideWindow(uint256 when) public {
        uint256 eventId = _createEvent();
        uint256[] memory ids = _buy(buyer, eventId, 0, 1);
        uint64 opensAt = turnout.getEvent(eventId).checkInOpensAt;

        when = bound(when, block.timestamp, end + 30 days);
        vm.warp(when);

        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _sign(buyerKey, ids, deadline);
        vm.prank(host);
        if (when < opensAt || when > end) vm.expectRevert(Turnout.CheckInClosed.selector);
        turnout.checkIn(ids, deadline, signature);
    }

    function testFuzz_SignatureOnlyValidNearDeadline(uint256 offset) public {
        uint256 eventId = _createEvent();
        uint256[] memory ids = _buy(buyer, eventId, 0, 1);
        _warpToDoors();

        offset = bound(offset, 0, 2 days);
        uint256 deadline = block.timestamp + offset;
        bytes memory signature = _sign(buyerKey, ids, deadline);

        bool tooFar = offset > turnout.MAX_SIGNATURE_TTL();
        vm.prank(host);
        if (tooFar) vm.expectRevert(Turnout.InvalidDeadline.selector);
        turnout.checkIn(ids, deadline, signature);
    }

    function testFuzz_RefundOnlyInsideClaimWindow(uint256 when) public {
        uint256 eventId = _createEvent();
        uint256[] memory ids = _buy(buyer, eventId, 0, 1);

        when = bound(when, block.timestamp, end + 30 days);
        vm.warp(when);

        bool open = when > end && when <= end + turnout.CLAIM_WINDOW();
        vm.prank(buyer);
        if (!open) vm.expectRevert(Turnout.NotRefundable.selector);
        turnout.claimRefund(ids, buyer);
    }

    function testFuzz_HostNeverWithdrawsUnscannedDuringWindow(uint256 when) public {
        uint256 eventId = _createEvent();
        uint256[] memory ids = _buy(buyer, eventId, 0, 3);
        _warpToDoors();
        _checkIn(buyerKey, _ids(ids[0]));

        when = bound(when, block.timestamp, end + turnout.CLAIM_WINDOW());
        vm.warp(when);
        assertEq(turnout.withdrawable(eventId), REGULAR);
    }

    function testFuzz_RejectsBadPrices(uint128 price) public {
        vm.assume(price < turnout.MIN_PRICE() || price % turnout.PRICE_UNIT() != 0);
        Turnout.EventInput memory input = _input();
        input.tiers[0].price = price;
        vm.expectRevert(Turnout.InvalidPrice.selector);
        _createEvent(input);
    }
}
