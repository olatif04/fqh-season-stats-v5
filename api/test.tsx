import { ImageResponse } from "@vercel/og";

export const config = {
  runtime: "edge",
};

export default async function handler(request: Request) {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "800px",
        height: "600px",
        background: "#f0f0f0",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "40px",
        fontFamily: "Arial",
      }}
    >
      Edge function working!
    </div>,
    { width: 800, height: 600 }
  );
}