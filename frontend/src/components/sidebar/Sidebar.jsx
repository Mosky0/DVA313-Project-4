import { NavLink } from "react-router-dom";
import { MdDashboard } from "react-icons/md";
import { FaBox, FaRegFileAlt } from "react-icons/fa";

export default function Sidebar() {
  return (
    <aside className="h-screen w-28 bg-[#0D2940] text-white flex flex-col py-6 shadow-lg">
      
    
      {/* Navigation */}
      <nav className="flex flex-col gap-4">
        <SidebarItem
          to="/"
          icon={<MdDashboard size={22} />}
          label="Dashboard"
        />

        <SidebarItem
          to="/containers"
          icon={<FaBox size={20} />}
          label="Containers"
        />

        <SidebarItem
          to="/logs"
          icon={<FaRegFileAlt size={20} />}
          label="Logs"
        />
      </nav>
    </aside>
  );
}

function SidebarItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `
          flex flex-col items-center py-3 mx-3 rounded-xl transition-all
          ${isActive ? "bg-white text-[#0D2940]" : "text-white hover:bg-white/20"}
        `
      }
    >
      <div className="mb-1">{icon}</div>
      <span className="text-xs font-medium">{label}</span>
    </NavLink>
  );
}
