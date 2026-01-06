import React, { useMemo, useState, useEffect, useRef } from "react";
import { FaChevronUp, FaChevronDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";


export default function ContainersTable({ containers = [] }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("");  
  const [initialLoading, setInitialLoading] = useState(true);
  const prevContainersLength = useRef(null);

  useEffect(() => {
    if (!containers) return;

    const currentLength = containers.length;
    const prevLength = prevContainersLength.current;

    if (prevLength === null) {
      prevContainersLength.current = currentLength;
      return;
    }
    if (currentLength === prevLength && currentLength > 0) {
      setInitialLoading(false);
    }

    prevContainersLength.current = currentLength;
  }, [containers]);


  const handleSort = (field) => {
    if (sortField !== field) {
      setSortField(field);
      setSortOrder("desc");
      return;
    }
    if (sortOrder === "desc") setSortOrder("asc");
    else if (sortOrder === "asc") {
      setSortOrder("");
      setSortField("");
    } else setSortOrder("desc");
  };


  const filtered = useMemo(() => {
    return containers.filter((r) => {
      if (filter === "Running" && r.status !== "running") return false;
      if (filter === "Stopped" && r.status !== "exited" && r.status !== "stopped") return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (r.name || "").toLowerCase().includes(q) || (r.id || "").toLowerCase().includes(q);
    });
  }, [containers, filter, search]);


  const statusOrder = { running: 0, exited: 1, stopped: 1 };


  const sorted = useMemo(() => {
    if (!sortField) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const A = a[sortField];
      const B = b[sortField];


      if (sortField === "status") {
        const oa = statusOrder[A] ?? 99;
        const ob = statusOrder[B] ?? 99;
        return sortOrder === "asc" ? oa - ob : ob - oa;
      }


      if (typeof A === "number" && typeof B === "number") {
        return sortOrder === "asc" ? A - B : B - A;
      }
      return sortOrder === "asc" ? ("" + A).localeCompare(B) : ("" + B).localeCompare(A);
    });
    return arr;
  }, [filtered, sortField, sortOrder]);


  const barClassFor = (pct) => {
    if (pct >= 80) return "bg-red-500";
    if (pct >= 50) return "bg-yellow-400";
    return "bg-green-500";
  };


  return (
    <>
      {/* Search + filter */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="flex items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search container ID or name..."
            className="px-3 py-2 rounded-md border border-gray-200 w-72 bg-gray-50 text-sm"
          />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 rounded-md border border-gray-200 bg-white text-sm">
            <option>All</option>
            <option>Running</option>
            <option>Stopped</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="py-2 px-3 text-left cursor-pointer" onClick={() => handleSort("id")}>
                <div className="flex items-center gap-1">ID {sortField === "id" && (sortOrder === "desc" ? <FaChevronDown /> : sortOrder === "asc" ? <FaChevronUp /> : null)}</div>
              </th>
              <th className="py-2 px-3 text-left cursor-pointer" onClick={() => handleSort("name")}>
                <div className="flex items-center gap-1">Name {sortField === "name" && (sortOrder === "desc" ? <FaChevronDown /> : sortOrder === "asc" ? <FaChevronUp /> : null)}</div>
              </th>
              <th className="py-2 px-3 text-left cursor-pointer" onClick={() => handleSort("cpu_percent")}>
                <div className="flex items-center gap-1">CPU% {sortField === "cpu_percent" && (sortOrder === "desc" ? <FaChevronDown /> : sortOrder === "asc" ? <FaChevronUp /> : null)}</div>
              </th>
              <th className="py-2 px-3 text-left cursor-pointer" onClick={() => handleSort("mem_usage")}>
                <div className="flex items-center gap-1">MEM {sortField === "mem_usage" && (sortOrder === "desc" ? <FaChevronDown /> : sortOrder === "asc" ? <FaChevronUp /> : null)}</div>
              </th>
              <th className="py-2 px-3 text-left cursor-pointer" onClick={() => handleSort("status")}>
                <div className="flex items-center gap-1">Status {sortField === "status" && (sortOrder === "desc" ? <FaChevronDown /> : sortOrder === "asc" ? <FaChevronUp /> : null)}</div>
              </th>
            </tr>
          </thead>


          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 px-3 text-center text-gray-500">No containers.</td>
              </tr>
            )}


            {sorted.map((r) => {
              const cpuPct = Math.max(0, Math.min(100, Math.round((r.cpu_percent || 0) * 10) / 10));
              const isRunning = r.status === "running";
              return (
                <tr
                  key={r.id}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    navigate(`/containers/${r.id}`, { state: { name: r?.name } });
                  }}
                >
                  <td className="py-2 px-3 flex items-center">
                    <div className={`w-1 h-8 rounded mr-3 ${isRunning ? "bg-green-500" : "bg-red-500"}`} />
                    <div className="font-mono text-xs">{r.id.length > 10 ? `${r.id.substring(0, 10)}...` : r.id}</div>
                  </td>


                  <td className="py-2 px-3">{r.name}</td>


                  <td className="py-2 px-3 w-44">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="bg-gray-100 h-2 rounded overflow-hidden">
                          <div style={{ width: `${cpuPct}%` }} className={`h-2 ${barClassFor(cpuPct)}`}></div>
                        </div>
                      </div>
                      <div className="w-10 text-right text-xs font-medium">{cpuPct ? `${cpuPct}%` : "—"}</div>
                    </div>
                  </td>


                  <td className="py-2 px-3 w-48">
                    <div className="text-xs text-gray-600">{r.mem_usage || "—"}</div>
                  </td>


                  <td className="py-2 px-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${isRunning ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"}`}>
                      {isRunning ? "Running" : "Stopped"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {initialLoading && (
            <div className="flex justify-center items-center py-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                Loading containers…
              </div>
            </div>
          )}
      </div>

    </>
  );
}
