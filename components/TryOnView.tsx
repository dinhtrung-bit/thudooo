"use client";
import { useRef, useEffect } from "react";
import Image from "next/image";
import type { Product } from "@/lib/products";
import type { ConnectionStatus } from "@/hooks/useDecartRealtime";
import { UIIcon } from "./UIIcon";

export type ViewMode = "product" | "camera";
interface TryOnViewProps {
  selectedProduct?: Product | null; viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void; onOpenWardrobe?: () => void;
  hasSubmittedGarment?: boolean; canEditPrompt?: boolean;
  localStream: MediaStream | null; status: ConnectionStatus; error: string | null;
  prompt: string; processingStatus?: string | null;
  onPromptChange: (prompt: string) => void; onPromptSubmit: () => void;
  onRemoteStream: (ref: React.RefObject<HTMLVideoElement | null>) => void;
  onLocalVideo?: (ref: React.RefObject<HTMLVideoElement | null>) => void;
}
const STATUS_LABELS: Record<ConnectionStatus, string> = {
  idle: "Camera đang tắt", connecting: "Đang kết nối AI", connected: "Sẵn sàng thử trang phục",
  generating: "AI đang mô phỏng", reconnecting: "Đang kết nối lại", disconnected: "Camera đang tắt", error: "Kết nối gặp lỗi",
};
export function TryOnView({
  selectedProduct = null, viewMode = "camera", onViewModeChange, onOpenWardrobe,
  hasSubmittedGarment = true, canEditPrompt, localStream, status, error,
  prompt, processingStatus, onPromptChange, onPromptSubmit, onRemoteStream, onLocalVideo,
}: TryOnViewProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => { if (localVideoRef.current) localVideoRef.current.srcObject = localStream; }, [localStream]);
  useEffect(() => { onRemoteStream(remoteVideoRef); }, [onRemoteStream]);
  useEffect(() => { onLocalVideo?.(localVideoRef); }, [onLocalVideo]);
  const isGenerating = status === "generating" && hasSubmittedGarment;
  const isConnected = status === "connected" || status === "generating";
  const canSubmit = !processingStatus && isConnected && Boolean(prompt.trim());
  const isProduct = viewMode === "product";
  const statusLabel = isProduct ? selectedProduct ? "Xem trước trang phục" : "Chưa chọn trang phục"
    : status === "generating" && !hasSubmittedGarment ? STATUS_LABELS.connected : STATUS_LABELS[status];
  return (
    <div className="tryon-view">
      <div className="tryon-stage" data-mode={viewMode} aria-busy={Boolean(processingStatus)}>
        <video ref={localVideoRef} autoPlay playsInline muted aria-label="Hình ảnh camera của bạn" aria-hidden={isProduct || isGenerating} className="tryon-video" style={{ opacity: isGenerating ? 0 : 1 }} />
        <video ref={remoteVideoRef} autoPlay playsInline muted aria-label="Kết quả thử trang phục bằng AI" aria-hidden={isProduct || !isGenerating} className="tryon-video" style={{ opacity: isGenerating ? 1 : 0 }} />
        {isProduct && <div className="tryon-product-layer">
          {selectedProduct ? <div key={selectedProduct.id} className="tryon-product-image">
            <Image src={selectedProduct.image} alt={selectedProduct.name} fill sizes="(max-width: 640px) 90vw, 1100px" className="tryon-garment" unoptimized />
          </div> : <div className="tryon-empty">
            <div className="tryon-empty-art" aria-hidden="true">
              <div className="tryon-orbit" /><div className="tryon-shirt"><UIIcon name="shirt" size={76} /></div>
              <span className="tryon-floating-spark"><UIIcon name="sparkles" size={22} /></span>
              <span className="tryon-floating-tag"><UIIcon name="check" size={16} />Phong cách của bạn</span>
            </div>
            <h3>Trang phục của bạn, phiên bản mới</h3>
            <p>Chọn một ảnh trang phục để bắt đầu.<br />AI sẽ giúp bạn hình dung khi mặc lên người.</p>
            {onOpenWardrobe && <button type="button" className="fitting-button fitting-button-primary" disabled={Boolean(processingStatus)} onClick={onOpenWardrobe}>
              <UIIcon name="upload" size={17} />Tải ảnh trang phục <UIIcon name="arrow" size={17} />
            </button>}
          </div>}
        </div>}
        {!isProduct && !localStream && !processingStatus && <div className="tryon-empty tryon-camera-empty">
          <div className="tryon-camera-icon"><UIIcon name="camera" size={40} /></div>
          <h3>Camera chưa được bật</h3><p>Bấm “Bắt đầu phiên” ở phía trên.<br />Giữ trang phục và phần thân cần thử trong khung hình.</p>
        </div>}
        <div className="tryon-topbar">
          <div className="tryon-status" data-live={!isProduct && isGenerating} data-error={!isProduct && status === "error"}>
            <span className="tryon-status-dot" /><span>{statusLabel}</span>
          </div>
          {onViewModeChange && <div className="tryon-tabs" role="group" aria-label="Chế độ xem">
            <button type="button" aria-pressed={isProduct} aria-label="Xem trang phục" onClick={() => onViewModeChange("product")}><UIIcon name="shirt" size={16} /><span>Trang phục</span></button>
            <button type="button" aria-pressed={!isProduct} aria-label="Xem camera" onClick={() => onViewModeChange("camera")}><UIIcon name="camera" size={16} /><span>Camera</span></button>
          </div>}
        </div>
        {isProduct && selectedProduct && <div className="tryon-preview-caption"><UIIcon name="image" size={15} />Ảnh gốc · Kết quả AI hiển thị trong Camera</div>}
        {processingStatus && <div className="tryon-processing" role="status" aria-live="polite">
          <div className="tryon-loader"><UIIcon name="sparkles" size={26} /></div>
          <strong>{processingStatus}</strong><span>Chờ một chút, phong cách mới đang được chuẩn bị.</span>
          <div className="tryon-loading-dots" aria-hidden="true"><i /><i /><i /></div>
        </div>}
        {error && !processingStatus && !isProduct && <div className="tryon-inline-error"><strong>Phiên thử đồ gặp lỗi</strong><span>{error}</span></div>}
      </div>
      {(canEditPrompt ?? Boolean(prompt)) && <div className="tryon-prompt">
        <label htmlFor="tryon-prompt"><UIIcon name="sparkles" size={16} />Tinh chỉnh phong cách</label>
        <div className="tryon-prompt-controls">
          <input id="tryon-prompt" type="text" value={prompt} onChange={e => onPromptChange(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing && canSubmit) onPromptSubmit(); }}
            disabled={Boolean(processingStatus)} placeholder="Mô tả trang phục bạn muốn thử..." />
          <button type="button" className="fitting-button fitting-button-primary" disabled={!canSubmit} onClick={onPromptSubmit}>Áp dụng <UIIcon name="arrow" size={16} /></button>
        </div>
      </div>}
    </div>
  );
}
