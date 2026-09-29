import type { Metadata } from "next";
import { createPublicClient, http } from "viem";
import { turnoutAbi } from "@/lib/abi";
import { chain, turnoutAddress } from "@/lib/config";
import { eventDate, eventTime } from "@/lib/format";
import { imageUrl } from "@/lib/ipfs";

const client = createPublicClient({ chain, transport: http() });

export async function generateMetadata({ params }: LayoutProps<"/events/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !turnoutAddress) return { title: "Event" };

  try {
    const event = await client.readContract({ address: turnoutAddress, abi: turnoutAbi, functionName: "getEvent", args: [BigInt(id)] });
    const when = `${eventDate(event.startTime)}, ${eventTime(event.startTime)}`;
    const description = [when, event.venue, "Tickets in USDC, held in escrow until you're checked in."].filter(Boolean).join(" · ");
    const image = imageUrl(event.imageURI);
    return {
      title: event.name,
      description,
      openGraph: { title: event.name, description, type: "website", ...(image && { images: [{ url: image }] }) },
      twitter: { card: image ? "summary_large_image" : "summary", title: event.name, description, ...(image && { images: [image] }) },
    };
  } catch {
    return { title: "Event" };
  }
}

export default function EventLayout({ children }: LayoutProps<"/events/[id]">) {
  return children;
}
