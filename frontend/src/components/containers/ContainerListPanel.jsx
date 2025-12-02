import React, { useMemo, useState } from "react";
import { FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
const filtersDefault = ["All", "Running", "Stopped", "Warning"];
const tabsDefault = ["All", "ID", "Name", "Status", "CPU%", "MEM%"];

const dummyContainers = [
  { id: "ied-01", name: "Container A", status: "Running", cpu: 12, mem: 34, time: "11:51 AM" },
  { id: "ied-05", name: "Container B", status: "Stopped", cpu: 0, mem: 0, time: "11:50 AM" },
  { id: "ied-07", name: "Container C", status: "Running", cpu: 6, mem: 22, time: "11:45 AM" },
  { id: "ied-08", name: "Container D", status: "Warning", cpu: 74, mem: 82, time: "11:43 AM" },
  { id: "ied-09", name: "Container E", status: "Running", cpu: 21, mem: 14, time: "11:40 AM" },
  { id: "ied-12", name: "Container F", status: "Stopped", cpu: 0, mem: 0, time: "11:38 AM" },
];

export default function ContainerListPanel({ showHeader = true }) {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [selectedTab, setSelectedTab] = useState("All");
  const [search, setSearch] = useState("");

  const getStatusColor = (status) => {
    if (status === "Running") return "bg-green-500";
    if (status === "Stopped") return "bg-red-500";
    if (status === "Warning") return "bg-orange-500";
    return "bg-gray-400";
  };

  const filtered = useMemo(() => {
    let list = dummyContainers.slice();
    if (selectedFilter !== "All") list = list.filter((c) => c.status === selectedFilter);
    if (search.trim()) list = list.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase()));
    switch (selectedTab) {
      case "ID": return list.sort((a,b)=>a.id.localeCompare(b.id));
      case "Name": return list.sort((a,b)=>a.name.localeCompare(b.name));
      case "Status": return list.sort((a,b)=>a.status.localeCompare(b.status));
      case "CPU%": return list.sort((a,b)=>b.cpu - a.cpu);
      case "MEM%": return list.sort((a,b)=>b.mem - a.mem);
      default: return list;
    }
  }, [selectedFilter, selectedTab, search]);

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 h-[calc(200vh-120px)] flex flex-col">
      {showHeader && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Containers</h2>
          <button
            onClick={() => { setSelectedFilter("All"); setSelectedTab("All"); setSearch(""); }}
            className="text-sm text-[#2496ED] hover:underline"
          >
            Show All
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-3">
        {filtersDefault.map((f) => (
          <button
            key={f}
            onClick={() => setSelectedFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${selectedFilter === f ? "bg-[#2496ED] text-white border-[#2496ED]" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex gap-3 mb-3 border-b pb-3">
        {tabsDefault.map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`pb-2 text-sm relative ${selectedTab === tab ? "text-[#2496ED] font-medium" : "text-gray-600 hover:text-gray-800"}`}
          >
            {tab}
            {selectedTab === tab && <span className="absolute left-0 bottom-0 w-full h-0.5 bg-[#2496ED] rounded-full"></span>}
          </button>
        ))}
      </div>

      <div className="relative mb-3">
        <FaSearch className="absolute left-3 top-3 text-gray-400 text-sm" />
        <input
          type="text"
          placeholder="Search containers..."
          className="w-full bg-gray-100 rounded-xl pl-10 pr-3 py-2 outline-none focus:ring-2 focus:ring-[#2496ED]"
          value={search}
          onChange={(e)=>setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3">
        {filtered.length === 0 && <div className="text-sm text-gray-500">No containers found.</div>}
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => navigate(`/containers/${c.id}`)}
            className="w-full text-left flex bg-gray-50 rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:bg-gray-100 transition"
          >
            <div className={`w-2 ${getStatusColor(c.status)}`}></div>
            <div className="flex-1 p-3">
              <div className="flex justify-between">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-gray-500">{c.time}</div>
                </div>
                <div className="text-sm text-gray-700">{c.cpu}%</div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-gray-600">
                <div>ID: {c.id}</div>
                <div>MEM: {c.mem}%</div>
                <div>Status: {c.status}</div>
                <div></div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
