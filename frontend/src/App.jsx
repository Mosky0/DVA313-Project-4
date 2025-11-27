import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layout/MainLayout";
import Dashboard from "./pages/Dashboard/Dashboard";
import Containers from "./pages/Containers/Containers";
import ContainerView from "./pages/ContainerView/ContainerView";
import Logs from "./pages/Logs/Logs";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="containers" element={<Containers />} />
        <Route path="containers/:id" element={<ContainerView />} />
        <Route path="logs" element={<Logs />} />

        {/* redirect broken /dashboard → / */}
        <Route path="dashboard" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  );
}

