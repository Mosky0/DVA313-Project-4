import React, { useCallback, useEffect, useMemo, useState } from "react";
import ChartCard from "../../components/ui/ChartCard";
import CircleMetric from "../../components/ui/CircleMetric";
import ContainersTable from "../../components/containers/ContainersTable";
import { API_BASE_URL } from "../../config";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from "recharts";

export default function Dashboard() {
  const [system, setSystem] = useState(null);
  const [containers, setContainers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loadingSys, setLoadingSys] = useState(true);
  const [selectedCores, setSelectedCores] = useState({});

  // SINGLE UNIFIED POLLing effect for system, containers, stats, events
  useEffect(() => {
    let mounted = true;

    const pollAllData = async () => {
      try {
        // Fetch system
        const sysRes = await fetch(`${API_BASE_URL}/system`);
        const sysData = sysRes.ok ? await sysRes.json() : null;
        if (mounted && sysData) setSystem(sysData);

        // Fetch containers list
        const contRes = await fetch(`${API_BASE_URL}/containers?_=${Date.now()}`, { cache: "no-store" });
        if (!contRes.ok) return;
        const contListData = await contRes.json();

        if (!mounted || !Array.isArray(contListData)) return;

        // Map basic info
        const mapped = contListData.map((c) => ({
          id: c.id || c.Id || "",
          name: c.name || c.Name || c.id || "",
          cpu_percent: 0,
          mem_usage: "—",
          status: (c.status || c.Status || "").toString().toLowerCase(),
        }));

        // Fetch stats for ALL containers 
        const statsPromises = mapped.map((container) =>
          fetch(`${API_BASE_URL}/containers/${container.id}/stats`)
            .then((res) => (res.ok ? res.json() : null))
            .then((stats) => {
              if (!stats) return null;
              // CPU value comes as decimal multiply by 100 to get percentage
              const rawCpu = Number(stats.cpu_percent ?? stats.CPUPercent ?? stats.cpu ?? 0);
              const cpuValue = rawCpu < 10 ? rawCpu * 100 : rawCpu; 
              console.log(`Stats for ${container.id}:`, stats);
              console.log(`  → raw cpu: ${rawCpu}, display cpu: ${cpuValue}%`);
              return {
                id: container.id,
                cpu_percent: Number(cpuValue) || 0,
                mem_usage: stats.mem_usage ?? stats.MemoryUsage ?? stats.memory ?? "—",
              };
            })
            .catch((err) => {
              console.error(`Stats fetch error for ${container.id}:`, err);
              return null;
            })
        );

        const statsResults = await Promise.all(statsPromises);

        // Update all containers at once with stats
        if (mounted) {
          const updated = mapped.map((c) => {
            const stats = statsResults.find((s) => s && s.id === c.id);
            return stats ? { ...c, ...stats } : c;
          });
          setContainers(updated);
        }

        // Fetch events 
        const evRes = await fetch(`${API_BASE_URL}/events?_=${Date.now()}`, { cache: "no-store" });
        if (evRes.ok) {
          const evData = await evRes.json();
          if (mounted) setEvents(Array.isArray(evData) ? evData : []);
        } else {
          // 404 or other error / clear events
          if (mounted) setEvents([]);
        }
      } catch (e) {
        console.error("pollAllData error:", e);
      } finally {
        if (mounted) setLoadingSys(false);
      }
    };

    pollAllData();
    const iv = setInterval(pollAllData, 3000);

    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  // CPU TREND FROM SELECTED CORES
  const cpuTrendSeries = useMemo(() => {
    const labels = ["t-5", "t-4", "t-3", "t-2", "t-1", "now"];
    const cpuPerCore = system?.cpu?.per_core || [];

    return labels.map((lbl, idx) => {
      const point = { time: lbl };
      cpuPerCore.forEach((coreValue, coreIdx) => {
        if (!selectedCores[coreIdx]) return;
        const base = Math.max(0, Math.round(coreValue || 0));
        const factor = 0.5 + (idx / (labels.length - 1)) * 0.6;
        point[`Core ${coreIdx}`] = Math.min(100, Math.round(base * factor));
      });
      return point;
    });
  }, [system, selectedCores]);

  const memPct = useMemo(() => {
    if (!system) return 0;
    const used = system.memory?.used_bytes || 0;
    const limit = system.memory?.limit_bytes || 0;
    if (!limit) return 0;
    return Math.round((used / limit) * 100);
  }, [system]);

  const derivedAlerts = useMemo(() => {
    const parseMemPercent = (memStr) => {
      try {
        if (!memStr || typeof memStr !== "string") return null;
        const parts = memStr.split("/").map((p) => p.trim());
        if (parts.length !== 2) return null;
        const usedMB = parseFloat(parts[0].replace(/[^0-9.]/g, ""));
        const limitMB = parseFloat(parts[1].replace(/[^0-9.]/g, ""));
        if (!isFinite(usedMB) || !isFinite(limitMB) || limitMB === 0) return null;
        return Math.round((usedMB / limitMB) * 100);
      } catch (e) {
        return null;
      }
    };

    const alerts = [];

    if (events && events.length) {
      events.slice(0, 10).forEach((ev) => {
        alerts.push({
          severity: "info",
          time: ev.time || ev.timestamp || "",
          message: ev.message ?? ev.msg ?? JSON.stringify(ev),
        });
      });
    }

    containers.forEach((c) => {
      if (!c) return;
      const name = c.name || c.id;
      if ((c.status || "").toLowerCase() !== "running") {
        alerts.push({ severity: "critical", time: "", message: `${name} is ${c.status || "stopped"}` });
      }
      const cpu = Number(c.cpu_percent ?? 0);
      if (cpu && cpu >= 75) {
        alerts.push({ severity: "warning", time: "", message: `${name} high CPU ${cpu}%` });
      }
      const memPctC = parseMemPercent(c.mem_usage) ?? (c.mem_percent ?? null);
      if (memPctC && memPctC >= 75) {
        alerts.push({ severity: "warning", time: "", message: `${name} high MEM ${memPctC}%` });
      }
    });

    const seen = new Set();
    const unique = [];
    for (const a of alerts) {
      const key = `${a.severity}:${a.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(a);
      }
      if (unique.length >= 20) break;
    }
    return unique;
  }, [events, containers]);

  const handleCoreToggle = useCallback((coreIdx) => {
    setSelectedCores((prev) => ({
      ...prev,
      [coreIdx]: !prev[coreIdx]
    }));
  }, []);

  if (loadingSys) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl shadow p-4 text-sm text-gray-500">
          Loading dashboard…
        </div>
      </div>
    );
  }

  const load = system?.load || [0, 0, 0];
  const uptime = system?.uptime || "N/A";
  const totalProcesses = system?.total_processes ?? 0;
  const running = system?.running ?? 0;
  const cpuTotal = system?.cpu?.total_percent ?? 0;
  const cpuPerCore = system?.cpu?.per_core || [];

  return (
    <div className="p-6 space-y-6">
      {/* TOP CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="text-xs text-gray-500">Load (1/5/15)</div>
          <div className="text-lg font-semibold">
            {load.map((l) => (typeof l === "number" ? l.toFixed(2) : l)).join(" / ")}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Processes: {totalProcesses} • Running: {running}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow flex items-center">
          <CircleMetric value={Math.round(cpuTotal)} label="CPU Avg" />
        </div>

        <div className="bg-white rounded-xl p-4 shadow">
          <div className="text-xs text-gray-500">Memory</div>
          <div className="mt-2 text-sm font-semibold">{memPct}%</div>
          <div className="mt-3">
            <div className="bg-gray-200 h-2 rounded overflow-hidden">
              <div className="h-2 bg-[#2496ED]" style={{ width: `${memPct}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow">
          <div className="text-xs text-gray-500">Uptime</div>
          <div className="mt-2 text-lg font-semibold">{uptime}</div>
          <div className="text-xs text-gray-400 mt-1">Host</div>
        </div>
      </div>

      {/* CPU ACTIVITY (PER CORE) + TREND */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="text-sm font-medium mb-3">CPU Activity (per core)</div>
          <div className="space-y-3">
            {cpuPerCore.length ? (
              cpuPerCore.map((v, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={!!selectedCores[i]}
                    onChange={() => handleCoreToggle(i)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <div className="w-12 text-xs text-gray-600">CPU {i}</div>
                  <div className="flex-1">
                    <div className="bg-gray-100 rounded h-3 overflow-hidden">
                      <div className="h-3 bg-[#2496ED]" style={{ width: `${v}%` }} />
                    </div>
                  </div>
                  <div className="w-12 text-right text-xs font-medium">{Math.round(v)}%</div>
                </div>
              ))
            ) : (
              <div className="text-xs text-gray-500">No per-core data.</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">CPU trend (selected cores)</div>
            <div className="text-xs text-gray-500">Selected: {Object.values(selectedCores).filter(Boolean).length} cores</div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cpuTrendSeries}>
                <XAxis dataKey="time" stroke="#888" />
                <YAxis stroke="#888" domain={[0, 100]} />
                <Tooltip />
                <Legend />
                {cpuPerCore.map((_, coreIdx) =>
                  selectedCores[coreIdx] ? (
                    <Line
                      key={coreIdx}
                      type="monotone"
                      dataKey={`Core ${coreIdx}`}
                      stroke={["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"][coreIdx % 6]}
                      dot={false}
                      strokeWidth={2}
                    />
                  ) : null
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Memory trend + alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow p-4">
          <ChartCard
            title="Memory trend (sample)"
            data={[
              { time: "t-6", value: 40 },
              { time: "t-5", value: 42 },
              { time: "t-4", value: 41 },
              { time: "t-3", value: 47 },
              { time: "t-2", value: 44 },
              { time: "now", value: 50 },
            ]}
            type="area"
          />
        </div>

        <div className="bg-white rounded-2xl shadow p-4">
          <div className="text-sm font-medium mb-3">Alerts & Recent Events</div>
          <div className="space-y-2 text-sm text-gray-700 max-h-80 overflow-y-auto">
            {derivedAlerts.length === 0 ? (
              <div className="text-xs text-gray-400">No alerts or events</div>
            ) : (
              derivedAlerts.map((a, i) => (
                <div
                  key={i}
                  className={`p-2 rounded flex items-start gap-3 ${
                    a.severity === "critical" ? "bg-red-50" : a.severity === "warning" ? "bg-yellow-50" : "bg-gray-50"
                  }`}
                >
                  <div
                    className={`w-2 h-6 rounded ${
                      a.severity === "critical" ? "bg-red-500" : a.severity === "warning" ? "bg-yellow-400" : "bg-gray-400"
                    }`}
                  />
                  <div className="flex-1">
                    <div className="text-xs text-gray-600 mb-1">{a.time}</div>
                    <div className="text-sm">{a.message}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Containers table */}
      <div>
        <ContainersTable containers={containers} />
      </div>
    </div>
  );
}