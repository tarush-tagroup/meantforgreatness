import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Meant for Greatness — English Education for Orphan Kids in Bali";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0A400C",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 80px",
        }}
      >
        {/* Main title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#FEFAE0",
            textAlign: "center",
            lineHeight: 1.1,
            marginBottom: 24,
          }}
        >
          Meant for Greatness
        </div>

        {/* Divider line */}
        <div
          style={{
            width: 120,
            height: 4,
            background: "#819067",
            borderRadius: 2,
            marginBottom: 24,
          }}
        />

        {/* Subtitle */}
        <div
          style={{
            fontSize: 32,
            fontWeight: 400,
            color: "#C8D6B0",
            textAlign: "center",
            lineHeight: 1.4,
            maxWidth: 800,
          }}
        >
          English Education for Orphan Kids in Bali
        </div>

        {/* URL */}
        <div
          style={{
            fontSize: 20,
            color: "#819067",
            marginTop: 40,
            letterSpacing: 1,
          }}
        >
          meantforgreatness.org
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
