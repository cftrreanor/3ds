import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The Field Command Events icon: browser tabs, bookmarks and search results.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** Inter ExtraBold Italic (SIL Open Font License, see fonts/INTER-LICENSE.txt). */
export async function markFont() {
  const data = await readFile(join(process.cwd(), "src/app/fonts/inter-800-italic.woff"));
  return [{ name: "Inter", data, weight: 800 as const, style: "italic" as const }];
}

export default async function Icon() {
  return new ImageResponse(<Mark size={512} />, { ...size, fonts: await markFont() });
}

/** "FC" in bold italic white on the brand's indigo navy, with a violet underline. */
export function Mark({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#1b1938",
        borderRadius: size * 0.22,
      }}
    >
      <div
        style={{
          display: "flex",
          color: "white",
          fontFamily: "Inter",
          fontSize: size * 0.5,
          fontWeight: 800,
          fontStyle: "italic",
          letterSpacing: -size * 0.02,
          lineHeight: 1,
          marginTop: -size * 0.04,
        }}
      >
        FC
      </div>
      <div style={{ display: "flex", width: size * 0.46, height: size * 0.06, marginTop: size * 0.04, borderRadius: size, background: "#c9b4fa" }} />
    </div>
  );
}
