import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon for iOS (PNG generated at build time). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#3f6a4f" }}>
        <svg width="120" height="120" viewBox="0 0 64 64">
          <path d="M20 44c0-14 10-24 26-26-1 15-10 26-24 26" fill="#faf7f2" />
          <path d="M20 46c4-8 10-14 18-19" stroke="#3f6a4f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    ),
    size,
  );
}
