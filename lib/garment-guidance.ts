export const GARMENT_TYPES = [
  "auto",
  "ao-dai",
  "ngu-than",
  "ao-tac",
  "nhat-binh",
  "giao-linh",
  "vien-linh",
] as const;

export type GarmentType = (typeof GARMENT_TYPES)[number];

const NAMES: Record<GarmentType, string> = {
  auto: "the reference garment",
  "ao-dai": "Vietnamese ao dai",
  "ngu-than": "Vietnamese ngu than robe",
  "ao-tac": "Vietnamese ao tac robe",
  "nhat-binh": "Vietnamese nhat binh robe",
  "giao-linh": "Vietnamese giao linh robe",
  "vien-linh": "Vietnamese vien linh robe",
};

export function parseGarmentType(value: unknown): GarmentType {
  return typeof value === "string" &&
    GARMENT_TYPES.includes(value as GarmentType)
    ? (value as GarmentType)
    : "auto";
}

export function needsFullBody(product: {
  category: string;
  garmentType?: GarmentType;
}): boolean {
  return (
    product.category === "full-body" ||
    Boolean(product.garmentType && product.garmentType !== "auto")
  );
}

export function getCameraGuidance(product: {
  category: string;
  garmentType?: GarmentType;
}): string {
  if (needsFullBody(product)) {
    return "Đứng lùi để camera thấy rõ từ vai đến bàn chân, giữ hai tay cách thân để nhìn rõ tay áo và tà áo.";
  }

  if (product.category === "bottom") {
    return "Để camera thấy rõ phần eo và chân.";
  }

  return "Để camera thấy rõ vai, thân trên và hai tay.";
}

export function getFallbackPrompt(product: {
  category: string;
  garmentType?: GarmentType;
}): string {
  const name = NAMES[product.garmentType || "auto"];

  const target = needsFullBody(product)
    ? "clothing in the area covered by the reference garment"
    : product.category === "bottom"
      ? "bottom"
      : "top";

  return `Substitute the current ${target} with ${name} shown in the reference image. Preserve its visible colors, patterns, neckline, sleeves and hem length; keep the person's face, pose and background unchanged.`;
}

export const VIET_PHUC_GUIDANCE = `
The reference may show modern clothing or Vietnamese ao dai, ngu than, ao tac,
nhat binh, giao linh or vien linh. These are garment descriptions, not a claim
that the video model perfectly supports each type.
Treat the image as the source of truth. Product metadata is only a hint.
Describe visible neckline/collar, sleeve width and length, hem length, side slits,
front panels and the placement of motifs when visible.
Preserve the actual cut; do not turn a loose robe into a fitted dress or
substitute a different culture's clothing.
Do not invent hidden panels, materials, embroidery or historical details.
Do not transfer a reference person's face, hair, pose or background.
Do not add a hat, jewelry, fan, shoes or trousers unless explicitly requested;
trousers/skirt clearly included in a complete reference outfit may be described.
For a long garment, replace clothing over the full visible garment area,
not just an upper-body shirt.
Keep the target person's face, pose and background unchanged.
`;

export interface FitDecision {
  ok: boolean;
  checked: boolean;
  message?: string;
}

export function parseFitDecision(raw: string): FitDecision {
  const unchecked: FitDecision = {
    ok: true,
    checked: false,
    message:
      "Chưa kiểm tra được khung camera. Hãy làm theo hướng dẫn của trang phục trước khi thử.",
  };

  try {
    const value: unknown = JSON.parse(raw);

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return unchecked;
    }

    const result = value as Record<string, unknown>;

    if (
      typeof result.ok !== "boolean" ||
      typeof result.supported !== "boolean"
    ) {
      return unchecked;
    }

    if (!result.supported) {
      return {
        ok: false,
        checked: true,
        message:
          "Mẫu này chưa được nhận diện là trang phục phù hợp để thử. Hãy chọn ảnh chỉ có áo hoặc bộ trang phục rõ ràng.",
      };
    }

    if (result.ok) {
      return { ok: true, checked: true };
    }

    return {
      ok: false,
      checked: true,
      message:
        result.visibility === "full-body"
          ? "Áo có tà dài cần camera thấy rõ từ vai đến bàn chân. Hãy đứng lùi và giữ hai tay cách thân."
          : "Camera chưa thấy đủ vùng cơ thể cần thử. Hãy chỉnh góc quay để nhìn rõ vùng đó và hai tay.",
    };
  } catch {
    return unchecked;
  }
}