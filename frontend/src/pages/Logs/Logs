import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Logs() {
  const navigate = useNavigate();

  /** ------------------ DUMMY DATA FOR NOW ------------------ **/
  const dummyContainers = [
    { id: "a1b2", name: "postgres-db" },
    { id: "c3d4", name: "monitoring-app" },
    { id: "e5f6", name: "redis-cache" },
  ];

  const dummyLogs = [
    "[2025-02-12 10:30:02] Container started successfully...",
    "[2025-02-12 10:30:03] Checking system dependencies...",
    "[2025-02-12 10:30:04] CPU usage 12%",
    "[2025-02-12 10:30:06] Health check OK",
    "[2025-02-12 10:30:10] Processing requests...",
    "[2025-02-12 10:30:14] Warning: high memory usage",
    "[2025-02-12 10:30:20] Connection reset by peer",
  ];

  /** -------------------------------------------------------- **/

  const [containers] = useState(dummyContainers);
  const [selectedContainer, setSelectedContainer] = useState("");
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");

  // When container changes → load dummy logs
  useEffect(() => {
    if (!selectedContainer) {
      setLogs([]);
    } else {
      setLogs(dummyLogs);
    }
  }, [selectedContainer]);

  // Filter logs in real-time
  const filteredLogs = logs.filter((line) =>
    line.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* ---------------------- TABS ---------------------- */}
      <div className="flex gap-3 mb-6 bg-blue-600 p-2 rounded-xl shadow">
        <button
          onClick={() => navigate("/containers")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
            window.location.pathname === "/containers"
              ? "bg-white text-blue-600 shadow"
              : "text-white hover:bg-blue-500"
          }`}
        >
          Containers
        </button>

        <button
          onClick={() => navigate("/logs")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
            window.location.pathname === "/logs"
              ? "bg-white text-blue-600 shadow"
              : "text-white hover:bg-blue-500"
          }`}
        >
          Logs
        </button>
      </div>

      {/* ---------------------- SEARCH + FILTER ---------------------- */}
      <div className="bg-white p-4 rounded-xl shadow mb-6 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4 items-center">

          {/* Container dropdown */}
          <select
            className="w-full md:w-64 border border-gray-300 px-3 py-2 rounded-lg bg-gray-50 shadow-sm focus:ring-2 focus:ring-blue-400"
            value={selectedContainer}
            onChange={(e) => setSelectedContainer(e.target.value)}
          >
            <option value="">Select container</option>
            {containers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Search input */}
          <input
            type="text"
            placeholder="Search logs…"
            className="w-full md:w-72 border border-gray-300 px-3 py-2 rounded-lg bg-gray-50 shadow-sm focus:ring-2 focus:ring-blue-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ---------------------- LOG VIEWER ---------------------- */}
      <div className="bg-[#1e1e1e] text-green-400 p-5 rounded-xl h-[450px] overflow-y-auto shadow-inner border border-gray-700 font-mono text-sm whitespace-pre-wrap">
        {selectedContainer ? (
          filteredLogs.length ? (
            filteredLogs.map((line, i) => (
              <div key={i} className="py-0.5">{line}</div>
            ))
          ) : (
            <div className="text-gray-400">No logs found…</div>
          )
        ) : (
          <div className="text-gray-400">Select a container to view logs</div>
        )}
      </div>
    </div>
  );
}
