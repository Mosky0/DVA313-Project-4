import React, { useEffect, useMemo, useState, useRef } from "react";
import { FaChevronUp, FaChevronDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../config";

export default function ContainersTable({ onSelectionChange }) {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState(""); 
  const [error, setError] = useState("");
  const [selected, setSelected] = useState({}); 


  // only show loading on the veryfirst fetch
  const initialLoadRef = useRef(true);

  useEffect(() => {
    let mounted = true;

    async function fetchStatsFor(id, base) {
      try {
        const res = await fetch(`${API_BASE_URL}/containers/${id}/stats`);
        if (!res.ok) throw new Error("no-stats");
        const s = await res.json();

        let cpu_percent = Number(s.cpu_percent ?? s.cpu ?? 0);

        if ((!cpu_percent || cpu_percent === 0) && s.cpu_stats && s.precpu_stats) {
          const cpuDelta = (s.cpu_stats.cpu_usage?.total_usage ?? 0) - (s.precpu_stats.cpu_usage?.total_usage ?? 0);
          const systemDelta = (s.cpu_stats.system_cpu_usage ?? 0) - (s.precpu_stats.system_cpu_usage ?? 0);
          const percpu = s.cpu_stats.cpu_usage?.percpu_usage?.length ?? 1;
          if (systemDelta > 0 && cpuDelta > 0) {
            cpu_percent = (cpuDelta / systemDelta) * percpu * 100;
          }
        }
        cpu_percent = Math.round(Number(cpu_percent) * 10) / 10;

        let mem_usage = base.mem_usage ?? "—";
        let memPercent = 0;
        if (s.memory_stats) {
          const usage = s.memory_stats.usage ?? s.memory_stats.rss ?? 0;
          const limit = s.memory_stats.limit ?? s.memory_stats.max ?? 0;
          if (usage && limit) {
            memPercent = Math.round((usage / limit) * 100);
            mem_usage = `${(usage / 1024 / 1024).toFixed(1)}MB / ${(limit / 1024 / 1024).toFixed(1)}MB`;
          }
        } else if (s.mem_usage_bytes && s.mem_limit_bytes) {
          memPercent = Math.round((s.mem_usage_bytes / s.mem_limit_bytes) * 100);
          mem_usage = `${Math.round(s.mem_usage_bytes / 1024 / 1024)}MB / ${Math.round(s.mem_limit_bytes / 1024 / 1024)}MB`;
        } else if (s.mem_usage) {
          mem_usage = s.mem_usage;
        }

        return {
          ...base,
          cpu_percent: Number.isFinite(cpu_percent) ? cpu_percent : base.cpu_percent ?? 0,
          mem_usage,
          mem_percent: memPercent,
        };
      } catch (e) {
        return base;
      }
    }

    async function load() {
      if (initialLoadRef.current) {
        setLoading(true);
        setError("");
      } else {
        setError("");
      }

      try {
        const res = await fetch(`${API_BASE_URL}/containers`);
        if (!res.ok) throw new Error("Failed to load /containers");
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Unexpected payload from /containers");
        if (!mounted) return;

        const mapped = data.map((c) => ({
          id: c.id,
          name: c.name || c.id,
          cpu_percent: Number(c.cpu_percent ?? c.cpu ?? 0),
          mem_usage: c.mem_usage ?? c.mem ?? "—",
          status: (c.status ?? "unknown").toString().toLowerCase(),
        }));

        const needStats = mapped.filter((m) => !m.cpu_percent || m.cpu_percent === 0 || m.mem_usage === "—");
        if (needStats.length > 0) {
          const updated = await Promise.all(mapped.map((m) => fetchStatsFor(m.id, m)));
          if (!mounted) return;
          setRows(updated);
        } else {
          setRows(mapped);
        }
      } catch (e) {
        console.error("ContainersTable load error:", e);

        try {
          const res2 = await fetch(`${API_BASE_URL}/containers/summary`);
          if (!res2.ok) throw new Error("Failed to load /containers/summary");
          const data2 = await res2.json();
          if (!mounted) return;

          const mapped2 = Array.isArray(data2)
            ? data2.map((c) => ({
                id: c.id,
                name: c.name || c.id,
                cpu_percent: Number(c.cpu_percent ?? c.cpu ?? 0),
                mem_usage: c.mem_usage ?? c.mem ?? "—",
                status: (c.status ?? "unknown").toString().toLowerCase(),
              }))
            : [];

          const need = mapped2.filter((m) => !m.cpu_percent || m.cpu_percent === 0 || m.mem_usage === "—");
          if (need.length > 0) {
            const updated2 = await Promise.all(mapped2.map((m) => fetchStatsFor(m.id, m)));
            if (!mounted) return;
            setRows(updated2);
          } else {
            setRows(mapped2);
          }
        } catch (e2) {
          console.error("ContainersTable fallback error:", e2);
          setError("backend not reachable");
        }
      } finally {
        if (mounted && initialLoadRef.current) setLoading(false);
        initialLoadRef.current = false;
      }
    }

    load();
    const iv = setInterval(load, 3000);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  // notify dashboard about selection changes
  useEffect(() => {
    if (onSelectionChange) {
      const ids = Object.keys(selected).filter((id) => selected[id]);
      onSelectionChange(ids);
    }
  }, [selected, onSelectionChange]);

  // sorting 
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

  // filter+search
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "Running" && r.status !== "running") return false;
      if (filter === "Stopped" && r.status !== "exited" && r.status !== "stopped") return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (r.name || "").toLowerCase().includes(q) || (r.id || "").toLowerCase().includes(q);
    });
  }, [rows, filter, search]);

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

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 rounded w-48"></div>
          <div className="h-40 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow p-4">
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

        <div className="text-sm text-gray-500">{error}</div>
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="py-2 px-3 text-left">Sel</th>
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
                <td colSpan={6} className="py-4 px-3 text-center text-gray-500">No containers.</td>
              </tr>
            )}

            {sorted.map((r) => {
              const cpuPct = Math.max(0, Math.min(100, Math.round((r.cpu_percent || 0) * 10) / 10));
              const isRunning = r.status === "running";
              return (
                <tr
                  key={r.id}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/containers/${r.id}`)}
                >
                  <td className="py-2 px-3">
                    <input
                      type="checkbox"
                      checked={!!selected[r.id]}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))}
                    />
                  </td>

                  <td className="py-2 px-3 flex items-center">
                    <div className={`w-1 h-8 rounded mr-3 ${isRunning ? "bg-green-500" : "bg-red-500"}`} />
                    <div className="font-mono text-xs">{r.id}</div>
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
      </div>
    </div>
  );
}

