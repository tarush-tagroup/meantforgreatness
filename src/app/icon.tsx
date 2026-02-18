import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 6,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 300,
            color: "#FEFAE0",
            letterSpacing: 1,
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
