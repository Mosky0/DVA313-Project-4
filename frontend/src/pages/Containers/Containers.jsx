import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaChevronUp, FaChevronDown, FaChevronRight, FaDocker } from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { API_BASE_URL } from "../../config";

const filterOptions = ["All", "Running", "Stopped"];

export default function Containers() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorShown, setErrorShown] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const pollContainers = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/containers?_=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load containers");
        const data = await res.json();
    
        if (!mounted) return;
    
        const mapped = data.map((c) => ({
          id: c.id,
          name: c.name,
          cpu: "-",
          mem: "-",
          status: normalizeStatus(c.status),
        }));
    
        mapped.forEach(async (container) => {
          try {
            const res = await fetch(`${API_BASE_URL}/containers/${container.id}/stats`);
            const stats = res.ok ? await res.json() : null;
            const updatedContainer = {
              ...container,
              cpu: stats?.cpu_percent !== undefined ? `${(stats.cpu_percent).toFixed(2)}%` : "N/A",
              mem: stats?.mem_usage || "N/A",
            };
            if (mounted) {
              setRows((prevRows) => [...prevRows, updatedContainer]);
              setLoading(false);
              setErrorShown(false);
            }
          } catch {
            if (mounted) {
              setRows((prevRows) => [...prevRows, { ...container, cpu: "N/A", mem: "N/A" }]);
              setLoading(false);
            }
          }
        });
      } catch (err) {
        console.error("Poll error:", err);
        if (mounted) {
          if (!errorShown) {
            toast.error("Failed to load containers");
            setErrorShown(true);
          }
          setLoading(false);
        }
      }
    };

    pollContainers();
    const iv = setInterval(pollContainers, 3000);

    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, [errorShown]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const filtered = rows
    .filter((c) => filter === "All" || c.status === filter)
    .filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase())
    );

  const sorted = [...filtered].sort((a, b) => {
    if (!sortField) return 0;
    const valA = a[sortField];
    const valB = b[sortField];
    if (typeof valA === "string" && typeof valB === "string") {
      return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortOrder === "asc" ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
  });

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen bg-linear-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center gap-6 bg-white p-8 rounded-2xl shadow-lg">
          <div className="relative">
            <FaDocker className="text-6xl text-blue-600 animate-pulse" />
            <div className="absolute inset-0 w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mt-2"></div>
          </div>
          <div className="text-lg font-semibold text-gray-700">Loading containers…</div>
          <div className="text-sm text-gray-500">Fetching latest data</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <ToastContainer position="top-right" autoClose={5000} />
      <div className="flex gap-2 mb-4 bg-blue-600 p-1 rounded-lg">
        <button
          onClick={() => navigate("/containers")}
          className={`px-4 py-2 rounded-md text-sm transition ${
            location.pathname === "/containers" ? "bg-white text-blue-700 font-semibold" : "text-white hover:bg-blue-500"
          }`}
        >
          Containers
        </button>
        <button
          onClick={() => navigate("/logs")}
          className={`px-4 py-2 rounded-md text-sm transition ${
            location.pathname === "/logs" ? "bg-white text-blue-700 font-semibold" : "text-white hover:bg-blue-500"
          }`}
        >
          Logs
        </button>
      </div>

      <div className="bg-white pt-3 px-4 rounded-xl shadow mb-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <input
            type="text"
            placeholder="Search container name or ID..."
            className="px-3 py-2 rounded-md border border-gray-300 w-64 bg-gray-50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="px-3 py-2 rounded-md border border-gray-300 bg-white"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {filterOptions.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-blue-600 text-white">
            <tr>
              {["id", "name", "cpu", "mem", "status"].map((col) => (
                <th key={col} className="py-3 px-4 cursor-pointer select-none" onClick={() => handleSort(col)}>
                  <div className="flex items-center gap-1">
                    {col.toUpperCase()}
                    {sortField === col && (sortOrder === "asc" ? <FaChevronUp className="text-xs" /> : <FaChevronDown className="text-xs" />)}
                  </div>
                </th>
              ))}
              <th className="py-3 px-4">View</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 px-4 text-center text-gray-500">No containers found.</td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr key={row.id} className="border-b hover:bg-gray-100">
                  <td className="py-3 px-4">{row.id}</td>
                  <td className="py-3 px-4">{row.name}</td>
                  <td className="py-3 px-4">{row.cpu}</td>
                  <td className="py-3 px-4">{row.mem}</td>
                  <td className="py-3 px-4">{row.status}</td>
                  <td className="py-3 px-4 text-right">
                    <button className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300" onClick={() => navigate(`/containers/${row.id}`)}>
                      <FaChevronRight />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function normalizeStatus(status) {
  if (!status) return "Unknown";
  const s = status.toLowerCase();
  if (s === "running") return "Running";
  if (s === "exited" || s === "stopped") return "Stopped";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
