import { createDecartClient } from "@decartai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const apiKey = process.env.DECART_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Máy chủ chưa cấu hình DECART_API_KEY.",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  try {
    const client = createDecartClient({ apiKey });
    const token = await client.tokens.create();

    if (!token.apiKey) {
      throw new Error("Invalid token response");
    }

    return NextResponse.json(
      { apiKey: token.apiKey },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    const code =
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : "TOKEN_CREATE_FAILED";

    console.error("Decart token creation failed:", code);

    return NextResponse.json(
      {
        error: `Không tạo được phiên Decart. Mã lỗi: ${code}.`,
      },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}