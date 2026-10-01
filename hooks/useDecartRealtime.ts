"use client";

import { useState, useCallback, useRef } from "react";
import { createDecartClient, models } from "@decartai/sdk";

type RealtimeClient = Awaited<
  ReturnType<ReturnType<typeof createDecartClient>["realtime"]["connect"]>
>;

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "generating"
  | "reconnecting"
  | "disconnected"
  | "error";

interface ConnectOptions {
  apiKey: string;
  stream: MediaStream;
  prompt?: string;
  onRemoteStream: (stream: MediaStream) => void;
}

export function useDecartRealtime() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<RealtimeClient | null>(null);
  const requestRef = useRef(0);

  const connect = useCallback(async (options: ConnectOptions) => {
    const request = ++requestRef.current;
    const previousClient = clientRef.current;
    clientRef.current = null;
    previousClient?.disconnect();
    const { apiKey, stream, prompt, onRemoteStream } = options;
    setStatus("connecting");
    setError(null);

    try {
      const client = createDecartClient({ apiKey });
      const model = models.realtime("lucy-vton-latest");

      const rtClient = await client.realtime.connect(stream, {
        model,
        onRemoteStream: (remoteStream) => {
          if (request === requestRef.current) onRemoteStream(remoteStream);
        },
        ...(prompt && {
          initialState: { prompt: { text: prompt, enhance: false } },
        }),
      });

      if (request !== requestRef.current) {
        rtClient.disconnect();
        return null;
      }
      clientRef.current = rtClient;
      setStatus(rtClient.getConnectionState());
      rtClient.on("connectionChange", (state) => {
        if (request !== requestRef.current) return;
        setError(null);
        setStatus(state);
      });

      rtClient.on("error", (err) => {
        if (request !== requestRef.current) return;
        setError(err.message);
        setStatus("error");
      });

      clientRef.current = rtClient;
      return rtClient;
    } catch (err) {
      if (request !== requestRef.current) return null;
      const msg = err instanceof Error ? err.message : "Connection failed";
      setError(msg);
      setStatus("error");
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    requestRef.current += 1;
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  return { status, error, connect, disconnect, clientRef };
}
