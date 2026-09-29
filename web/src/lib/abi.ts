export const turnoutAbi = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "CLAIM_WINDOW",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "DEFAULT_CHECK_IN_LEAD",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_BATCH",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_CHECK_IN_LEAD",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_EVENT_DURATION",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_SIGNATURE_TTL",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_TIERS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_PRICE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PRICE_UNIT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "addStaff",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "staff",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "buyTickets",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "tier",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "quantity",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [
      {
        "name": "firstTicketId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "cancelEvent",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "checkIn",
    "inputs": [
      {
        "name": "ticketIds",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "deadline",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "signature",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "checkInDigest",
    "inputs": [
      {
        "name": "ticketIds",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "deadline",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "claimRefund",
    "inputs": [
      {
        "name": "ticketIds",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createEvent",
    "inputs": [
      {
        "name": "input",
        "type": "tuple",
        "internalType": "struct Turnout.EventInput",
        "components": [
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "venue",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "description",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "imageURI",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "startTime",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "endTime",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "checkInOpensAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "tiers",
            "type": "tuple[]",
            "internalType": "struct Turnout.TierInput[]",
            "components": [
              {
                "name": "name",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "price",
                "type": "uint128",
                "internalType": "uint128"
              },
              {
                "name": "capacity",
                "type": "uint32",
                "internalType": "uint32"
              }
            ]
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "eip712Domain",
    "inputs": [],
    "outputs": [
      {
        "name": "fields",
        "type": "bytes1",
        "internalType": "bytes1"
      },
      {
        "name": "name",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "version",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "chainId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "verifyingContract",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "salt",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "extensions",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "eventCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getBuyerTickets",
    "inputs": [
      {
        "name": "buyer",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "tickets",
        "type": "tuple[]",
        "internalType": "struct Turnout.TicketView[]",
        "components": [
          {
            "name": "id",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "eventId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "holder",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "tier",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "price",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "enum Turnout.TicketStatus"
          }
        ]
      },
      {
        "name": "total",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getEvent",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct Turnout.Event",
        "components": [
          {
            "name": "host",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "startTime",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "endTime",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "checkInOpensAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "cancelled",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "ticketCount",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "checkedInCount",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "refundedCount",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "soldAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "checkedInAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "refundedAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "withdrawnAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "venue",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "description",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "imageURI",
            "type": "string",
            "internalType": "string"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getEventTickets",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "tickets",
        "type": "tuple[]",
        "internalType": "struct Turnout.TicketView[]",
        "components": [
          {
            "name": "id",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "eventId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "holder",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "tier",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "price",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "enum Turnout.TicketStatus"
          }
        ]
      },
      {
        "name": "total",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getHostEvents",
    "inputs": [
      {
        "name": "host",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "ids",
        "type": "uint256[]",
        "internalType": "uint256[]"
      },
      {
        "name": "total",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getHostStats",
    "inputs": [
      {
        "name": "host",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct Turnout.HostStats",
        "components": [
          {
            "name": "eventsCreated",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "eventsCancelled",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "ticketsSold",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "ticketsCheckedIn",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "ticketsRefunded",
            "type": "uint64",
            "internalType": "uint64"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getStaff",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address[]",
        "internalType": "address[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTicket",
    "inputs": [
      {
        "name": "ticketId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct Turnout.TicketView",
        "components": [
          {
            "name": "id",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "eventId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "holder",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "tier",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "price",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "enum Turnout.TicketStatus"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTiers",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct Turnout.Tier[]",
        "components": [
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "price",
            "type": "uint128",
            "internalType": "uint128"
          },
          {
            "name": "capacity",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "sold",
            "type": "uint32",
            "internalType": "uint32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "hostName",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isRefundable",
    "inputs": [
      {
        "name": "ticketId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isStaff",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "removeStaff",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "staff",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setHostName",
    "inputs": [
      {
        "name": "name",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "ticketCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "updateEventDetails",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "name",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "venue",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "description",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "imageURI",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdraw",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdrawable",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "CheckedIn",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "ticketId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "staff",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EIP712DomainChanged",
    "inputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EventCancelled",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EventCreated",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "host",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EventDetailsUpdated",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "HostNameSet",
    "inputs": [
      {
        "name": "host",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "name",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Refunded",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "ticketId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "holder",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "StaffAdded",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "staff",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "StaffRemoved",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "staff",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "TicketsPurchased",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "buyer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "tier",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      },
      {
        "name": "firstTicketId",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "quantity",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Withdrawn",
    "inputs": [
      {
        "name": "eventId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "to",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "CannotCancel",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CheckInClosed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "EventIsCancelled",
    "inputs": []
  },
  {
    "type": "error",
    "name": "EventNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "FailedCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "IncorrectPayment",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InsufficientBalance",
    "inputs": [
      {
        "name": "balance",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "needed",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "InvalidDeadline",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidDetails",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidPrice",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidQuantity",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidShortString",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidSignature",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidTicket",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidTiers",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidTiming",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotHost",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotRefundable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotStaff",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotTicketHolder",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NothingToWithdraw",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SalesClosed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SoldOut",
    "inputs": []
  },
  {
    "type": "error",
    "name": "StringTooLong",
    "inputs": [
      {
        "name": "str",
        "type": "string",
        "internalType": "string"
      }
    ]
  },
  {
    "type": "error",
    "name": "TicketMismatch",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TicketNotValid",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TierNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
] as const;
