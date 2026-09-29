import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

const messages: Record<string, string> = {
  EventNotFound: "This event doesn't exist.",
  NotHost: "Only the host of this event can do that.",
  NotStaff: "This device isn't authorized to check people in for this event.",
  InvalidDetails: "Check the name, venue and description lengths.",
  InvalidTiming: "Check the event times. It must start in the future and last at most 30 days.",
  InvalidTiers: "Every tier needs a name and at least one seat, with up to 10 tiers.",
  InvalidPrice: "Ticket prices must be at least $0.01.",
  EventIsCancelled: "This event has been cancelled.",
  SalesClosed: "Ticket sales have closed for this event.",
  TierNotFound: "That ticket tier doesn't exist.",
  SoldOut: "Not enough tickets left in this tier.",
  InvalidQuantity: "You can handle up to 20 tickets at a time.",
  IncorrectPayment: "The payment amount didn't match the ticket price.",
  CheckInClosed: "Check-in isn't open for this event right now.",
  InvalidDeadline: "This check-in code has expired. Ask for a fresh one.",
  InvalidSignature: "This check-in code wasn't signed by the ticket holder.",
  InvalidTicket: "That ticket doesn't exist.",
  TicketMismatch: "These tickets don't all belong to the same holder and event.",
  TicketNotValid: "Already checked in or refunded.",
  NotTicketHolder: "Only the ticket holder can do that.",
  NotRefundable: "This ticket can't be refunded right now.",
  NothingToWithdraw: "There's nothing to withdraw yet.",
  CannotCancel: "This event can no longer be cancelled.",
  ZeroAddress: "That address isn't valid.",
};

export function errorName(error: unknown): string | undefined {
  if (!(error instanceof BaseError)) return undefined;
  const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
  if (reverted instanceof ContractFunctionRevertedError) return reverted.data?.errorName;
  return undefined;
}

export function friendlyError(error: unknown): string {
  if (!error) return "";
  if (error instanceof BaseError) {
    if (error.walk((e) => e instanceof UserRejectedRequestError)) return "You rejected the request in your wallet.";
    const name = errorName(error);
    if (name && messages[name]) return messages[name];
    if (/insufficient funds/i.test(error.message)) return "Not enough USDC in your wallet for this, including gas.";
    return error.shortMessage;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
