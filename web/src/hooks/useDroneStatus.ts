import { useEffect, useRef } from "react";
import { createDroneClient, type DroneClient, type DroneStatus } from "../api/droneMqtt";
import { useDroneStore } from "../store/droneStore";
import { useBackendUrl } from "./useBackendUrl";
import type { DropRecord } from "../types";

const STALE_AFTER_MS = 3000;

export interface UseDroneStatusResult {
  client: DroneClient | null;
  status: DroneStatus | null;
  backendOnline: boolean;
  pixhawkConnected: boolean;
  stale: boolean;
  lastDrop: DropRecord | null;
  error: string | null;
  connecting: boolean;
}

export function useDroneStatus(): UseDroneStatusResult {
  const status = useDroneStore((state) => state.status);
  const backendOnline = useDroneStore((state) => state.backendOnline);
  const stale = useDroneStore((state) => state.stale);
  const lastDrop = useDroneStore((state) => state.lastDrop);
  const error = useDroneStore((state) => state.error);
  const connecting = useDroneStore((state) => state.connecting);
  const client = useDroneStore((state) => state.client);

  const setClient = useDroneStore((state) => state.setClient);
  const setConnecting = useDroneStore((state) => state.setConnecting);
  const setBackendOnline = useDroneStore((state) => state.setBackendOnline);
  const setStatus = useDroneStore((state) => state.setStatus);
  const setLastDrop = useDroneStore((state) => state.setLastDrop);

  const backendUrl = useBackendUrl();
  const clientRef = useRef<DroneClient | null>(null);
  const closedRef = useRef(true);
  const connectRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    closedRef.current = false;

    const connect = async () => {
      const c = await createDroneClient({
        apiUrl: backendUrl.apiUrl,
        username: backendUrl.username || undefined,
        password: backendUrl.password || undefined,
        brokerHost: backendUrl.brokerHost || undefined,
      });
      if (closedRef.current) {
        c.close();
        return;
      }
      clientRef.current = c;
      setClient(c);
      setConnecting(false);
      c.onStatus((next) => {
        setStatus(next);
      });
      c.onOnline((online) => {
        setBackendOnline(online);
      });
      c.onDrop((drop) => {
        setLastDrop(drop);
      });
    };

    connectRef.current = connect;
    void connect();

    const timer = setInterval(() => {
      const nextNow = Date.now();
      const current = useDroneStore.getState();
      const nextStale = current.status === null || nextNow - current.lastStatusAt > STALE_AFTER_MS;
      if (nextStale !== current.stale) {
        current.setStale(nextStale);
      }
    }, 1000);
    return () => {
      closedRef.current = true;
      clearInterval(timer);
      void clientRef.current?.close();
      clientRef.current = null;
      setClient(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    client,
    status,
    backendOnline,
    pixhawkConnected: status?.connected ?? false,
    stale,
    lastDrop,
    error,
    connecting,
  };
}
