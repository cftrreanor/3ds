import { ImageResponse } from "next/og";
import { logoDataUrl, Mark } from "./icon";

// Home-screen icon on iPhones and iPads.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(<Mark size={180} logo={await logoDataUrl()} />, size);
}
