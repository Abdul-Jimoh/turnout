// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/// @title Turnout
/// @notice Event tickets paid in native USDC on Arc. Payments stay in escrow and are released
/// to the host per ticket, once the ticket holder signs a check-in at the door. Tickets that are
/// never checked in can be refunded by their holder during a claim window after the event.
contract Turnout is EIP712, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.AddressSet;

    enum TicketStatus {
        None,
        Valid,
        CheckedIn,
        Refunded
    }

    struct Tier {
        string name;
        uint128 price;
        uint32 capacity;
        uint32 sold;
    }

    struct Event {
        address host;
        uint64 startTime;
        uint64 endTime;
        uint64 checkInOpensAt;
        bool cancelled;
        uint32 ticketCount;
        uint32 checkedInCount;
        uint32 refundedCount;
        uint256 soldAmount;
        uint256 checkedInAmount;
        uint256 refundedAmount;
        uint256 withdrawnAmount;
        string name;
        string venue;
        string description;
    }

    struct Ticket {
        address holder;
        uint8 tier;
        TicketStatus status;
        uint256 eventId;
    }

    struct TierInput {
        string name;
        uint128 price;
        uint32 capacity;
    }

    struct EventInput {
        string name;
        string venue;
        string description;
        uint64 startTime;
        uint64 endTime;
        uint64 checkInOpensAt;
        TierInput[] tiers;
    }

    struct TicketView {
        uint256 id;
        uint256 eventId;
        address holder;
        uint8 tier;
        uint128 price;
        TicketStatus status;
    }

    struct HostStats {
        uint64 eventsCreated;
        uint64 eventsCancelled;
        uint64 ticketsSold;
        uint64 ticketsCheckedIn;
        uint64 ticketsRefunded;
    }

    uint256 public constant CLAIM_WINDOW = 7 days;
    uint64 public constant DEFAULT_CHECK_IN_LEAD = 6 hours;
    uint64 public constant MAX_CHECK_IN_LEAD = 24 hours;
    uint64 public constant MAX_EVENT_DURATION = 30 days;
    uint256 public constant MAX_SIGNATURE_TTL = 10 minutes;
    uint256 public constant MAX_TIERS = 10;
    uint256 public constant MAX_BATCH = 20;

    // Native USDC has 18 decimals but the ERC-20 view has 6. Prices must be whole micro-USDC
    // so every amount is exactly representable in both.
    uint256 public constant PRICE_UNIT = 1e12;
    uint256 public constant MIN_PRICE = 1e16;

    uint256 private constant MAX_NAME_LENGTH = 100;
    uint256 private constant MAX_VENUE_LENGTH = 200;
    uint256 private constant MAX_DESCRIPTION_LENGTH = 2000;
    uint256 private constant MAX_TIER_NAME_LENGTH = 32;
    uint256 private constant MAX_HOST_NAME_LENGTH = 50;

    bytes32 private constant CHECK_IN_TYPEHASH = keccak256("CheckIn(uint256[] ticketIds,uint256 deadline)");

    uint256 public eventCount;
    uint256 public ticketCount;

    mapping(uint256 => Event) private _events;
    mapping(uint256 => Tier[]) private _tiers;
    mapping(uint256 => Ticket) private _tickets;
    mapping(uint256 => uint256[]) private _eventTickets;
    mapping(address => uint256[]) private _hostEvents;
    mapping(address => uint256[]) private _buyerTickets;
    mapping(uint256 => EnumerableSet.AddressSet) private _staff;
    mapping(address => HostStats) private _hostStats;
    mapping(address => string) public hostName;

    event EventCreated(uint256 indexed eventId, address indexed host);
    event EventDetailsUpdated(uint256 indexed eventId);
    event EventCancelled(uint256 indexed eventId);
    event TicketsPurchased(
        uint256 indexed eventId,
        address indexed buyer,
        uint8 tier,
        uint256 firstTicketId,
        uint256 quantity,
        uint256 amount
    );
    event StaffAdded(uint256 indexed eventId, address indexed staff);
    event StaffRemoved(uint256 indexed eventId, address indexed staff);
    event CheckedIn(uint256 indexed eventId, uint256 indexed ticketId, address indexed staff);
    event Withdrawn(uint256 indexed eventId, address indexed to, uint256 amount);
    event Refunded(uint256 indexed eventId, uint256 indexed ticketId, address indexed holder, uint256 amount);
    event HostNameSet(address indexed host, string name);

    error EventNotFound();
    error NotHost();
    error NotStaff();
    error InvalidDetails();
    error InvalidTiming();
    error InvalidTiers();
    error InvalidPrice();
    error EventIsCancelled();
    error SalesClosed();
    error TierNotFound();
    error SoldOut();
    error InvalidQuantity();
    error IncorrectPayment();
    error CheckInClosed();
    error InvalidDeadline();
    error InvalidSignature();
    error InvalidTicket();
    error TicketMismatch();
    error TicketNotValid();
    error NotTicketHolder();
    error NotRefundable();
    error NothingToWithdraw();
    error CannotCancel();
    error ZeroAddress();

    constructor() EIP712("Turnout", "1") {}

    function createEvent(EventInput calldata input) external returns (uint256 eventId) {
        _checkDetails(input.name, input.venue, input.description);

        if (input.startTime <= block.timestamp || input.endTime <= input.startTime) revert InvalidTiming();
        if (input.endTime - input.startTime > MAX_EVENT_DURATION) revert InvalidTiming();

        uint64 opensAt = input.checkInOpensAt == 0 ? input.startTime - DEFAULT_CHECK_IN_LEAD : input.checkInOpensAt;
        if (opensAt > input.startTime || input.startTime - opensAt > MAX_CHECK_IN_LEAD) revert InvalidTiming();

        uint256 tierCount = input.tiers.length;
        if (tierCount == 0 || tierCount > MAX_TIERS) revert InvalidTiers();

        eventId = ++eventCount;
        Event storage e = _events[eventId];
        e.host = msg.sender;
        e.startTime = input.startTime;
        e.endTime = input.endTime;
        e.checkInOpensAt = opensAt;
        e.name = input.name;
        e.venue = input.venue;
        e.description = input.description;

        Tier[] storage tiers = _tiers[eventId];
        for (uint256 i; i < tierCount; ++i) {
            TierInput calldata t = input.tiers[i];
            uint256 nameLength = bytes(t.name).length;
            if (nameLength == 0 || nameLength > MAX_TIER_NAME_LENGTH || t.capacity == 0) revert InvalidTiers();
            if (t.price < MIN_PRICE || t.price % PRICE_UNIT != 0) revert InvalidPrice();
            tiers.push(Tier({name: t.name, price: t.price, capacity: t.capacity, sold: 0}));
        }

        _hostEvents[msg.sender].push(eventId);
        _hostStats[msg.sender].eventsCreated++;

        emit EventCreated(eventId, msg.sender);
    }

    /// @notice Name, venue and description can change at any time. Schedule and tiers cannot.
    function updateEventDetails(
        uint256 eventId,
        string calldata name,
        string calldata venue,
        string calldata description
    ) external {
        Event storage e = _hostEvent(eventId);
        if (e.cancelled) revert EventIsCancelled();
        _checkDetails(name, venue, description);

        e.name = name;
        e.venue = venue;
        e.description = description;

        emit EventDetailsUpdated(eventId);
    }

    /// @notice Only possible before anyone has been checked in and before the event ends.
    /// Every ticket becomes refundable.
    function cancelEvent(uint256 eventId) external {
        Event storage e = _hostEvent(eventId);
        if (e.cancelled || e.checkedInCount != 0 || block.timestamp > e.endTime) revert CannotCancel();

        e.cancelled = true;
        _hostStats[e.host].eventsCancelled++;

        emit EventCancelled(eventId);
    }

    /// @notice Authorizes a door device for one event. Any value sent is forwarded to it for gas,
    /// so this can also top up an existing device.
    function addStaff(uint256 eventId, address staff) external payable nonReentrant {
        _hostEvent(eventId);
        if (staff == address(0)) revert ZeroAddress();

        if (_staff[eventId].add(staff)) emit StaffAdded(eventId, staff);
        if (msg.value > 0) Address.sendValue(payable(staff), msg.value);
    }

    function removeStaff(uint256 eventId, address staff) external {
        _hostEvent(eventId);
        if (_staff[eventId].remove(staff)) emit StaffRemoved(eventId, staff);
    }

    /// @notice Pays out everything the host has earned so far: checked-in tickets immediately,
    /// and unclaimed unscanned tickets once the claim window has closed.
    function withdraw(uint256 eventId, address to) external nonReentrant returns (uint256 amount) {
        Event storage e = _hostEvent(eventId);
        if (to == address(0)) revert ZeroAddress();

        amount = _withdrawable(e);
        if (amount == 0) revert NothingToWithdraw();

        e.withdrawnAmount += amount;
        emit Withdrawn(eventId, to, amount);

        Address.sendValue(payable(to), amount);
    }

    function setHostName(string calldata name) external {
        if (bytes(name).length > MAX_HOST_NAME_LENGTH) revert InvalidDetails();
        hostName[msg.sender] = name;
        emit HostNameSet(msg.sender, name);
    }

    function buyTickets(uint256 eventId, uint8 tier, uint8 quantity) external payable returns (uint256 firstTicketId) {
        Event storage e = _event(eventId);
        if (e.cancelled) revert EventIsCancelled();
        if (block.timestamp >= e.startTime) revert SalesClosed();
        if (quantity == 0 || quantity > MAX_BATCH) revert InvalidQuantity();

        Tier[] storage tiers = _tiers[eventId];
        if (tier >= tiers.length) revert TierNotFound();
        Tier storage t = tiers[tier];
        if (t.sold + quantity > t.capacity) revert SoldOut();

        uint256 cost = uint256(t.price) * quantity;
        if (msg.value != cost) revert IncorrectPayment();

        t.sold += quantity;
        e.ticketCount += quantity;
        e.soldAmount += cost;
        _hostStats[e.host].ticketsSold += quantity;

        firstTicketId = ticketCount + 1;
        ticketCount += quantity;

        uint256[] storage eventTickets = _eventTickets[eventId];
        uint256[] storage owned = _buyerTickets[msg.sender];
        for (uint256 i; i < quantity; ++i) {
            uint256 id = firstTicketId + i;
            _tickets[id] = Ticket({holder: msg.sender, tier: tier, status: TicketStatus.Valid, eventId: eventId});
            eventTickets.push(id);
            owned.push(id);
        }

        emit TicketsPurchased(eventId, msg.sender, tier, firstTicketId, quantity, cost);
    }

    /// @notice Refunds tickets that were never checked in, either after a cancellation or during
    /// the claim window that follows the event.
    function claimRefund(uint256[] calldata ticketIds, address to) external nonReentrant returns (uint256 amount) {
        uint256 n = ticketIds.length;
        if (n == 0 || n > MAX_BATCH) revert InvalidQuantity();
        if (to == address(0)) revert ZeroAddress();

        for (uint256 i; i < n; ++i) {
            uint256 id = ticketIds[i];
            Ticket storage t = _tickets[id];
            if (t.holder != msg.sender) revert NotTicketHolder();
            if (t.status != TicketStatus.Valid) revert TicketNotValid();

            Event storage e = _events[t.eventId];
            if (!_refundOpen(e)) revert NotRefundable();

            uint256 price = _tiers[t.eventId][t.tier].price;
            t.status = TicketStatus.Refunded;
            e.refundedCount++;
            e.refundedAmount += price;
            _hostStats[e.host].ticketsRefunded++;
            amount += price;

            emit Refunded(t.eventId, id, msg.sender, price);
        }

        Address.sendValue(payable(to), amount);
    }

    /// @notice Submitted by the host or a door device. The signature must come from the wallet
    /// holding every listed ticket, and is only accepted within MAX_SIGNATURE_TTL of its deadline,
    /// so check-ins can't be collected ahead of time.
    function checkIn(uint256[] calldata ticketIds, uint256 deadline, bytes calldata signature) external {
        uint256 n = ticketIds.length;
        if (n == 0 || n > MAX_BATCH) revert InvalidQuantity();

        Ticket storage first = _tickets[ticketIds[0]];
        if (first.status == TicketStatus.None) revert InvalidTicket();
        uint256 eventId = first.eventId;
        address holder = first.holder;

        Event storage e = _events[eventId];
        if (msg.sender != e.host && !_staff[eventId].contains(msg.sender)) revert NotStaff();
        if (e.cancelled) revert EventIsCancelled();
        if (block.timestamp < e.checkInOpensAt || block.timestamp > e.endTime) revert CheckInClosed();
        if (deadline < block.timestamp || deadline > block.timestamp + MAX_SIGNATURE_TTL) revert InvalidDeadline();
        if (!_signedBy(holder, checkInDigest(ticketIds, deadline), signature)) revert InvalidSignature();

        (uint256 amount, uint32 count) = _markCheckedIn(eventId, holder, ticketIds);

        e.checkedInCount += count;
        e.checkedInAmount += amount;
        _hostStats[e.host].ticketsCheckedIn += count;
    }

    function checkInDigest(uint256[] calldata ticketIds, uint256 deadline) public view returns (bytes32) {
        return
            _hashTypedDataV4(keccak256(abi.encode(CHECK_IN_TYPEHASH, keccak256(abi.encodePacked(ticketIds)), deadline)));
    }

    function getEvent(uint256 eventId) external view returns (Event memory) {
        return _event(eventId);
    }

    function getTiers(uint256 eventId) external view returns (Tier[] memory) {
        _event(eventId);
        return _tiers[eventId];
    }

    function getTicket(uint256 ticketId) external view returns (TicketView memory) {
        if (_tickets[ticketId].status == TicketStatus.None) revert InvalidTicket();
        return _ticketView(ticketId);
    }

    function getHostEvents(address host, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory ids, uint256 total)
    {
        uint256[] storage all = _hostEvents[host];
        total = all.length;
        (uint256 start, uint256 end) = _page(total, offset, limit);
        ids = new uint256[](end - start);
        for (uint256 i = start; i < end; ++i) {
            ids[i - start] = all[i];
        }
    }

    function getEventTickets(uint256 eventId, uint256 offset, uint256 limit)
        external
        view
        returns (TicketView[] memory tickets, uint256 total)
    {
        return _ticketPage(_eventTickets[eventId], offset, limit);
    }

    function getBuyerTickets(address buyer, uint256 offset, uint256 limit)
        external
        view
        returns (TicketView[] memory tickets, uint256 total)
    {
        return _ticketPage(_buyerTickets[buyer], offset, limit);
    }

    function getStaff(uint256 eventId) external view returns (address[] memory) {
        return _staff[eventId].values();
    }

    function isStaff(uint256 eventId, address account) external view returns (bool) {
        return _staff[eventId].contains(account);
    }

    function getHostStats(address host) external view returns (HostStats memory) {
        return _hostStats[host];
    }

    function withdrawable(uint256 eventId) external view returns (uint256) {
        return _withdrawable(_event(eventId));
    }

    function isRefundable(uint256 ticketId) external view returns (bool) {
        Ticket storage t = _tickets[ticketId];
        return t.status == TicketStatus.Valid && _refundOpen(_events[t.eventId]);
    }

    function _event(uint256 eventId) private view returns (Event storage e) {
        e = _events[eventId];
        if (e.host == address(0)) revert EventNotFound();
    }

    function _hostEvent(uint256 eventId) private view returns (Event storage e) {
        e = _event(eventId);
        if (e.host != msg.sender) revert NotHost();
    }

    function _withdrawable(Event storage e) private view returns (uint256) {
        uint256 earned = !e.cancelled && block.timestamp > e.endTime + CLAIM_WINDOW
            ? e.soldAmount - e.refundedAmount
            : e.checkedInAmount;
        return earned - e.withdrawnAmount;
    }

    function _refundOpen(Event storage e) private view returns (bool) {
        if (e.cancelled) return true;
        return block.timestamp > e.endTime && block.timestamp <= e.endTime + CLAIM_WINDOW;
    }

    function _markCheckedIn(uint256 eventId, address holder, uint256[] calldata ticketIds)
        private
        returns (uint256 amount, uint32 count)
    {
        Tier[] storage tiers = _tiers[eventId];
        for (uint256 i; i < ticketIds.length; ++i) {
            Ticket storage t = _tickets[ticketIds[i]];
            if (t.eventId != eventId || t.holder != holder) revert TicketMismatch();
            if (t.status != TicketStatus.Valid) revert TicketNotValid();

            t.status = TicketStatus.CheckedIn;
            amount += tiers[t.tier].price;
            ++count;

            emit CheckedIn(eventId, ticketIds[i], msg.sender);
        }
    }

    // A plain ECDSA signature from the holder is always accepted, even if the account has code, so that
    // EIP-7702 delegated EOAs work whether or not their delegate implements ERC-1271.
    function _signedBy(address holder, bytes32 digest, bytes calldata signature) private view returns (bool) {
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        if (err == ECDSA.RecoverError.NoError && recovered == holder) return true;
        return holder.code.length != 0 && SignatureChecker.isValidERC1271SignatureNow(holder, digest, signature);
    }

    function _checkDetails(string calldata name, string calldata venue, string calldata description) private pure {
        uint256 nameLength = bytes(name).length;
        if (nameLength == 0 || nameLength > MAX_NAME_LENGTH) revert InvalidDetails();
        if (bytes(venue).length > MAX_VENUE_LENGTH) revert InvalidDetails();
        if (bytes(description).length > MAX_DESCRIPTION_LENGTH) revert InvalidDetails();
    }

    function _ticketView(uint256 ticketId) private view returns (TicketView memory) {
        Ticket storage t = _tickets[ticketId];
        return TicketView({
            id: ticketId,
            eventId: t.eventId,
            holder: t.holder,
            tier: t.tier,
            price: _tiers[t.eventId][t.tier].price,
            status: t.status
        });
    }

    function _ticketPage(uint256[] storage ids, uint256 offset, uint256 limit)
        private
        view
        returns (TicketView[] memory tickets, uint256 total)
    {
        total = ids.length;
        (uint256 start, uint256 end) = _page(total, offset, limit);
        tickets = new TicketView[](end - start);
        for (uint256 i = start; i < end; ++i) {
            tickets[i - start] = _ticketView(ids[i]);
        }
    }

    function _page(uint256 total, uint256 offset, uint256 limit) private pure returns (uint256 start, uint256 end) {
        start = offset < total ? offset : total;
        end = limit > total - start ? total : start + limit;
    }
}
