import { useSettingsStore } from "../store/settingsStore";

export interface BackendUrl {
  apiUrl: string;
  username: string;
  password: string;
  brokerHost: string;
  configured: boolean;
  setApiUrl: (apiUrl: string) => void;
  setUsername: (username: string) => void;
  setPassword: (password: string) => void;
  setBrokerHost: (brokerHost: string) => void;
}

export function useBackendUrl(): BackendUrl {
  const apiUrl = useSettingsStore((state) => state.apiUrl);
  const username = useSettingsStore((state) => state.username);
  const password = useSettingsStore((state) => state.password);
  const brokerHost = useSettingsStore((state) => state.brokerHost);
  const setApiUrl = useSettingsStore((state) => state.setApiUrl);
  const setUsername = useSettingsStore((state) => state.setUsername);
  const setPassword = useSettingsStore((state) => state.setPassword);
  const setBrokerHost = useSettingsStore((state) => state.setBrokerHost);

  const trimmedApiUrl = (apiUrl ?? "").trim();
  const resolvedApiUrl = trimmedApiUrl === "" ? "http://localhost:8000" : trimmedApiUrl;

  return {
    apiUrl: resolvedApiUrl,
    username,
    password,
    brokerHost,
    configured: trimmedApiUrl !== "",
    setApiUrl,
    setUsername,
    setPassword,
    setBrokerHost,
  };
}
