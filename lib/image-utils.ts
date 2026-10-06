// FILE: lib/image-utils.ts

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 24_000_000;

const SUPPORTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  if (blob.size === 0) {
    return Promise.reject(
      new Error("Ảnh trang phục đang rỗng.")
    );
  }

  if (blob.size > MAX_FILE_BYTES) {
    return Promise.reject(
      new Error("Ảnh trang phục vượt quá giới hạn 10 MB.")
    );
  }

  if (
    blob.type &&
    !SUPPORTED_TYPES.includes(blob.type)
  ) {
    return Promise.reject(
      new Error("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.")
    );
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(blob);

    let settled = false;

    const cleanup = () => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      URL.revokeObjectURL(objectUrl);
    };

    const fail = (message: string) => {
      if (settled) return;

      settled = true;
      cleanup();
      reject(new Error(message));
    };

    const timer = setTimeout(() => {
      fail("Không đọc được ảnh trong thời gian cho phép.");
    }, 15_000);

    image.onload = () => {
      if (settled) return;

      const width = image.naturalWidth;
      const height = image.naturalHeight;

      if (!width || !height) {
        fail("Ảnh không có kích thước hợp lệ.");
        return;
      }

      if (width * height > MAX_IMAGE_PIXELS) {
        fail(
          "Độ phân giải ảnh quá lớn. Hãy dùng ảnh nhỏ hơn 24 megapixel."
        );
        return;
      }

      settled = true;
      cleanup();
      resolve(image);
    };

    image.onerror = () => {
      fail("Ảnh trang phục bị lỗi hoặc không thể giải mã.");
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
  format: "image/jpeg" | "image/png" = "image/jpeg"
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;

      settled = true;
      reject(
        new Error("Chuyển đổi ảnh quá thời gian chờ.")
      );
    }, 10_000);

    try {
      canvas.toBlob(
        (blob) => {
          if (settled) return;

          settled = true;
          clearTimeout(timer);

          if (!blob) {
            reject(
              new Error("Không thể chuyển đổi ảnh.")
            );
            return;
          }

          resolve(blob);
        },
        format,
        quality
      );
    } catch {
      if (settled) return;

      settled = true;
      clearTimeout(timer);

      reject(
        new Error("Không thể xử lý dữ liệu ảnh.")
      );
    }
  });
}

export async function resizeImageBlob(
  blob: Blob,
  maxSize = 1024
): Promise<Blob> {
  if (!Number.isFinite(maxSize) || maxSize <= 0) {
    throw new Error(
      "Kích thước ảnh đích không hợp lệ."
    );
  }

  const image = await loadImage(blob);

  const scale = Math.min(
    1,
    maxSize /
      Math.max(
        image.naturalWidth,
        image.naturalHeight
      )
  );

  const canvas = document.createElement("canvas");

  canvas.width = Math.max(
    1,
    Math.round(image.naturalWidth * scale)
  );

  canvas.height = Math.max(
    1,
    Math.round(image.naturalHeight * scale)
  );

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Trình duyệt không hỗ trợ xử lý ảnh."
    );
  }

  context.fillStyle = "#ffffff";
  context.fillRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  context.drawImage(
    image,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvasToBlob(canvas, 1, "image/png");
}

export async function captureVideoFrame(
  video: HTMLVideoElement,
  maxSize = 640
): Promise<Blob> {
  if (
    video.readyState < 2 ||
    video.videoWidth === 0 ||
    video.videoHeight === 0
  ) {
    throw new Error(
      "Camera chưa có khung hình để xử lý."
    );
  }

  if (!Number.isFinite(maxSize) || maxSize <= 0) {
    throw new Error(
      "Kích thước khung hình không hợp lệ."
    );
  }

  const scale = Math.min(
    1,
    maxSize /
      Math.max(
        video.videoWidth,
        video.videoHeight
      )
  );

  const canvas = document.createElement("canvas");

  canvas.width = Math.max(
    1,
    Math.round(video.videoWidth * scale)
  );

  canvas.height = Math.max(
    1,
    Math.round(video.videoHeight * scale)
  );

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Không thể chụp khung hình camera."
    );
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  context.drawImage(
    video,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvasToBlob(canvas, 0.9);
}