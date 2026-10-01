"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import type { Product } from "@/lib/products";

export type ViewMode = "product" | "camera";
import { ConnectionStatus } from "@/hooks/useDecartRealtime";

interface TryOnViewProps {
  selectedProduct?: Product | null;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  hasSubmittedGarment?: boolean;
  canEditPrompt?: boolean;
  localStream: MediaStream | null;
  status: ConnectionStatus;
  error: string | null;
  prompt: string;
  processingStatus?: string | null;
  onPromptChange: (prompt: string) => void;
  onPromptSubmit: () => void;
  onRemoteStream: (ref: React.RefObject<HTMLVideoElement | null>) => void;
  onLocalVideo?: (ref: React.RefObject<HTMLVideoElement | null>) => void;
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  idle: "Đang chờ camera...",
  connecting: "Đang kết nối AI...",
  connected: "Đã kết nối — chọn trang phục để thử",
  generating: "Đang truyền hình ảnh",
  reconnecting: "Đang kết nối lại...",
  disconnected: "Đã ngắt kết nối",
  error: "Lỗi kết nối",
};

export function TryOnView({
  selectedProduct = null,
  viewMode = "camera",
  onViewModeChange,
  hasSubmittedGarment = true,
  canEditPrompt,
  localStream,
  status,
  error,
  prompt,
  processingStatus,
  onPromptChange,
  onPromptSubmit,
  onRemoteStream,
  onLocalVideo,
}: TryOnViewProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    onRemoteStream(remoteVideoRef);
  }, [onRemoteStream]);

  useEffect(() => {
    onLocalVideo?.(localVideoRef);
  }, [onLocalVideo]);

  const isGenerating = status === "generating" && hasSubmittedGarment;

  const canSubmit = !processingStatus && (status === "connected" || status === "generating") && Boolean(prompt.trim());

  return (
    <div className="relative flex-1 bg-black flex flex-col text-white" style={{ minHeight: "clamp(360px, 54vw, 610px)" }}>
      <div className="relative flex-1">
        {/* Local camera feed */}
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity ${
            isGenerating ? "opacity-20" : "opacity-100"
          }`}
          style={{ transform: "scaleX(-1)" }}
        />

        {/* Remote AI stream */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity ${
            isGenerating ? "opacity-100" : "opacity-0"
          }`}
          style={{ transform: "scaleX(-1)" }}
        />

        {viewMode === "product" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-stone-100 p-6 text-stone-800">
            {selectedProduct ? (
              <Image
                src={selectedProduct.image}
                alt={selectedProduct.name}
                fill
                sizes="(max-width: 768px) 100vw, 1000px"
                className="object-contain p-8"
              />
            ) : (
              <p>Chọn trang phục trong tủ đồ để xem trước.</p>
            )}
            {onViewModeChange && (
              <button type="button" className="fitting-button absolute bottom-4 z-10"
                onClick={() => onViewModeChange("camera")}>
                Xem camera
              </button>
            )}
          </div>
        )}

        {/* Status indicator */}
        <div className="absolute top-4 left-4 z-20">
          <div
            className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full ${
              isGenerating
                ? "bg-green-500/90 text-white"
                : status === "error"
                  ? "bg-red-500/90 text-white"
                  : "bg-black/60 text-white"
            }`}
          >
            {isGenerating && (
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            )}
            {STATUS_LABELS[status]}
          </div>
        </div>

        {processingStatus && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 backdrop-blur-sm z-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white/80 text-sm font-medium">
              {processingStatus}
            </p>
          </div>
        )}

        {error && (
          <div role="alert" className="absolute bottom-4 left-4 right-4 bg-red-500/90 text-white text-sm px-4 py-2 rounded-lg z-20">
            {error}
          </div>
        )}
      </div>

      {/* Prompt editor */}
      {(canEditPrompt ?? Boolean(prompt)) && (
        <div className="p-3 bg-gray-900 border-t border-gray-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && canSubmit) onPromptSubmit();
              }}
              aria-label="Mô tả thử đồ"
              disabled={Boolean(processingStatus)}
              className="min-w-0 flex-1 text-sm bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              placeholder="Chỉnh mô tả..."
            />
            <button
              type="button"
              disabled={!canSubmit}
              onClick={onPromptSubmit}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
