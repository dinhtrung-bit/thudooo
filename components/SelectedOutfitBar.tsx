"use client";

import Image from "next/image";
import type { Product } from "@/lib/products";
import type { ViewMode } from "./TryOnView";

interface SelectedOutfitBarProps {
  product: Product | null;
  viewMode: ViewMode;
  isBusy: boolean;
  canTryOn: boolean;
  onOpenWardrobe: () => void;
  onToggleView: () => void;
  onTryOn: () => void;
}

export function SelectedOutfitBar({
  product, viewMode, isBusy, canTryOn,
  onOpenWardrobe, onToggleView, onTryOn,
}: SelectedOutfitBarProps) {
  return (
    <div className="fitting-selection">
      <div className="fitting-selection-info">
        <div className="fitting-selection-image">
          {product && (
            <Image src={product.image} alt={product.name} width={58} height={62} />
          )}
        </div>
        <div className="fitting-selection-copy">
          <p className="fitting-selection-label">TRANG PHỤC ĐANG CHỌN</p>
          <p className="fitting-selection-name">
            {product?.name || "Bạn chưa chọn trang phục"}
          </p>
          <p className="fitting-selection-hint">
            {product ? (product.description || "Bấm Thử trang phục để xem kết quả AI.") : "Mở tủ đồ để chọn mẫu bạn muốn thử."}
          </p>
        </div>
      </div>
      <div className="fitting-actions">
        <button type="button" className="fitting-button" disabled={isBusy}
          onClick={onOpenWardrobe} aria-haspopup="dialog">
          Đổi trang phục
        </button>
        <button type="button" className="fitting-button" disabled={isBusy}
          onClick={onToggleView}>
          {viewMode === "product" ? "Xem camera" : "Xem trang phục"}
        </button>
        <button type="button" className="fitting-button fitting-button-primary"
          disabled={!product || !canTryOn || isBusy} onClick={onTryOn}>
          {isBusy ? "Đang xử lý..." : "Thử trang phục"}
        </button>
      </div>
    </div>
  );
}