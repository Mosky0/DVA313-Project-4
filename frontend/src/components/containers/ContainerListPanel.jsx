import React, { useEffect, useMemo, useState } from "react";
import { FaSearch } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config";

const filtersDefault = ["All", "Running", "Stopped", "Warning"];
const tabsDefault = ["All", "ID", "Name", "Status", "CPU%", "MEM%"];

export default function ContainerListPanel({ showHeader = true }) {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [selectedTab, setSelectedTab] = useState("All");
  const [search, setSearch] = useState("");

  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statsLoaded, setStatsLoaded] = useState(false);

  // 1) Fetch basic container info (fast)
  useEffect(() => {
    setLoading(true);
    setError("");

    fetch(`${API_BASE_URL}/containers`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load containers");
        return res.json();
      })
      .then((data) => {
        const mapped = data.map((c) => ({
          id: c.id,
          name: c.name,
          status: normalizeStatus(c.status),
          cpuPercent: 0,     // will be filled by /stats
          memPercent: 0,     // optional if you want percent
          memText: "",       // e.g. "12.3 MB / 2.0 GB"
          time: "",          // last updated time
        }));
        setContainers(mapped);
        setLoading(false);
        setStatsLoaded(false); // allow stats fetch
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load containers");
        setLoading(false);
      });
  }, []);

  // 2) Fetch stats for each container ONCE after list is loaded
  useEffect(() => {
    if (!containers.length || statsLoaded) return;

    const fetchAllStats = async () => {
      try {
        const now = new Date().toLocaleTimeString();
        const updated = await Promise.all(
          containers.map(async (c) => {
            try {
              const res = await fetch(
                `${API_BASE_URL}/containers/${c.id}/stats`
              );
              if (!res.ok) throw new Error("Failed stats");
              const stats = await res.json();

              // Calculate mem percent if you want it
              let memPercent = 0;
              if (stats.mem_usage_bytes && stats.mem_limit_bytes) {
                memPercent = Math.round(
                  (stats.mem_usage_bytes / stats.mem_limit_bytes) * 100
                );
              }

              return {
                ...c,
                cpuPercent: stats.cpu_percent ?? 0,
                memPercent,
                memText: stats.mem_usage && stats.mem_limit
                  ? `${stats.mem_usage} / ${stats.mem_limit}`
                  : stats.mem_usage || "",
                time: now,
              };
            } catch (e) {
              console.error("Stats error for", c.id, e);
              return c; // keep existing values
            }
          })
        );

        setContainers(updated);
        setStatsLoaded(true);
      } catch (e) {
        console.error("Failed to fetch stats for containers", e);
      }
    };

    fetchAllStats();
  }, [containers, statsLoaded]);

  const getStatusColor = (status) => {
    if (status === "Running") return "bg-green-500";
    if (status === "Stopped") return "bg-red-500";
    if (status === "Warning") return "bg-orange-500";
    return "bg-gray-400";
  };

  // 3) Filter + search + sort
  const filtered = useMemo(() => {
    let list = containers.slice();

    if (selectedFilter !== "All") {
      list = list.filter((c) => c.status === selectedFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q)
      );
    }

    switch (selectedTab) {
      case "ID":
        return list.sort((a, b) => a.id.localeCompare(b.id));
      case "Name":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "Status":
        return list.sort((a, b) => a.status.localeCompare(b.status));
      case "CPU%":
        return list.sort((a, b) => b.cpuPercent - a.cpuPercent);
      case "MEM%":
        return list.sort((a, b) => b.memPercent - a.memPercent);
      default:
        return list;
    }
  }, [containers, selectedFilter, selectedTab, search]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-md p-4 h-[calc(200vh-120px)] flex items-center justify-center">
        <span className="text-sm text-gray-500">Loading containers…</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 h-[calc(200vh-120px)] flex flex-col">
      {showHeader && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Containers</h2>
          <button
            onClick={() => {
              setSelectedFilter("All");
              setSelectedTab("All");
              setSearch("");
            }}
            className="text-sm text-[#2496ED] hover:underline"
          >
            Show All
          </button>
        </div>
      )}

      {error && (
        <div className="mb-3 text-xs text-red-500">
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-3">
        {filtersDefault.map((f) => (
          <button
            key={f}
            onClick={() => setSelectedFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              selectedFilter === f
                ? "bg-[#2496ED] text-white border-[#2496ED]"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
            }`}
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
            className={`pb-2 text-sm relative ${
              selectedTab === tab
                ? "text-[#2496ED] font-medium"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            {tab}
            {selectedTab === tab && (
              <span className="absolute left-0 bottom-0 w-full h-0.5 bg-[#2496ED] rounded-full"></span>
            )}
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
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3">
        {filtered.length === 0 && (
          <div className="text-sm text-gray-500">No containers found.</div>
        )}
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => navigate(`/containers/${c.id}`)}
            className="w-full text-left flex bg-gray-50 rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:bg-gray-100 transition"
          >
            <div className={`w-2 ${getStatusColor(c.status)}`} />
            <div className="flex-1 p-3">
              <div className="flex justify-between">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-gray-500">
                    {c.time || "—"}
                  </div>
                </div>
                <div className="text-sm text-gray-700">
                  {c.cpuPercent ? `${c.cpuPercent}%` : "—"}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-gray-600">
                <div>ID: {c.id}</div>
                <div>
                  MEM: {c.memText ? c.memText : "—"}
                  {c.memPercent ? ` (${c.memPercent}%)` : ""}
                </div>
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

// helper
function normalizeStatus(status) {
  if (!status) return "Unknown";
  const s = status.toLowerCase();
  if (s === "running") return "Running";
  if (s === "exited" || s === "stopped") return "Stopped";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
