import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SettingsState {
  apiUrl: string;
  username: string;
  password: string;
  brokerHost: string;
  theme: "dark" | "light";
  setApiUrl: (apiUrl: string) => void;
  setUsername: (username: string) => void;
  setPassword: (password: string) => void;
  setBrokerHost: (brokerHost: string) => void;
  setTheme: (theme: "dark" | "light") => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
      username: import.meta.env.VITE_MQTT_USER ?? "",
      password: import.meta.env.VITE_MQTT_PASSWORD ?? "",
      brokerHost: "",
      theme: "dark",
      setApiUrl: (apiUrl) => set({ apiUrl }),
      setUsername: (username) => set({ username }),
      setPassword: (password) => set({ password }),
      setBrokerHost: (brokerHost) => set({ brokerHost }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "drone-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ ...state, password: "" }),
    },
  ),
);
