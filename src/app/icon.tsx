import { ImageResponse } from "next/og";

export const size = { width: 256, height: 256 };
export const contentType = "image/png";

// Generated favicon — soft violet circle with a simple lotus-like mark.
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
          background:
            "radial-gradient(circle at 35% 30%, #b89cde 0%, #7b5cb8 60%, #5a3d95 100%)",
          borderRadius: 48,
        }}
      >
        <svg viewBox="0 0 24 24" width="160" height="160" fill="none" stroke="#fcf8f2" strokeWidth="1.2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3c2.5 3 2.5 6 0 9-2.5-3-2.5-6 0-9ZM3 12c3 2.5 6 2.5 9 0-3-2.5-6-2.5-9 0Zm18 0c-3 2.5-6 2.5-9 0 3-2.5 6-2.5 9 0ZM12 21c-2.5-3-2.5-6 0-9 2.5 3 2.5 6 0 9Z"
          />
          <circle cx="12" cy="12" r="1.4" fill="#fcf8f2" />
        </svg>
      </div>
    ),
    size,
  );
}
