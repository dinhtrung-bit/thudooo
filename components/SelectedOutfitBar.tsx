"use client";
import Image from "next/image";
import type { Product } from "@/lib/products";
import type { ViewMode } from "./TryOnView";
import { UIIcon } from "./UIIcon";
interface SelectedOutfitBarProps {
  product: Product | null; viewMode: ViewMode; isBusy: boolean; canTryOn: boolean;
  onOpenWardrobe: () => void; onToggleView: () => void; onTryOn: () => void;
}
export function SelectedOutfitBar({ product, viewMode, isBusy, canTryOn, onOpenWardrobe, onToggleView, onTryOn }: SelectedOutfitBarProps) {
  return (
    <div className="fitting-selection">
      <div className="fitting-selection-info">
        <div className="fitting-selection-image">
          {product ? <Image src={product.image} alt={product.name} width={58} height={64} unoptimized /> : <UIIcon name="shirt" size={26} />}
        </div>
        <div className="fitting-selection-copy">
          <p className="fitting-selection-label">{product ? "TRANG PHỤC ĐANG CHỌN" : "TỦ ĐỒ CỦA BẠN"}</p>
          <p className="fitting-selection-name">{product?.name || "Chưa có trang phục"}</p>
          <p className="fitting-selection-hint">{product ? (product.description || (canTryOn ? "Đã sẵn sàng. Bấm thử để xem kết quả AI." : "Bắt đầu phiên để thử trang phục này.")) : "Thêm một ảnh để khám phá phong cách mới."}</p>
        </div>
      </div>
      <div className="fitting-actions fitting-selection-actions">
        <button type="button" className="fitting-button" disabled={isBusy} onClick={onOpenWardrobe} aria-haspopup="dialog"><UIIcon name="upload" size={17} />{product ? "Đổi ảnh" : "Thêm ảnh"}</button>
        <button type="button" className="fitting-button" disabled={isBusy} onClick={onToggleView}><UIIcon name={viewMode === "product" ? "camera" : "shirt"} size={17} />{viewMode === "product" ? "Xem camera" : "Xem trang phục"}</button>
        <button type="button" className="fitting-button fitting-button-primary" disabled={!product || !canTryOn || isBusy} onClick={onTryOn}><UIIcon name="sparkles" size={17} />{isBusy ? "Đang xử lý..." : "Thử trang phục"}</button>
      </div>
    </div>
  );
}
