import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { BatteryPage } from "../pages/BatteryPage";
import { DashboardPage } from "../pages/DashboardPage";
import { DropControlPage } from "../pages/DropControlPage";
import { FlightHistoryPage } from "../pages/FlightHistoryPage";
import { MapPage } from "../pages/MapPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { SeedPage } from "../pages/SeedPage";
import { SettingsPage } from "../pages/SettingsPage";
import { ThrusterTestPage } from "../pages/ThrusterTestPage";
import { VideoPage } from "../pages/VideoPage";
import { WeatherPage } from "../pages/WeatherPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "map", element: <MapPage /> },
      { path: "drop", element: <DropControlPage /> },
      { path: "thruster", element: <ThrusterTestPage /> },
      { path: "battery", element: <BatteryPage /> },
      { path: "seed", element: <SeedPage /> },
      { path: "history", element: <Navigate to="/drop?tab=riwayat" replace /> },
      { path: "flights", element: <FlightHistoryPage /> },
      { path: "video", element: <VideoPage /> },
      { path: "weather", element: <WeatherPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
