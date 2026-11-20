import { useEffect } from "react";
import { useDroneStore } from "../store/droneStore";
import { useFlightLogStore } from "../store/flightLogStore";

export function useFlightLogRecorder(): void {
  const status = useDroneStore((state) => state.status);

  useEffect(() => {
    if (status) {
      useFlightLogStore.getState().ingest(status);
    }
  }, [status]);

  useEffect(() => {
    useFlightLogStore.getState().finalizeIdle();
    const timer = window.setInterval(() => {
      useFlightLogStore.getState().finalizeIdle();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, []);
}
