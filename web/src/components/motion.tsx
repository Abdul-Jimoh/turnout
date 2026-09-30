"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ElementType, type ReactNode } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// clamp() keeps triggers near the bottom of the page reachable even when the page is short.
const START = "clamp(top 92%)";

export function SmoothScroll() {
  const pathname = usePathname();
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    ScrollTrigger.config({ ignoreMobileResize: true });
    // Content loaded from the chain changes the page height after triggers are measured.
    let timer = 0;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
    });
    observer.observe(document.body);
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (reducedMotion()) return;
    const lenis = new Lenis({ lerp: 0.11, smoothWheel: true });
    lenisRef.current = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  useEffect(() => {
    lenisRef.current?.scrollTo(0, { immediate: true });
    ScrollTrigger.refresh();
  }, [pathname]);

  return null;
}

type RevealProps = {
  as?: ElementType;
  type?: "lines" | "fade" | "stagger" | "chars";
  delay?: number;
  className?: string;
  children?: ReactNode;
  onScroll?: boolean;
} & Record<string, unknown>;

export function Reveal({ as = "div", type = "fade", delay = 0, onScroll = true, className, children, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (reducedMotion()) {
        gsap.set(el, { autoAlpha: 1 });
        return;
      }
      const trigger = onScroll ? { trigger: el, start: START, once: true } : undefined;

      if (type === "lines" || type === "chars") {
        gsap.set(el, { autoAlpha: 1 });
        SplitText.create(el, {
          type: type === "chars" ? "lines,chars" : "lines",
          linesClass: "split-line",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(type === "chars" ? self.chars : self.lines, {
              yPercent: 110,
              duration: type === "chars" ? 0.8 : 0.9,
              ease: "expo.out",
              stagger: type === "chars" ? 0.018 : 0.08,
              delay,
              scrollTrigger: trigger,
            }),
        });
        return;
      }

      if (type === "stagger") {
        gsap.set(el, { autoAlpha: 1 });
        const items = gsap.utils.toArray<HTMLElement>(el.children);
        const show = (batch: Element[]) =>
          gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.8, ease: "power3.out", stagger: 0.07, delay, overwrite: true });
        gsap.set(items, { y: 36, autoAlpha: 0 });
        // Each child reveals as it scrolls in, so long stacked lists on phones don't animate off-screen.
        if (onScroll) ScrollTrigger.batch(items, { start: START, once: true, onEnter: show });
        else show(items);
        return;
      }

      gsap.fromTo(el, { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: "power3.out", delay, scrollTrigger: trigger });
    },
    { scope: ref },
  );

  const Tag = as;
  return (
    <Tag ref={ref} className={className} data-reveal="" {...rest}>
      {children}
    </Tag>
  );
}

export function CountUp({ value, format = (n) => Math.round(n).toLocaleString("en-US"), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (reducedMotion()) {
        el.textContent = format(value);
        return;
      }
      const state = { n: 0 };
      gsap.to(state, {
        n: value,
        duration: 1.6,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
        onUpdate: () => {
          el.textContent = format(state.n);
        },
      });
    },
    { dependencies: [value], scope: ref },
  );

  return (
    <span ref={ref} className={className}>
      {format(0)}
    </span>
  );
}
