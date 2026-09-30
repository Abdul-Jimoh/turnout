"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onScan: (value: string) => void;
  paused?: boolean;
  className?: string;
};

// Camera QR scanner. Uses the native BarcodeDetector where it exists (Chrome, Android) and a
// zxing-wasm ponyfill elsewhere (iOS Safari, Firefox).
export function Scanner({ onScan, paused = false, className = "" }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  const [error, setError] = useState<string>();

  useEffect(() => {
    onScanRef.current = onScan;
    pausedRef.current = paused;
  });

  useEffect(() => {
    let stream: MediaStream | undefined;
    let frame = 0;
    let stopped = false;
    let last = "";
    let lastAt = 0;

    async function start() {
      try {
        const Detector =
          "BarcodeDetector" in window
            ? (window as unknown as { BarcodeDetector: typeof import("barcode-detector/ponyfill").BarcodeDetector }).BarcodeDetector
            : (await import("barcode-detector/ponyfill")).BarcodeDetector;
        const detector = new Detector({ formats: ["qr_code"] });

        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();

        const tick = async () => {
          if (stopped) return;
          const el = video.current;
          if (el && el.readyState >= 2 && !pausedRef.current) {
            try {
              const [code] = await detector.detect(el);
              const now = Date.now();
              if (code?.rawValue && (code.rawValue !== last || now - lastAt > 4000)) {
                last = code.rawValue;
                lastAt = now;
                onScanRef.current(code.rawValue);
              }
            } catch {
              // a single bad frame is fine; keep scanning
            }
          }
          frame = window.setTimeout(() => requestAnimationFrame(tick), 180);
        };
        tick();
      } catch (e) {
        setError(e instanceof DOMException && e.name === "NotAllowedError" ? "Camera access was blocked. Allow it in your browser settings." : "Couldn't start the camera.");
      }
    }

    start();
    return () => {
      stopped = true;
      clearTimeout(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className={`relative overflow-hidden bg-ink ${className}`}>
      <video ref={video} muted playsInline className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-[12%] border-2 border-signal" />
      <div className="pointer-events-none absolute inset-x-[12%] top-1/2 h-px bg-signal/70" />
      {error && <p className="absolute inset-x-4 bottom-4 bg-alert p-3 text-sm text-ink">{error}</p>}
    </div>
  );
}
