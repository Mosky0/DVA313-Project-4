import { NavLink } from "react-router-dom";

export default function SidebarItem({ icon: Icon, label, to }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 py-4 rounded-xl transition 
        ${isActive ? "bg-blue-500 text-white" : "text-gray-600 hover:bg-gray-200"}`
      }
    >
      <Icon size={22} />
      <span className="text-xs font-medium">{label}</span>
    </NavLink>
  );
}
