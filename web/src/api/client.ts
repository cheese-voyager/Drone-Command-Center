import { ENDPOINTS } from "./endpoints";
import type { DroneStatus, DropRecord, MqttInfo } from "../types";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(apiUrl: string, path: string, init?: RequestInit): Promise<T> {
  const base = apiUrl.replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error("Tidak bisa menghubungi backend");
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const detail = (body as { detail?: unknown } | null)?.detail;
    let message = `Request gagal (${res.status})`;
    if (typeof detail === "string") {
      message = detail;
    } else if (detail !== null && detail !== undefined) {
      message = JSON.stringify(detail);
    }
    const err = new ApiError(message, res.status, (body as { code?: string } | null)?.code);
    throw err;
  }
  return body as T;
}

export const fetchStatus = (apiUrl: string) => api<DroneStatus>(apiUrl, ENDPOINTS.status);

export const fetchDrops = (apiUrl: string) => api<DropRecord[]>(apiUrl, ENDPOINTS.drops);

export const fetchMqttInfo = (apiUrl: string) => api<MqttInfo>(apiUrl, ENDPOINTS.mqtt);

export const fetchDebugMavlink = (apiUrl: string) => api<unknown>(apiUrl, ENDPOINTS.debugMavlink);

export const apiCommand = async <T>(apiUrl: string, path: string, body?: unknown): Promise<T> => {
  const init = body === undefined ? { method: "POST" } : { method: "POST", body: JSON.stringify(body) };
  return api<T>(apiUrl, path, init);
};
