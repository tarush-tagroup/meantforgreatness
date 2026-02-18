import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A400C",
          borderRadius: 36,
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 300,
            color: "#FEFAE0",
            letterSpacing: 4,
          }}
        >
          mfg
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
