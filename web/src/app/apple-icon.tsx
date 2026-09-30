import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f2f1ec" }}>
        <div style={{ width: 132, height: 132, borderRadius: 999, background: "#0e0e0c", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 22 }}>
          <div style={{ width: 38, height: 38, borderRadius: 999, background: "#ffe14a" }} />
        </div>
      </div>
    ),
    size,
  );
}
