"use client";

import { useEffect, useRef } from "react";
import styles from "./DevelopmentNotice.module.css";

interface DevelopmentNoticeProps {
  onContinue: () => void;
}

export function DevelopmentNotice({ onContinue }: DevelopmentNoticeProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      tabIndex={-1}
      aria-labelledby="development-notice-title"
      aria-describedby="development-notice-description"
      onCancel={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          return;
        }
        if (event.key === "Tab") {
          event.preventDefault();
          dialogRef.current?.querySelector("button")?.focus();
        }
      }}
    >
      <div className={styles.badge}>BẢN THỬ NGHIỆM</div>
      <h2 id="development-notice-title">Phòng thử đồ AI đang trong quá trình phát triển</h2>
      <p id="development-notice-description">
        Đây là phiên bản thử nghiệm, chưa phải sản phẩm hoàn thiện. Kết quả AI
        có thể sai màu sắc, kiểu dáng, vị trí hoặc cách hiển thị trang phục; hình
        ảnh mô phỏng không đảm bảo vừa vặn, chính xác hay giống kết quả thực tế.
      </p>
      <ul className={styles.list}>
        <li>Một số chức năng có thể hoạt động không ổn định, cho kết quả chưa đúng hoặc tạm thời không dùng được.</li>
        <li>Khi bạn bắt đầu phiên, hình ảnh camera và ảnh trang phục sẽ được gửi đến dịch vụ AI để xử lý.</li>
        <li>Chỉ sử dụng ảnh bạn có quyền chia sẻ; tránh tải ảnh nhạy cảm hoặc ảnh của người khác khi chưa được đồng ý.</li>
        <li>Không dùng kết quả để thay thế việc thử đồ trực tiếp hoặc làm căn cứ cho quyết định quan trọng.</li>
      </ul>
      <p className={styles.footerNote}>
        Nếu gặp lỗi, hãy kiểm tra quyền camera, kết nối mạng và định dạng ảnh.
        Cảm ơn bạn đã kiên nhẫn trong giai đoạn hoàn thiện.
      </p>
      <button
        type="button"
        className="fitting-button fitting-button-primary"
        onClick={onContinue}
      >
        Tôi đã hiểu, tiếp tục
      </button>
    </dialog>
  );
}
