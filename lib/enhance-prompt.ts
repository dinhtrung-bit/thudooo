import { captureVideoFrame } from "./image-utils";

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function request<T>(
  url: string,
  init: RequestInit,
  read: (response: Response) => Promise<T>,
  signal?: AbortSignal,
  timeout = 20_000
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(
    new DOMException("Yêu cầu quá thời gian. Vui lòng thử lại.", "TimeoutError")
  ), timeout);
  try {
    controller.signal.throwIfAborted();
    const response = await fetch(url, { ...init, signal: controller.signal });
    return await read(response);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) throw error;
    throw new Error("Máy chủ trả về dữ liệu không hợp lệ. Vui lòng thử lại.");
  }
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data ? data.error : null;
    throw new Error(typeof message === "string" ? message : `Yêu cầu thất bại (${response.status}).`);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Máy chủ trả về dữ liệu không hợp lệ.");
  }
  return data as Record<string, unknown>;
}

export async function postJson(
  url: string,
  body?: unknown,
  signal?: AbortSignal,
  timeout = 20_000
): Promise<Record<string, unknown>> {
  return request(url, {
    method: "POST",
    ...(body === undefined ? {} : {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  }, readJson, signal, timeout);
}

export async function fetchGarmentImage(url: string, signal?: AbortSignal): Promise<Blob> {
  return request(url, {}, async (response) => {
    if (!response.ok) throw new Error(`Không thể tải ảnh trang phục (${response.status}).`);
    const blob = await response.blob();
    if (!blob.size || !blob.type.startsWith("image/")) {
      throw new Error("Ảnh trang phục không hợp lệ.");
    }
    return blob;
  }, signal);
}

async function addPersonFrame(form: FormData, video?: HTMLVideoElement | null) {
  if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
    form.append("personFrame", await captureVideoFrame(video));
  }
}

export async function enhancePrompt(
  garmentBlob: Blob,
  localVideo?: HTMLVideoElement | null,
  signal?: AbortSignal
): Promise<string | null> {
  const form = new FormData();
  form.append("image", garmentBlob);
  await addPersonFrame(form, localVideo);
  const data = await request("/api/enhance-prompt", { method: "POST", body: form }, readJson, signal);
  return typeof data.prompt === "string" ? data.prompt.trim() || null : null;
}

export async function generateOutfitPrompt(
  topBlob: Blob,
  bottomBlob: Blob,
  localVideo?: HTMLVideoElement | null,
  signal?: AbortSignal
): Promise<string | null> {
  const form = new FormData();
  form.append("topImage", topBlob);
  form.append("bottomImage", bottomBlob);
  await addPersonFrame(form, localVideo);
  const data = await request("/api/outfit-prompt", { method: "POST", body: form }, readJson, signal);
  return typeof data.prompt === "string" ? data.prompt.trim() || null : null;
}

export interface FitResult {
  ok: boolean;
  checked: boolean;
  message?: string;
}

export async function validateFit(
  garmentBlob: Blob,
  localVideo?: HTMLVideoElement | null,
  signal?: AbortSignal
): Promise<FitResult> {
  signal?.throwIfAborted();
  if (!localVideo || localVideo.readyState < 2 || !localVideo.videoWidth || !localVideo.videoHeight) {
    return { ok: true, checked: false, message: "Camera chưa có khung hình để kiểm tra." };
  }
  const form = new FormData();
  form.append("image", garmentBlob);
  await addPersonFrame(form, localVideo);
  const data = await request("/api/validate-fit", { method: "POST", body: form }, readJson, signal);
  if (typeof data.ok !== "boolean") throw new Error("Kết quả kiểm tra trang phục không hợp lệ.");
  return {
    ok: data.ok,
    checked: typeof data.checked === "boolean" ? data.checked : true,
    ...(typeof data.message === "string" ? { message: data.message } : {}),
  };
}
