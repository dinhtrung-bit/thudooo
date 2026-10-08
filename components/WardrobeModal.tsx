"use client";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { UIIcon } from "./UIIcon";
import styles from "./WardrobeModal.module.css";

interface WardrobeModalProps { onConfirm: (file: File) => void; onClose: () => void }
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export function WardrobeModal({ onConfirm, onClose }: WardrobeModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewReady, setIsPreviewReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    if (dialog && !dialog.open) dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function chooseFile(nextFile: File | null) {
    if (!nextFile) return;
    setError(null);
    if (nextFile === file) return;
    setIsPreviewReady(false);
    if (!ACCEPTED_TYPES.includes(nextFile.type)) {
      setFile(null); setError("Định dạng ảnh không được hỗ trợ. Hãy chọn JPG, PNG hoặc WebP.");
    } else if (nextFile.size > MAX_FILE_SIZE) {
      setFile(null); setError("Ảnh vượt quá 10 MB. Hãy chọn ảnh có dung lượng nhỏ hơn.");
    } else setFile(nextFile);
  }
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.currentTarget.files?.[0] ?? null);
    event.currentTarget.value = "";
  }
  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="wardrobe-title" aria-describedby="wardrobe-description"
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>THÊM VÀO PHÒNG THỬ</span><h2 id="wardrobe-title">Một ảnh. Một phong cách.</h2></div>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Đóng cửa sổ tải ảnh"><UIIcon name="close" /></button>
      </header>
      <p id="wardrobe-description" className={styles.description}>Chọn ảnh rõ nét, thấy trọn trang phục và có nền đơn giản để AI mô phỏng tốt hơn.</p>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" tabIndex={-1} aria-label="Tệp ảnh trang phục" className={styles.fileInput} onChange={handleFileChange} />
      <button type="button" className={styles.uploadArea} data-dragging={isDragging}
        onClick={() => inputRef.current?.click()} aria-label="Chọn ảnh trang phục từ thiết bị"
        onDragOver={event => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false); }}
        onDrop={event => { event.preventDefault(); setIsDragging(false); chooseFile(event.dataTransfer.files[0] ?? null); }}>
        {previewUrl ? <img key={previewUrl} src={previewUrl} alt="Xem trước ảnh trang phục đã chọn" className={styles.preview}
          onLoad={() => setIsPreviewReady(true)} onError={() => { setIsPreviewReady(false); setError("Không đọc được ảnh này. Hãy chọn một ảnh JPG, PNG hoặc WebP khác."); }} />
          : <span className={styles.uploadPrompt}>
            <span className={styles.uploadIcon}><UIIcon name="upload" size={26} /></span>
            <strong>{isDragging ? "Thả ảnh vào đây" : "Kéo thả hoặc bấm để chọn ảnh"}</strong>
            <span>JPG, PNG hoặc WebP · Tối đa 10 MB</span>
          </span>}
      </button>
      {file && <p className={styles.fileName}><UIIcon name="image" size={15} /><span>{file.name}</span><span>{(file.size / 1024 / 1024).toFixed(1)} MB</span></p>}
      {error && <p role="alert" className="fitting-alert">{error}</p>}
      <p className={styles.privacyNote}><UIIcon name="check" size={15} />Ảnh chỉ được gửi đến dịch vụ AI khi bạn bắt đầu thử đồ.</p>
      <footer className={styles.footer}>
        <button type="button" className="fitting-button" onClick={() => inputRef.current?.click()}>{file ? "Chọn ảnh khác" : "Chọn ảnh"}</button>
        <button type="button" className="fitting-button fitting-button-primary" disabled={!file || !isPreviewReady}
          onClick={() => { if (file && isPreviewReady) onConfirm(file); }}>Dùng ảnh này <UIIcon name="arrow" size={17} /></button>
      </footer>
    </dialog>
  );
}
