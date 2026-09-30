import { ImageResponse } from "next/og";

export const alt = "Turnout: event tickets paid in USDC, released to the host at the door";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function archivo(axes: string) {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@${axes}&display=swap`).then((r) => r.text());
  const url = css.match(/src: url\((.+?)\) format\('truetype'\)/)?.[1];
  if (!url) throw new Error("Archivo font not found");
  return fetch(url).then((r) => r.arrayBuffer());
}

export default async function OpengraphImage() {
  const [display, body] = await Promise.all([archivo("62.5,800"), archivo("100,500")]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f2f1ec", color: "#0e0e0c", padding: 64, fontFamily: "Body" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 999, background: "#0e0e0c", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 7 }}>
            <div style={{ width: 13, height: 13, borderRadius: 999, background: "#ffe14a" }} />
          </div>
          <span style={{ fontFamily: "Display", fontSize: 40, fontWeight: 800 }}>TURNOUT</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontFamily: "Display", fontSize: 190, fontWeight: 800, lineHeight: 0.84 }}>
          <span>PAID AT</span>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <div style={{ width: 220, height: 112, borderRadius: 999, background: "#0e0e0c", display: "flex", paddingLeft: 70 }}>
              <div style={{ width: 26, height: 112, background: "#ffe14a" }} />
            </div>
            <span>THE DOOR.</span>
          </div>
        </div>
        <span style={{ fontSize: 30, color: "#55544e" }}>Tickets in USDC, escrowed on Arc. Hosts are paid when you&apos;re checked in.</span>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Display", data: display, weight: 800 },
        { name: "Body", data: body, weight: 500 },
      ],
    },
  );
}
