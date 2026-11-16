import { WS_PORT } from "./endpoints";
import type { DroneStatus } from "../types";

export interface StatusSocketHandlers {
  onStatus: (status: DroneStatus) => void;
  onError?: () => void;
}

export function watchStatus(baseUrl: string, handlers: StatusSocketHandlers): () => void {
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ws: WebSocket | undefined;

  const connect = () => {
    if (closed) {
      return;
    }
    const base = baseUrl.replace(/\/$/, "");
    const host = new URL(base).hostname;
    ws = new WebSocket(`ws://${host}:${WS_PORT}/ws`);
    ws.onmessage = (event) => {
      try {
        handlers.onStatus(JSON.parse((event as MessageEvent).data) as DroneStatus);
      } catch {
        handlers.onError?.();
      }
    };
    ws.onclose = () => {
      if (!closed) {
        timer = setTimeout(connect, 2000);
      }
    };
  };

  connect();

  return () => {
    closed = true;
    if (timer) {
      clearTimeout(timer);
    }
    ws?.close();
  };
}
