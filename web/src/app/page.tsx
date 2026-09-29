import { Audiences, Closing, Faq, Hero, HowItWorks, OnSale, Proof, Ticker } from "@/components/home";

export default function Home() {
  return (
    <>
      <Hero />
      <Ticker />
      <Proof />
      <OnSale />
      <HowItWorks />
      <Audiences />
      <Faq />
      <Closing />
    </>
  );
}
