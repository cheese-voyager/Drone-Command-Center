import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { BatteryPage } from "../pages/BatteryPage";
import { DashboardPage } from "../pages/DashboardPage";
import { DropControlPage } from "../pages/DropControlPage";
import { DropHistoryPage } from "../pages/DropHistoryPage";
import { MapPage } from "../pages/MapPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { SeedPage } from "../pages/SeedPage";
import { SettingsPage } from "../pages/SettingsPage";
import { ThrusterTestPage } from "../pages/ThrusterTestPage";
import { VideoPage } from "../pages/VideoPage";

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
      { path: "history", element: <DropHistoryPage /> },
      { path: "video", element: <VideoPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
