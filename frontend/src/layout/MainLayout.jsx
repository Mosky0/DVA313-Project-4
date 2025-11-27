import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar/Sidebar";
import Header from "../components/Header/Header";

export default function MainLayout() {
  return (
    <div className="h-screen flex flex-col">

      {/* Header at the top across full width */}
      <Header />

      {/* Second row: sidebar + page content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <Sidebar />

        {/* Page Content */}
        <main className="flex-1 p-8 overflow-y-auto bg-gray-100">
          <Outlet />
        </main>
      </div>

    </div>
  );
}
