import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The Field Command Events icon (browser tabs, bookmarks, search results):
// the white logo on the brand's indigo navy, so it shows on any background.
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export async function logoDataUrl() {
  const png = await readFile(join(process.cwd(), "public/logo.png"));
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** The logo (260×160) centered on a rounded navy square. */
export function Mark({ size, logo }: { size: number; logo: string }) {
  const width = Math.round(size * 0.86);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b3558",
        borderRadius: size * 0.2,
      }}
    >
      <img src={logo} width={width} height={Math.round((width * 160) / 260)} alt="" />
    </div>
  );
}

export default async function Icon() {
  return new ImageResponse(<Mark size={192} logo={await logoDataUrl()} />, size);
}
