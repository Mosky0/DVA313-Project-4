import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaChevronUp, FaChevronDown, FaChevronRight } from "react-icons/fa";
import { API_BASE_URL } from "../../config"; // adjust path if needed

const filterOptions = ["All", "Running", "Stopped"];

export default function Containers() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");

  const [rows, setRows] = useState([]);      // real containers
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  // ---- FETCH CONTAINERS FROM BACKEND ----
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
          cpu: c.cpu_percent, 
          mem: c.mem_usage, 
          status: normalizeStatus(c.status),
        }));
        setRows(mapped);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load containers.");
        setLoading(false);
      });
  }, []);

  // ---- SORT HANDLER ----
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // ---- FILTER + SEARCH + SORT LOGIC ----
  const filtered = rows
    .filter((c) => (filter === "All" ? true : c.status === filter))
    .filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase())
    );

  const sorted = [...filtered].sort((a, b) => {
    if (!sortField) return 0;
    const valA = a[sortField];
    const valB = b[sortField];

    if (typeof valA === "string" && typeof valB === "string") {
      return sortOrder === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }

    if (sortOrder === "asc") return valA > valB ? 1 : -1;
    return valA < valB ? 1 : -1;
  });

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl shadow p-4 text-sm text-gray-500">
          Loading containers…
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* -------------------- TABS -------------------- */}
      <div className="flex gap-2 mb-4 bg-blue-600 p-1 rounded-lg">
        <button
          onClick={() => navigate("/containers")}
          className={`px-4 py-2 rounded-md text-sm transition ${
            location.pathname === "/containers"
              ? "bg-white text-blue-700 font-semibold"
              : "text-white hover:bg-blue-500"
          }`}
        >
          Containers
        </button>

        <button
          onClick={() => navigate("/logs")}
          className={`px-4 py-2 rounded-md text-sm transition ${
            location.pathname === "/logs"
              ? "bg-white text-blue-700 font-semibold"
              : "text-white hover:bg-blue-500"
          }`}
        >
          Logs
        </button>
      </div>

      {/* -------------------- SEARCH + FILTER -------------------- */}
      <div className="bg-white pt-3 px-4 rounded-xl shadow mb-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          {/* search */}
          <input
            type="text"
            placeholder="Search container name or ID..."
            className="px-3 py-2 rounded-md border border-gray-300 w-64 bg-gray-50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* filter */}
          <select
            className="px-3 py-2 rounded-md border border-gray-300 bg-white"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {filterOptions.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-3 text-xs text-red-500">
            {error}
          </div>
        )}
      </div>

      {/* -------------------- TABLE -------------------- */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-blue-600 text-white">
            <tr>
              {["id", "name", "cpu", "mem", "status"].map((col) => (
                <th
                  key={col}
                  className="py-3 px-4 cursor-pointer select-none"
                  onClick={() => handleSort(col)}
                >
                  <div className="flex items-center gap-1">
                    {col.toUpperCase()}
                    {sortField === col ? (
                      sortOrder === "asc" ? (
                        <FaChevronUp className="text-xs" />
                      ) : (
                        <FaChevronDown className="text-xs" />
                      )
                    ) : null}
                  </div>
                </th>
              ))}
              <th className="py-3 px-4">View</th>
            </tr>
          </thead>

          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-4 px-4 text-center text-gray-500"
                >
                  No containers found.
                </td>
              </tr>
            )}

            {sorted.map((row) => (
              <tr key={row.id} className="border-b hover:bg-gray-100">
                <td className="py-3 px-4">{row.id}</td>
                <td className="py-3 px-4">{row.name}</td>
                <td className="py-3 px-4">{row.cpu}%</td>
                <td className="py-3 px-4">{row.mem}%</td>
                <td className="py-3 px-4">{row.status}</td>

                <td className="py-3 px-4 text-right">
                  <button
                    className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300"
                    onClick={() => navigate(`/containers/${row.id}`)}
                  >
                    <FaChevronRight />
                  </button>
                </td>
              </tr>
            ))}
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
