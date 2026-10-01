"use client";

import { useState, useCallback, useRef } from "react";

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef(0);

  const stopCamera = useCallback(() => {
    requestRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const startCamera = useCallback(async () => {
    const request = ++requestRef.current;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera cần HTTPS hoặc localhost và trình duyệt hỗ trợ.");
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user" },
      });
      if (request !== requestRef.current) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return null;
      }
      streamRef.current = mediaStream;
      setStream(mediaStream);
      return mediaStream;
    } catch (err) {
      if (request === requestRef.current) {
        setError(err instanceof Error ? err.message : "Không thể truy cập camera.");
      }
      return null;
    }
  }, []);

  return { stream, error, startCamera, stopCamera };
}
