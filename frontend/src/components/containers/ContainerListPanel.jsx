import React, { useState } from "react";
import { FaSearch } from "react-icons/fa";

const filters = ["All", "Running", "Stopped", "Warning"];

// Sorting tabs
const tabs = ["All", "ID", "Name", "Status", "CPU%", "MEM%"];

// Dummy container data
const containers = [
  { id: "ied-01", name: "Container A", status: "Running", cpu: "12%", mem: "34%", time: "11:51 AM" },
  { id: "ied-05", name: "Container B", status: "Stopped", cpu: "0%", mem: "0%", time: "11:50 AM" },
  { id: "ied-07", name: "Container C", status: "Running", cpu: "6%", mem: "22%", time: "11:45 AM" },
  { id: "ied-08", name: "Container D", status: "Warning", cpu: "74%", mem: "82%", time: "11:43 AM" },
  { id: "ied-09", name: "Container E", status: "Running", cpu: "21%", mem: "14%", time: "11:40 AM" },
  { id: "ied-12", name: "Container F", status: "Stopped", cpu: "0%", mem: "0%", time: "11:38 AM" },
];

// Status colors
const getStatusColor = (status) => {
  if (status === "Running") return "bg-green-500";
  if (status === "Stopped") return "bg-red-500";
  if (status === "Warning") return "bg-orange-500";
  return "bg-gray-400"; 
};

export default function ContainerListPanel() {
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [selectedTab, setSelectedTab] = useState("All");
  const [search, setSearch] = useState("");

  // Sorting logic
  const sortContainers = (list) => {
    switch (selectedTab) {
      case "ID":
        return [...list].sort((a, b) => a.id.localeCompare(b.id));
      case "Name":
        return [...list].sort((a, b) => a.name.localeCompare(b.name));
      case "Status":
        return [...list].sort((a, b) => a.status.localeCompare(b.status));
      case "CPU%":
        return [...list].sort((a, b) => parseInt(b.cpu) - parseInt(a.cpu));
      case "MEM%":
        return [...list].sort((a, b) => parseInt(b.mem) - parseInt(a.mem));
      default:
        return list;
    }
  };

  // Filter logic
  const filtered = sortContainers(
    containers.filter((c) => {
      // Filter by status
      if (selectedFilter !== "All" && c.status !== selectedFilter) return false;
      // Search by name
      if (!c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
  );

  return (
    <div className="bg-white rounded-2xl shadow-md p-5 h-[calc(150vh-120px)] flex flex-col">
      
      {/* HEADER */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Containers</h2>

        {/* Show All (Reset) */}
        
        <button
          className="px-4 py-1 text-sm rounded-full border border-blue-600 text-blue-600 hover:bg-blue-50 transition"
          onClick={() => {
            setSelectedFilter("All");
            setSelectedTab("All");
            setSearch("");
          }}
        >
          Show All
        </button>
      </div>

      {/* FILTER BUTTONS */}
      <div className="flex gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setSelectedFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm border transition
              ${
                selectedFilter === f
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
              }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* SORTING TABS */}
      <div className="flex gap-5 mb-4 border-b">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`pb-2 text-sm transition relative
              ${
                selectedTab === tab
                  ? "text-blue-600 font-medium"
                  : "text-gray-600 hover:text-gray-800"
              }`}
          >
            {tab}

            {/* Underline only when selected */}
            {selectedTab === tab && (
              <span className="absolute left-0 bottom-0 w-full h-0.5 bg-blue-600 rounded-full"></span>
            )}
          </button>
        ))}
      </div>

      {/* SEARCH BAR */}
      <div className="relative mb-4">
        <FaSearch className="absolute left-3 top-3 text-gray-400 text-sm" />
        <input
          type="text"
          placeholder="Search containers..."
          className="w-full bg-gray-100 rounded-xl pl-10 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-300"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* LIST AREA */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-3">

        {filtered.length === 0 && (
          <p className="text-sm text-gray-500">No containers found.</p>
        )}

        {filtered.map((c) => (
          <div
            key={c.id}
            className="flex bg-gray-50 rounded-xl shadow-sm border border-gray-200 overflow-hidden"
          >
            {/* Left colored status bar */}
            <div className={`w-2 ${getStatusColor(c.status)}`}></div>

            {/* Content */}
            <div className="flex-1 p-3">
              <div className="flex justify-between">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-gray-500">{c.time}</div>
                </div>

                {/* FIXED View button */}
                <button
                  className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
                  onClick={() => window.location.href = `/containers/${c.id}`}
                >
                  View Container
                </button>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-gray-600">
                <div>ID: {c.id}</div>
                <div>CPU: {c.cpu}</div>
                <div>Status: {c.status}</div>
                <div>MEM: {c.mem}</div>
              </div>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
