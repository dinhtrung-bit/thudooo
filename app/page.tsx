"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { PRODUCTS, type Product } from "@/lib/products";
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

const FALLBACK_PROMPT =
  "Try on the garment in the reference image. Preserve its visible color, pattern, shape and details.";

function ShirtIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4c0 4-8 4-8 0Z" />
    </svg>
  );
}

export default function OutfitBuilderPage() {
  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(PRODUCTS[0] ?? null);

  const [viewMode, setViewMode] =
    useState<ViewMode>("product");

  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
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

  const isBusy = isStarting || processingStatus !== null;

  const openWardrobe = useCallback(() => {
    if (taskAbortRef.current) return;
    setIsWardrobeOpen(true);
  }, []);

  const closeWardrobe = useCallback(() => {
    setIsWardrobeOpen(false);
  }, []);

  const handleConfirmProduct = useCallback(
    (product: Product) => {
      if (taskAbortRef.current) return;

      if (product.id !== selectedProduct?.id) {
        setSelectedProduct(product);
        setPrompt("");
        garmentBlobRef.current = null;
      }

      setUiError(null);
      setNotice(null);
      setViewMode("product");
      setIsWardrobeOpen(false);
    },
    [selectedProduct?.id]
  );

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

          const imageBlob = await fetchGarmentImage(
            product.image,
            controller.signal
          );

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
              <ShirtIcon />
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
        <section
          className="fitting-intro"
          aria-labelledby="fitting-title"
        >
          <div>
            <p className="fitting-eyebrow">
              PHONG CÁCH BẮT ĐẦU TỪ BẠN
            </p>

            <h1 id="fitting-title" className="fitting-title">
              Ít lựa chọn hơn.
              <br />
              <em>Đúng chất mình hơn.</em>
            </h1>

            <p className="fitting-description">
              Những trang phục được chọn sẵn, chờ bạn thử.
            </p>
          </div>

          <button
            type="button"
            className="fitting-button fitting-button-primary"
            disabled={processingStatus !== null}
            onClick={openWardrobe}
            aria-haspopup="dialog"
            aria-expanded={isWardrobeOpen}
          >
            Mở tủ đồ
          </button>
        </section>

        <section
          className="fitting-studio"
          aria-label="Phòng thử trang phục"
        >
          <div
            className="fitting-toolbar"
            style={{ flexWrap: "wrap" }}
          >
            <div>
              <h2>Phiên thử đồ</h2>

              <p
                className="fitting-note"
                style={{ margin: "5px 0 0" }}
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
                  {isStarting ? "Hủy kết nối" : "Dừng phiên"}
                </button>
              )}
            </div>
          </div>

          <TryOnView
            selectedProduct={selectedProduct}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
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

        {visibleError && (
          <p className="fitting-alert" role="alert">
            {visibleError}
          </p>
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
          selectedProductId={selectedProduct?.id ?? null}
          onConfirm={handleConfirmProduct}
          onClose={closeWardrobe}
        />
      )}
    </div>
  );
}