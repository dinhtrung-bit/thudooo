"use client";

import { useEffect, useState } from "react";

interface Entry { imageUrl: string; addedAt: string }
const STORAGE_KEY = "thudooo.lookbook.v1";
const MAX_ENTRIES = 50;

function imageUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "::1" || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return null;
    return url.href;
  } catch { return null; }
}

function cleanImportUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("imageUrl");
  window.history.replaceState(window.history.state, "", url.href);
}

export function ImportedLookbook() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let saved: Entry[] = [];
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(stored)) {
        for (const entry of stored) {
          const url = imageUrl(entry?.imageUrl);
          if (url && typeof entry?.addedAt === "string" && !saved.some(item => item.imageUrl === url)) saved.push({ imageUrl: url, addedAt: entry.addedAt });
          if (saved.length >= MAX_ENTRIES) break;
        }
      }
    } catch { /* Incoming images still work when browser storage is unavailable. */ }
    setEntries(saved);
    const raw = new URL(window.location.href).searchParams.get("imageUrl");
    if (raw !== null) {
      const url = imageUrl(raw);
      if (!url) setError("Không nhận được ảnh: cần URL ảnh HTTPS công khai hợp lệ.");
      else if (saved.some(entry => entry.imageUrl === url)) {
        cleanImportUrl();
        setNotice("Ảnh này đã có trong Lookbook.");
      } else setPending(url);
    }
  }, []);

  useEffect(() => {
    if (pending || notice || error) document.getElementById("lookbook")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [pending, notice, error]);

  function confirmImport(url: string) {
    if (pending !== url) return;
    const next = [{ imageUrl: url, addedAt: new Date().toISOString() }, ...entries.filter(entry => entry.imageUrl !== url)].slice(0, MAX_ENTRIES);
    setEntries(next);
    setPending(null);
    setError("");
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setNotice("Đã đưa ảnh vào Lookbook.");
    } catch {
      setNotice("Ảnh đã hiển thị. Trình duyệt hiện không cho phép lưu bộ sưu tập.");
    }
    cleanImportUrl();
  }

  if (!entries.length && !pending && !error && !notice) return null;

  return (
    <section id="lookbook" className="fitting-studio" aria-labelledby="lookbook-title" style={{ marginTop: 24, scrollMarginTop: 24 }}>
      <div className="fitting-toolbar"><div><h2 id="lookbook-title">Lookbook</h2><p className="fitting-note" style={{ margin: "5px 0 0" }}>Bộ sưu tập ảnh của bạn</p></div></div>
      {notice && <p role="status" className="fitting-note">{notice}</p>}
      {error && <p role="alert" className="fitting-alert">{error}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 16, padding: 16 }}>
        {pending && <figure style={{ margin: 0 }}>
          <img key={pending} src={pending} alt="Ảnh được chuyển từ Việt Phục vào Lookbook" referrerPolicy="no-referrer" onLoad={() => confirmImport(pending)} onError={() => setError("Chưa tải được ảnh. Hãy kiểm tra kết nối hoặc thử lại.")} style={{ width: "100%", maxHeight: 520, objectFit: "contain", borderRadius: 12 }} />
          <figcaption className="fitting-note">Đang nhận ảnh vào Lookbook…</figcaption>
          {error && <button type="button" className="fitting-button" onClick={() => window.location.reload()}>Thử lại</button>}
        </figure>}
        {entries.map(entry => <figure key={entry.imageUrl} style={{ margin: 0 }}>
          <img src={entry.imageUrl} alt="Ảnh trong Lookbook" loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.hidden = true; setError("Một ảnh trong Lookbook không còn truy cập được."); }} style={{ width: "100%", maxHeight: 520, objectFit: "contain", borderRadius: 12 }} />
        </figure>)}
      </div>
    </section>
  );
}
