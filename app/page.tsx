"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import type { Product } from "@/lib/products";
import { resizeImageBlob } from "@/lib/image-utils";

import {
  enhancePrompt,
  validateFit,
  postJson,
  getErrorMessage,
  fetchGarmentImage,
} from "@/lib/enhance-prompt";

import { useCamera } from "@/hooks/useCamera";
import { useDecartRealtime } from "@/hooks/useDecartRealtime";

import {
  TryOnView,
  type ViewMode,
} from "@/components/TryOnView";

import { WardrobeModal } from "@/components/WardrobeModal";
import { SelectedOutfitBar } from "@/components/SelectedOutfitBar";
import { ImportedLookbook } from "@/components/ImportedLookbook";
import { DevelopmentNotice } from "@/components/DevelopmentNotice";
import { UIIcon } from "@/components/UIIcon";

const FALLBACK_PROMPT =
  "Try on the garment in the reference image. Preserve its visible color, pattern, shape and details.";


export default function OutfitBuilderPage() {
  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(null);

  const [viewMode, setViewMode] =
    useState<ViewMode>("product");

  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [showDevelopmentNotice, setShowDevelopmentNotice] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  const [prompt, setPrompt] = useState("");

  const [processingStatus, setProcessingStatus] =
    useState<string | null>(null);

  const [uiError, setUiError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [lastSubmittedId, setLastSubmittedId] =
    useState<string | null>(null);

  const {
    stream,
    error: cameraError,
    startCamera,
    stopCamera,
  } = useCamera();

  const {
    status,
    error: decartError,
    connect,
    disconnect,
    clientRef,
  } = useDecartRealtime();

  const remoteVideoRef = useRef<
    RefObject<HTMLVideoElement | null> | null
  >(null);

  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const garmentBlobRef = useRef<Blob | null>(null);
  const uploadedGarmentRef = useRef<File | null>(null);
  const uploadedObjectUrlRef = useRef<string | null>(null);

  const mountedRef = useRef(false);
  const startingRef = useRef(false);

  const sessionVersionRef = useRef(0);
  const taskVersionRef = useRef(0);

  const sessionAbortRef = useRef<AbortController | null>(null);
  const taskAbortRef = useRef<AbortController | null>(null);

  const clearRemoteVideo = useCallback(() => {
    remoteStreamRef.current = null;

    const video = remoteVideoRef.current?.current;

    if (video) {
      video.srcObject = null;
    }
  }, []);

  const handleRemoteStreamRef = useCallback(
    (ref: RefObject<HTMLVideoElement | null>) => {
      remoteVideoRef.current = ref;

      if (ref.current) {
        ref.current.srcObject = remoteStreamRef.current;
      }
    },
    []
  );

  const handleLocalVideoRef = useCallback(
    (ref: RefObject<HTMLVideoElement | null>) => {
      localVideoRef.current = ref.current;
    },
    []
  );

  const stopSession = useCallback(() => {
    sessionVersionRef.current += 1;
    taskVersionRef.current += 1;

    sessionAbortRef.current?.abort();
    taskAbortRef.current?.abort();

    sessionAbortRef.current = null;
    taskAbortRef.current = null;

    startingRef.current = false;

    disconnect();
    stopCamera();
    clearRemoteVideo();

    garmentBlobRef.current = null;

    if (mountedRef.current) {
      setIsStarting(false);
      setProcessingStatus(null);
      setLastSubmittedId(null);
      setPrompt("");
      setUiError(null);
      setNotice(null);
    }
  }, [disconnect, stopCamera, clearRemoteVideo]);

  useEffect(() => {
    mountedRef.current = true;

    const handlePageHide = () => stopSession();

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      mountedRef.current = false;

      window.removeEventListener("pagehide", handlePageHide);

      stopSession();
    };
  }, [stopSession]);

  useEffect(
    () => () => {
      if (uploadedObjectUrlRef.current) {
        URL.revokeObjectURL(uploadedObjectUrlRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!stream) return;

    const handleEnded = () => {
      stopSession();

      setUiError(
        "Camera đã bị ngắt. Hãy kiểm tra thiết bị rồi bắt đầu lại."
      );
    };

    const tracks = stream.getVideoTracks();

    tracks.forEach((track) => {
      track.addEventListener("ended", handleEnded);
    });

    return () => {
      tracks.forEach((track) => {
        track.removeEventListener("ended", handleEnded);
      });
    };
  }, [stream, stopSession]);

  const startSession = useCallback(async () => {
    if (startingRef.current) return;

    stopSession();

    const version = ++sessionVersionRef.current;
    const controller = new AbortController();

    sessionAbortRef.current = controller;
    startingRef.current = true;

    setIsStarting(true);
    setViewMode("camera");
    setUiError(null);

    const isCurrent = () =>
      mountedRef.current &&
      version === sessionVersionRef.current &&
      !controller.signal.aborted;

    try {
      const cameraStream = await startCamera();

      if (!isCurrent() || !cameraStream) return;

      const data = await postJson(
        "/api/tokens",
        undefined,
        controller.signal,
        20_000
      );

      if (!isCurrent()) return;

      if (
        typeof data.apiKey !== "string" ||
        !data.apiKey
      ) {
        throw new Error("Máy chủ trả token phiên không hợp lệ.");
      }

      const client = await connect({
        apiKey: data.apiKey,
        stream: cameraStream,

        onRemoteStream: (remoteStream) => {
          if (!isCurrent()) return;

          remoteStreamRef.current = remoteStream;

          const video = remoteVideoRef.current?.current;

          if (video) {
            video.srcObject = remoteStream;
          }
        },
      });

      if (!isCurrent()) return;

      if (!client) {
        stopCamera();
        clearRemoteVideo();
        return;
      }

      setNotice(
        "Camera đã mở. Khi AI kết nối sẵn sàng, bạn có thể thử trang phục."
      );
    } catch (err) {
      if (!isCurrent()) return;

      disconnect();
      stopCamera();
      clearRemoteVideo();

      setUiError(
        getErrorMessage(err, "Không thể bắt đầu phiên thử đồ.")
      );
    } finally {
      if (version === sessionVersionRef.current) {
        startingRef.current = false;

        if (mountedRef.current) {
          setIsStarting(false);
        }
      }
    }
  }, [
    stopSession,
    startCamera,
    stopCamera,
    connect,
    disconnect,
    clearRemoteVideo,
  ]);

  const isConnected =
    status === "connected" || status === "generating";

  const visibleError = cameraError || decartError || uiError;
  const uiErrorText = uiError?.toLocaleLowerCase("vi") ?? "";
  const errorLocation = cameraError
    ? "Camera và quyền truy cập thiết bị"
    : decartError
      ? "Kết nối dịch vụ AI"
      : uiErrorText.includes("camera") ||
          uiErrorText.includes("khung hình")
        ? "Camera và khung hình"
        : uiErrorText.includes("ai") ||
            uiErrorText.includes("kết nối") ||
            uiErrorText.includes("máy chủ") ||
            uiErrorText.includes("token") ||
            uiErrorText.includes("phiên")
          ? "Kết nối dịch vụ AI"
          : uiErrorText.includes("ảnh") ||
              uiErrorText.includes("trang phục")
            ? "Ảnh trang phục"
            : "Quy trình thử đồ";
  const errorAdvice = cameraError
    ? "Kiểm tra camera có đang được ứng dụng khác sử dụng không, cấp quyền camera cho trình duyệt và dùng trang web qua HTTPS hoặc localhost."
    : decartError
      ? "Kiểm tra Internet và cấu hình dịch vụ AI, sau đó bấm “Kết nối lại”. Nếu lỗi tiếp diễn, dịch vụ có thể đang tạm thời không sẵn sàng."
      : errorLocation === "Ảnh trang phục"
        ? "Chọn ảnh JPG, PNG hoặc WebP dưới 10 MB, rõ nét và có trang phục trong khung hình; sau đó thử lại."
        : errorLocation === "Camera và khung hình"
          ? "Cho phép trình duyệt dùng camera, đợi hình ảnh xuất hiện đầy đủ rồi thử lại."
          : "Đọc bước đang báo lỗi, kiểm tra camera, ảnh và kết nối AI rồi thử lại.";

  const isBusy = isStarting || processingStatus !== null;

  const openWardrobe = useCallback(() => {
    if (taskAbortRef.current) return;
    setIsWardrobeOpen(true);
  }, []);

  const closeWardrobe = useCallback(() => {
    setIsWardrobeOpen(false);
  }, []);

  const handleUploadGarment = useCallback((file: File) => {
    if (taskAbortRef.current) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUiError("Ảnh trang phục: chỉ hỗ trợ JPG, PNG hoặc WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUiError("Ảnh trang phục vượt quá 10 MB. Hãy chọn ảnh nhỏ hơn.");
      return;
    }

    if (uploadedObjectUrlRef.current) {
      URL.revokeObjectURL(uploadedObjectUrlRef.current);
    }
    const imageUrl = URL.createObjectURL(file);
    uploadedObjectUrlRef.current = imageUrl;
    uploadedGarmentRef.current = file;
    garmentBlobRef.current = null;

    const product: Product = {
      id: `upload-${Date.now()}`,
      name: file.name,
      image: imageUrl,
      price: 0,
      category: "top",
    };
    setSelectedProduct(product);
    setPrompt("");
    setLastSubmittedId(null);
    setUiError(null);
    setNotice("Đã chọn ảnh. Ảnh chỉ được gửi đến dịch vụ AI khi bạn bắt đầu thử đồ.");
    setViewMode("product");
    setIsWardrobeOpen(false);
  }, []);

  const submitGarment = useCallback(
    async (updatePrompt: boolean) => {
      if (startingRef.current || taskAbortRef.current) return;

      const client = clientRef.current;
      const product = selectedProduct;

      if (!client?.isConnected() || !product) {
        setUiError(
          "Hãy bắt đầu phiên và đợi AI kết nối trước khi thử trang phục."
        );
        return;
      }

      if (updatePrompt && !prompt.trim()) {
        setUiError("Vui lòng nhập mô tả trước khi áp dụng.");
        return;
      }

      const video = localVideoRef.current;

      if (
        !updatePrompt &&
        (!video || video.readyState < 2 || !video.videoWidth)
      ) {
        setViewMode("camera");
        setUiError(
          "Camera chưa có khung hình. Hãy đợi camera hiển thị rồi thử lại."
        );
        return;
      }

      const sessionVersion = sessionVersionRef.current;
      const taskVersion = ++taskVersionRef.current;

      const controller = new AbortController();
      taskAbortRef.current = controller;

      setUiError(null);
      setNotice(null);

      const checkCurrent = () => {
        if (
          !mountedRef.current ||
          controller.signal.aborted ||
          sessionVersion !== sessionVersionRef.current ||
          taskVersion !== taskVersionRef.current ||
          clientRef.current !== client
        ) {
          throw new DOMException("Đã hủy tác vụ.", "AbortError");
        }
      };

      try {
        let garment: Blob;
        let finalPrompt: string;

        if (updatePrompt) {
          if (!garmentBlobRef.current) {
            throw new Error(
              "Hãy thử trang phục đang chọn trước khi chỉnh mô tả."
            );
          }

          garment = garmentBlobRef.current;
          finalPrompt = prompt.trim();
        } else {
          setProcessingStatus("Đang chuẩn bị trang phục...");

          const imageBlob = uploadedGarmentRef.current
            ? uploadedGarmentRef.current
            : await fetchGarmentImage(product.image, controller.signal);

          checkCurrent();

          garment = await resizeImageBlob(imageBlob);

          checkCurrent();

          const warnings: string[] = [];

          setProcessingStatus("Đang kiểm tra khung hình...");

          try {
            const fit = await validateFit(
              garment,
              video,
              controller.signal
            );

            checkCurrent();

            if (fit.checked && fit.ok === false) {
              setViewMode("camera");

              setUiError(
                fit.message ||
                  "Hãy đứng sao cho camera nhìn rõ phần thân trên."
              );

              return;
            }

            if (!fit.checked) {
              warnings.push(
                fit.message || "Chưa kiểm tra được khung hình."
              );
            }
          } catch (err) {
            checkCurrent();

            warnings.push(
              `Chưa kiểm tra được khung hình: ${getErrorMessage(
                err,
                "dịch vụ đang lỗi."
              )}`
            );
          }

          setProcessingStatus("Đang tạo mô tả trang phục...");

          try {
            const generated = await enhancePrompt(
              garment,
              video,
              controller.signal
            );

            finalPrompt = generated || FALLBACK_PROMPT;
          } catch (err) {
            checkCurrent();

            finalPrompt = FALLBACK_PROMPT;

            warnings.push(
              `Đang dùng mô tả dự phòng: ${getErrorMessage(
                err,
                "dịch vụ tạo mô tả chưa sẵn sàng."
              )}`
            );
          }

          checkCurrent();

          if (warnings.length > 0) {
            setNotice(warnings.join(" "));
          }
        }

        checkCurrent();

        if (!client.isConnected()) {
          throw new Error(
            "Kết nối AI đã gián đoạn. Hãy bấm Kết nối lại."
          );
        }

        setProcessingStatus("Đang gửi trang phục đến AI...");

        await client.setImage(garment, {
          prompt: finalPrompt,
          enhance: false,
          timeout: 20_000,
        });

        checkCurrent();

        garmentBlobRef.current = garment;

        setPrompt(finalPrompt);
        setLastSubmittedId(product.id);
        setViewMode("camera");
      } catch (err) {
        const isCurrent =
          mountedRef.current &&
          sessionVersion === sessionVersionRef.current &&
          taskVersion === taskVersionRef.current &&
          !controller.signal.aborted;

        if (isCurrent) {
          setUiError(
            getErrorMessage(
              err,
              "Không thể thử trang phục. Hãy thử lại."
            )
          );
        }
      } finally {
        if (taskVersion === taskVersionRef.current) {
          taskAbortRef.current = null;

          if (mountedRef.current) {
            setProcessingStatus(null);
          }
        }
      }
    },
    [clientRef, selectedProduct, prompt]
  );

  const hasUnappliedSelection =
    selectedProduct !== null &&
    lastSubmittedId !== null &&
    selectedProduct.id !== lastSubmittedId;

  const hasSession =
    isStarting ||
    stream !== null ||
    isConnected ||
    status === "reconnecting";

  const canTryOn =
    selectedProduct !== null &&
    stream !== null &&
    isConnected &&
    !cameraError &&
    !decartError;

  const sessionLabel = isStarting
    ? "Đang bắt đầu phiên..."
    : decartError || cameraError
      ? "Phiên đang gặp lỗi"
      : isConnected
        ? "Camera và AI đã sẵn sàng"
        : status === "reconnecting"
          ? "AI đang kết nối lại"
          : stream
            ? "Camera đang mở — AI chưa kết nối"
            : "Camera đang tắt";

  return (
    <div className="fitting-shell">
      <header className="fitting-header">
        <div className="fitting-header-inner">
          <a href="/" className="fitting-brand">
            <span className="fitting-brand-mark">
              <UIIcon name="shirt" size={22} />
            </span>

            <span>
              <span className="fitting-brand-name">
                Phòng thử đồ
              </span>

              <span className="fitting-brand-caption">
                MỘT KHÔNG GIAN. NHIỀU PHONG CÁCH.
              </span>
            </span>
          </a>

          <span className="fitting-development">
            Đang phát triển
          </span>
        </div>
      </header>

      <main className="fitting-main">
        <section className="fitting-intro" aria-labelledby="fitting-title">
          <div className="fitting-intro-copy">
            <p className="fitting-eyebrow"><UIIcon name="sparkles" size={14} />PHONG CÁCH BẮT ĐẦU TỪ BẠN</p>
            <h1 id="fitting-title" className="fitting-title">Một trang phục.<br /><em>Một phiên bản mới.</em></h1>
            <p className="fitting-description">Khám phá phong cách của bạn ngay trong phòng thử AI.<br />Tải ảnh trang phục, bật camera và xem điều gì hợp với mình.</p>
            <div className="fitting-intro-cta">
              <button type="button" className="fitting-button fitting-button-primary" disabled={isBusy}
                onClick={openWardrobe} aria-haspopup="dialog" aria-expanded={isWardrobeOpen}>
                <UIIcon name="upload" size={17} />Tải ảnh trang phục <UIIcon name="arrow" size={17} />
              </button>
              <span className="fitting-intro-tip">Ảnh của bạn. Phong cách của bạn.</span>
            </div>
          </div>
          <div className="fitting-hero-art" aria-hidden="true">
            <div className="fitting-hero-halo" />
            <div className="fitting-hero-card"><UIIcon name="shirt" size={75} /><span>YOUR NEXT LOOK</span></div>
            <span className="fitting-hero-badge"><UIIcon name="sparkles" size={17} />Một chút cảm hứng mới</span>
            <span className="fitting-hero-spark"><UIIcon name="sparkles" size={26} /></span>
          </div>
        </section>
        <ol className="fitting-steps" aria-label="Các bước thử trang phục">
          <li className="fitting-step" data-active={!selectedProduct} aria-current={!selectedProduct ? "step" : undefined}>
            <span className="fitting-step-number">{selectedProduct ? <UIIcon name="check" size={14} /> : "01"}</span>
            <div><strong>Chọn trang phục</strong><p>Tải lên ảnh bạn muốn thử</p></div>
          </li>
          <li className="fitting-step" data-active={Boolean(selectedProduct) && !isConnected} aria-current={selectedProduct && !isConnected ? "step" : undefined}>
            <span className="fitting-step-number">{isConnected ? <UIIcon name="check" size={14} /> : "02"}</span>
            <div><strong>Bật camera</strong><p>Bắt đầu phiên thử của bạn</p></div>
          </li>
          <li className="fitting-step" data-active={Boolean(selectedProduct) && isConnected} aria-current={selectedProduct && isConnected ? "step" : undefined}>
            <span className="fitting-step-number">03</span><div><strong>Khám phá diện mạo</strong><p>Thử trang phục với AI</p></div>
          </li>
        </ol>

        <section
          className="fitting-studio"
          aria-label="Phòng thử trang phục"
        >
          <div
            className="fitting-toolbar"
            style={{ flexWrap: "wrap" }}
          >
            <div>
              <h2><UIIcon name="camera" size={18} />Phòng thử của bạn</h2>

              <p
                className="fitting-session-status"
                data-connected={isConnected}
                role="status"
              >
                {sessionLabel}
              </p>
            </div>

            <div
              className="fitting-actions"
              style={{ flexWrap: "wrap" }}
            >
              {!isStarting && (
                <button
                  type="button"
                  className="fitting-button fitting-button-primary"
                  disabled={processingStatus !== null}
                  onClick={() => void startSession()}
                >
                  <UIIcon name={hasSession || visibleError ? "refresh" : "camera"} size={17} />
                  {hasSession || visibleError
                    ? "Kết nối lại"
                    : "Bắt đầu phiên"}
                </button>
              )}

              {hasSession && (
                <button
                  type="button"
                  className="fitting-button"
                  onClick={stopSession}
                >
                  <UIIcon name="stop" size={16} />
                  {isStarting ? "Hủy kết nối" : "Dừng phiên"}
                </button>
              )}
            </div>
          </div>

          <TryOnView
            selectedProduct={selectedProduct}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onOpenWardrobe={openWardrobe}
            localStream={stream}
            status={status}
            error={visibleError}
            prompt={prompt}
            processingStatus={
              isStarting
                ? "Đang mở camera và kết nối AI..."
                : processingStatus
            }
            hasSubmittedGarment={lastSubmittedId !== null}
            onPromptChange={setPrompt}
            onPromptSubmit={() => void submitGarment(true)}
            onRemoteStream={handleRemoteStreamRef}
            onLocalVideo={handleLocalVideoRef}
          />

          <SelectedOutfitBar
            product={selectedProduct}
            viewMode={viewMode}
            isBusy={isBusy}
            canTryOn={canTryOn}
            onOpenWardrobe={openWardrobe}
            onToggleView={() => {
              setViewMode((current) =>
                current === "product" ? "camera" : "product"
              );
            }}
            onTryOn={() => void submitGarment(false)}
          />
        </section>

        <ImportedLookbook />

        {visibleError && (
          <section className="fitting-alert fitting-error-card" role="alert" aria-live="assertive">
            <strong>Đã xảy ra lỗi tại: {errorLocation}</strong>
            <p>{visibleError}</p>
            <span>{errorAdvice}</span>
          </section>
        )}

        {notice && (
          <p className="fitting-note" role="status">
            {notice}
          </p>
        )}

        <p className="fitting-note">
          {hasUnappliedSelection
            ? "Bạn vừa đổi trang phục. Bấm Thử trang phục để cập nhật luồng AI."
            : "Bấm Bắt đầu phiên khi muốn dùng camera. Bấm Dừng phiên khi đã thử xong."}
        </p>

        <footer className="fitting-footer">
          <span>
            PHÒNG THỬ ĐỒ / Không gian nhỏ, cảm hứng lớn.
          </span>

          <span>
            Tính năng đang phát triển và được hoàn thiện thêm.
          </span>
        </footer>
      </main>

      {isWardrobeOpen && (
        <WardrobeModal
          onConfirm={handleUploadGarment}
          onClose={closeWardrobe}
        />
      )}

      {showDevelopmentNotice && (
        <DevelopmentNotice onContinue={() => setShowDevelopmentNotice(false)} />
      )}
    </div>
  );
}