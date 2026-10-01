import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const SUPPORTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const SYSTEM_PROMPT = `
Write a concise English prompt for a virtual try-on model.

You receive:
1. A reference garment image.
2. Optionally, a camera frame of the person.

The wardrobe contains tops and jackets.

Instructions:
- Describe only visible features of the reference garment.
- Include visible color, pattern, shape and garment type.
- Do not invent materials, logos, fasteners or hidden details.
- Use "Substitute the current top with..." for a top.
- For outerwear, choose a clear substitute or add instruction
  appropriate to what is visible in the camera frame.
- If the camera frame is unclear, refer to "the current top".
- Keep the prompt between 20 and 35 words.
- Return only the prompt, without markdown or quotation marks.
`;

function validateImage(file: File): string | null {
  if (!SUPPORTED_TYPES.includes(file.type)) {
    return "Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.";
  }

  if (file.size === 0) {
    return "Ảnh đang rỗng.";
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return "Ảnh vượt quá giới hạn 10 MB.";
  }

  return null;
}

async function toDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());

  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

type ContentPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image_url";
      image_url: {
        url: string;
        detail: "auto" | "low";
      };
    };

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Dịch vụ tạo mô tả chưa được cấu hình.",
      },
      { status: 503 }
    );
  }

  const controller = new AbortController();
  let timedOut = false;

  const handleAbort = () => controller.abort();

  if (req.signal.aborted) {
    controller.abort();
  } else {
    req.signal.addEventListener("abort", handleAbort, {
      once: true,
    });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 20_000);

  try {
    const formData = await req.formData();

    const image = formData.get("image");
    const personFrame = formData.get("personFrame");

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "Thiếu ảnh trang phục." },
        { status: 400 }
      );
    }

    const imageError = validateImage(image);

    if (imageError) {
      return NextResponse.json(
        { error: imageError },
        { status: 400 }
      );
    }

    if (
      personFrame !== null &&
      !(personFrame instanceof File)
    ) {
      return NextResponse.json(
        { error: "Khung hình camera không hợp lệ." },
        { status: 400 }
      );
    }

    if (personFrame instanceof File) {
      const frameError = validateImage(personFrame);

      if (frameError) {
        return NextResponse.json(
          { error: frameError },
          { status: 400 }
        );
      }
    }

    const content: ContentPart[] = [
      {
        type: "text",
        text: "Reference garment:",
      },
      {
        type: "image_url",
        image_url: {
          url: await toDataUrl(image),
          detail: "auto",
        },
      },
    ];

    if (personFrame instanceof File) {
      content.push(
        {
          type: "text",
          text: "Person's camera frame:",
        },
        {
          type: "image_url",
          image_url: {
            url: await toDataUrl(personFrame),
            detail: "low",
          },
        }
      );
    }

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
          model: "gpt-4o-mini",
          max_tokens: 200,
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },
            {
              role: "user",
              content,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      console.error(
        "enhance-prompt upstream status:",
        response.status
      );

      return NextResponse.json(
        {
          error:
            "Dịch vụ tạo mô tả đang gặp lỗi. Sẽ sử dụng mô tả dự phòng.",
        },
        { status: 502 }
      );
    }

    const data = await response.json();
    const rawPrompt = data.choices?.[0]?.message?.content;

    if (
      typeof rawPrompt !== "string" ||
      !rawPrompt.trim()
    ) {
      return NextResponse.json(
        { error: "AI chưa trả về mô tả hợp lệ." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      prompt: rawPrompt.trim(),
    });
  } catch {
    return NextResponse.json(
      {
        error: timedOut
          ? "Tạo mô tả quá thời gian chờ."
          : "Không thể hoàn thành yêu cầu tạo mô tả.",
      },
      { status: timedOut ? 504 : 502 }
    );
  } finally {
    clearTimeout(timer);

    req.signal.removeEventListener(
      "abort",
      handleAbort
    );
  }
}