import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { useSettingsStore } from "./store/settingsStore";

export default function App() {
  const theme = useSettingsStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", theme === "light" ? "#eef2f8" : "#05090e");
    }
  }, [theme]);

  return <RouterProvider router={router} />;
}
