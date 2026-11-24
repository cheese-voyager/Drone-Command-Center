import { useEffect } from "react";
import { fetchStatus } from "../api/client";
import { useBackendUrl } from "./useBackendUrl";
import { useDroneStore } from "../store/droneStore";

export function useStatusSnapshot() {
  const backendUrl = useBackendUrl();

  useEffect(() => {
    let active = true;
    if (useDroneStore.getState().status) return;

    void fetchStatus(backendUrl.apiUrl)
      .then((status) => {
        if (active && !useDroneStore.getState().status) {
          useDroneStore.getState().setStatus(status);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [backendUrl.apiUrl]);
}
