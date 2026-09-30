"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function QrCode({ value, className = "", label }: { value: string; className?: string; label: string }) {
  const [svg, setSvg] = useState<string>();

  useEffect(() => {
    let live = true;
    QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0e0e0c", light: "#ffffff" } }).then((s) => {
      if (live) setSvg(s);
    });
    return () => {
      live = false;
    };
  }, [value]);

  return (
    <div
      role="img"
      aria-label={label}
      className={`aspect-square w-full bg-white [&>svg]:h-full [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
