"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PRODUCTS, type Product } from "@/lib/products";
import styles from "./WardrobeModal.module.css";

interface WardrobeModalProps {
  selectedProductId: string | null;
  onConfirm: (product: Product) => void;
  onClose: () => void;
}

export function WardrobeModal({ selectedProductId, onConfirm, onClose }: WardrobeModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedId, setSelectedId] = useState(selectedProductId);
  const selectedProduct = PRODUCTS.find((product) => product.id === selectedId);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="wardrobe-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <header className={styles.header}>
        <h2 id="wardrobe-title">Tủ đồ của bạn</h2>
        <button type="button" className="fitting-button" onClick={onClose} aria-label="Đóng tủ đồ">Đóng</button>
      </header>
      <div className={styles.grid}>
        {PRODUCTS.map((product) => (
          <button
            key={product.id}
            type="button"
            className={styles.product}
            aria-pressed={selectedId === product.id}
            onClick={() => setSelectedId(product.id)}
          >
            <Image src={product.image} alt={product.name} width={180} height={200} className={styles.image} />
            <span>{product.name}</span>
          </button>
        ))}
        {PRODUCTS.length === 0 && <p>Chưa có trang phục trong tủ đồ.</p>}
      </div>
      <footer className={styles.footer}>
        <button type="button" className="fitting-button" onClick={onClose}>Hủy</button>
        <button
          type="button"
          className="fitting-button fitting-button-primary"
          disabled={!selectedProduct}
          onClick={() => { if (selectedProduct) onConfirm(selectedProduct); }}
        >Chọn trang phục</button>
      </footer>
    </dialog>
  );
}
