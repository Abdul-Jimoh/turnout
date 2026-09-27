// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Turnout} from "../../src/Turnout.sol";

contract MockSmartWallet is IERC1271 {
    address public immutable owner;

    constructor(address owner_) {
        owner = owner_;
    }

    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4) {
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(hash, signature);
        return err == ECDSA.RecoverError.NoError && signer == owner ? this.isValidSignature.selector : bytes4(0);
    }

    function buy(Turnout turnout, uint256 eventId, uint8 tier, uint8 quantity) external payable returns (uint256) {
        return turnout.buyTickets{value: msg.value}(eventId, tier, quantity);
    }

    function claim(Turnout turnout, uint256[] calldata ids, address to) external returns (uint256) {
        return turnout.claimRefund(ids, to);
    }

    receive() external payable {}
}
