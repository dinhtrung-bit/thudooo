// FILE: app/api/validate-fit/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  parseFitDecision,
  parseGarmentType,
  VIET_PHUC_GUIDANCE,
} from "@/lib/garment-guidance";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `
You check whether a reference garment has enough body area visible in a camera
frame for virtual try-on. This is a framing check, not sizing or a guarantee
that the video model can reproduce the garment.
${VIET_PHUC_GUIDANCE}

Supported garment families for this application's framing check:
tops, jackets, coats, dresses, robes including Vietnamese garments,
pants, skirts, shoes, hats, scarves and glasses.
A complete clothing outfit also counts.
Reject non-clothing objects such as furniture, bags, watches and jewelry.

Classify visibility as top, bottom, full-body or accessory.

Long ao dai, ngu than, ao tac, nhat binh, giao linh, vien linh and long
dresses/robes need full-body framing:
shoulders, torso, arms and legs down to feet visible.

Do not classify a long robe as a short top just because its hem is cropped.
A full-body catalog hint requires full-body framing, even if the type is uncertain.

Short tops/outerwear need shoulders and torso visible.
Bottoms need waist and legs.
Shoes need feet.
Accessories need their relevant body area visible.

No person means ok=false.
For a clearly cropped required area return ok=false.

Return ONLY JSON with boolean ok, boolean supported, and visibility.
Do not return prose or markdown.
`;

function unchecked(message: string) {
  return NextResponse.json({
    ok: true,
    checked: false,
    message,
  });
}

function isValidImage(
  value: FormDataEntryValue | null
): value is File {
  return (
    value instanceof File &&
    value.size > 0 &&
    value.size <= 10 * 1024 * 1024 &&
    ["image/jpeg", "image/png", "image/webp"].includes(
      value.type
    )
  );
}

async function imageUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

export async function POST(req: NextRequest) {
  const controller = new AbortController();
  const abort = () => controller.abort();

  if (req.signal.aborted) {
    abort();
  } else {
    req.signal.addEventListener("abort", abort, {
      once: true,
    });
  }

  const timer = setTimeout(abort, 18_000);

  try {
    const form = await req.formData();
    const image = form.get("image");
    const frame = form.get("personFrame");

    if (!isValidImage(image) || !isValidImage(frame)) {
      return NextResponse.json(
        {
          error:
            "Ảnh trang phục và camera phải là JPG, PNG hoặc WebP, tối đa 10 MB mỗi ảnh.",
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return unchecked(
        "Chưa cấu hình kiểm tra camera. Hãy làm theo hướng dẫn của trang phục trước khi thử."
      );
    }

    const garmentType = parseGarmentType(
      form.get("garmentType")
    );

    const fullBody =
      form.get("category") === "full-body" ||
      garmentType !== "auto";

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 150,
          response_format: {
            type: "json_object",
          },
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Reference garment. Catalog type: ${garmentType}. Full-body framing required: ${fullBody}. Verify the garment against this image.`,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: await imageUrl(image),
                    detail: "auto",
                  },
                },
                {
                  type: "text",
                  text: "Target person's camera frame:",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: await imageUrl(frame),
                    detail: "auto",
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      return unchecked(
        "Dịch vụ kiểm tra camera chưa sẵn sàng. Hãy kiểm tra khung hình theo hướng dẫn của trang phục."
      );
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;

    return NextResponse.json(
      parseFitDecision(
        typeof raw === "string" ? raw : ""
      )
    );
  } catch {
    return unchecked(
      "Chưa kiểm tra được camera. Hãy chỉnh khung hình theo hướng dẫn của trang phục trước khi thử."
    );
  } finally {
    clearTimeout(timer);
    req.signal.removeEventListener("abort", abort);
  }
}