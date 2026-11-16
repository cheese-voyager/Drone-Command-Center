import { useEffect } from "react";
import { watchStatus } from "../api/websocket";
import { useDroneStore } from "../store/droneStore";
import { useBackendUrl } from "./useBackendUrl";

export function useWebSocketFallback() {
  const setStatus = useDroneStore((state) => state.setStatus);
  const setBackendOnline = useDroneStore((state) => state.setBackendOnline);
  const setError = useDroneStore((state) => state.setError);
  const backendUrl = useBackendUrl();

  useEffect(() => {
    const unsub = watchStatus(backendUrl.apiUrl, {
      onStatus: (status) => {
        setStatus(status);
        setBackendOnline(true);
      },
      onError: () => {
        setBackendOnline(false);
      },
    });
    return () => {
      unsub();
    };
  }, [setStatus, setBackendOnline, setError, backendUrl.apiUrl]);

  return null;
}
