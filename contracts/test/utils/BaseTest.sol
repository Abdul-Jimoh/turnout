// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {Turnout} from "../../src/Turnout.sol";

abstract contract BaseTest is Test {
    Turnout internal turnout;

    address internal host = makeAddr("host");
    address internal staff = makeAddr("staff");
    address internal buyer;
    uint256 internal buyerKey;
    address internal buyer2;
    uint256 internal buyer2Key;

    uint128 internal constant REGULAR = 5e18;
    uint128 internal constant VIP = 20e18;

    uint64 internal start;
    uint64 internal end;

    function setUp() public virtual {
        vm.warp(1_790_000_000);
        turnout = new Turnout();

        (buyer, buyerKey) = makeAddrAndKey("buyer");
        (buyer2, buyer2Key) = makeAddrAndKey("buyer2");
        vm.deal(buyer, 1_000e18);
        vm.deal(buyer2, 1_000e18);
        vm.deal(host, 100e18);

        start = uint64(block.timestamp + 7 days);
        end = start + 4 hours;
    }

    function _tiers() internal pure returns (Turnout.TierInput[] memory tiers) {
        tiers = new Turnout.TierInput[](2);
        tiers[0] = Turnout.TierInput({name: "Regular", price: REGULAR, capacity: 100});
        tiers[1] = Turnout.TierInput({name: "VIP", price: VIP, capacity: 10});
    }

    function _input() internal view returns (Turnout.EventInput memory) {
        return Turnout.EventInput({
            name: "Builders Night",
            venue: "Yaba, Lagos",
            description: "Demos, drinks and people shipping on Arc.",
            imageURI: "ipfs://bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy",
            startTime: start,
            endTime: end,
            checkInOpensAt: 0,
            tiers: _tiers()
        });
    }

    function _createEvent() internal returns (uint256) {
        vm.prank(host);
        return turnout.createEvent(_input());
    }

    function _createEvent(Turnout.EventInput memory input) internal returns (uint256) {
        vm.prank(host);
        return turnout.createEvent(input);
    }

    function _buy(address who, uint256 eventId, uint8 tier, uint8 quantity) internal returns (uint256[] memory ids) {
        uint256 price = turnout.getTiers(eventId)[tier].price;
        vm.prank(who);
        uint256 first = turnout.buyTickets{value: price * quantity}(eventId, tier, quantity);
        ids = new uint256[](quantity);
        for (uint256 i; i < quantity; ++i) {
            ids[i] = first + i;
        }
    }

    function _sign(uint256 key, uint256[] memory ids, uint256 deadline) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, turnout.checkInDigest(ids, deadline));
        return abi.encodePacked(r, s, v);
    }

    function _checkIn(uint256 key, uint256[] memory ids) internal {
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _sign(key, ids, deadline);
        vm.prank(host);
        turnout.checkIn(ids, deadline, signature);
    }

    function _ids(uint256 a) internal pure returns (uint256[] memory ids) {
        ids = new uint256[](1);
        ids[0] = a;
    }

    function _ids(uint256 a, uint256 b) internal pure returns (uint256[] memory ids) {
        ids = new uint256[](2);
        ids[0] = a;
        ids[1] = b;
    }

    function _warpToDoors() internal {
        vm.warp(start - 1 hours);
    }

    function _warpToClaimWindow() internal {
        vm.warp(end + 1);
    }

    function _warpPastClaimWindow() internal {
        vm.warp(end + turnout.CLAIM_WINDOW() + 1);
    }
}
