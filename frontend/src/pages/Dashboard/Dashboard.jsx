import React, { useCallback, useEffect, useMemo, useState , useRef } from "react";
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
  const [selectedForChart, setSelectedForChart] = useState([]); // array of container ids

  // loaders
    useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await fetch(`${API_BASE_URL}/system`);
        if (!res.ok) throw new Error("no sys");
        const j = await res.json();
        console.log("System loaded:", j);
        if (mounted) setSystem(j);
      } catch (e) {
        console.error("loadSystem error:", e);
      } finally {
        if (mounted) setLoadingSys(false);
      }

      try {
        let res = await fetch(`${API_BASE_URL}/containers/summary`);
        if (!res.ok) {
          res = await fetch(`${API_BASE_URL}/containers`);
        }
        if (!res.ok) throw new Error("no endpoints");
        const j = await res.json();
        console.log("Containers loaded:", j);
        const mapped = (Array.isArray(j) ? j : []).map((c) => ({
          id: c.id,
          name: c.name || c.id,
          cpu_percent: Number(c.cpu_percent ?? c.cpu ?? 0),
          mem_usage: c.mem_usage ?? c.mem ?? "0 B",
          status: (c.status ?? "").toString().toLowerCase(),
        }));
        if (mounted) setContainers(mapped);
      } catch (e) {
        console.error("loadContainers error:", e);
      }

      try {
        const res = await fetch(`${API_BASE_URL}/events`);
        if (!res.ok) return;
        const j = await res.json();
        if (mounted) setEvents(Array.isArray(j) ? j : []);
      } catch (e) {
        console.error("loadEvents error:", e);
      }
    }

    load();
    const iv = setInterval(load, 3000);

    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);


  // CPU trend history built from current cpu_percent (6 points)
  const cpuTrendSeries = useMemo(() => {
    const labels = ["t-5","t-4","t-3","t-2","t-1","now"];
    return labels.map((lbl, idx) => {
      const point = { time: lbl };
      containers.forEach((c) => {
        if (!selectedForChart.includes(c.id)) return;
        const base = Math.max(0, Math.round(c.cpu_percent || 0));
        const factor = 0.5 + (idx / (labels.length - 1)) * 0.6;
        point[c.name || c.id] = Math.min(100, Math.round(base * factor));
      });
      return point;
    });
  }, [containers, selectedForChart]);

  const memPct = useMemo(() => {
    if (!system) return 0;
    const used = system.memory?.used_bytes || 0;
    const limit = system.memory?.limit_bytes || 0;
    if (!limit) return 0;
    return Math.round((used / limit) * 100);
  }, [system]);

   // derive alerts from backend events + container metrics
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

     //  keep up to 20
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

  // callback receiving selected IDs from table
  const onSelectionChange = useCallback((ids) => {
    setSelectedForChart(ids);
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* TOP CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="text-xs text-gray-500">Load (1/5/15)</div>
          <div className="text-lg font-semibold">{(system?.load || [0,0,0]).map(v => (v.toFixed? v.toFixed(2):v)).join(" / ")}</div>
          <div className="text-xs text-gray-400 mt-1">Processes: {system?.total_processes ?? 0} • Running: {system?.running ?? 0}</div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow flex items-center">
          <CircleMetric value={Math.round(system?.cpu?.total_percent || 0)} label="CPU Avg" />
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
          <div className="mt-2 text-lg font-semibold">{system?.uptime ?? "N/A"}</div>
          <div className="text-xs text-gray-400 mt-1">Host</div>
        </div>
      </div>

      {/* CPU activity + trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="text-sm font-medium mb-3">CPU Activity (per core)</div>
          <div className="space-y-3">
            {(system?.cpu?.per_core || []).length ? (system.cpu.per_core.map((v,i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-12 text-xs text-gray-600">CPU {i}</div>
                <div className="flex-1">
                  <div className="bg-gray-100 rounded h-3 overflow-hidden">
                    <div className="h-3 bg-[#2496ED]" style={{ width: `${v}%` }} />
                  </div>
                </div>
                <div className="w-12 text-right text-xs font-medium">{Math.round(v)}%</div>
              </div>
            ))) : <div className="text-xs text-gray-500">No per-core data.</div>}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">CPU trend (selected)</div>
            <div className="text-xs text-gray-500">Selected: {selectedForChart.length}</div>
          </div>

          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cpuTrendSeries}>
                <XAxis dataKey="time" stroke="#888" />
                <YAxis stroke="#888" domain={[0, 100]} />
                <Tooltip />
                <Legend />
                {containers.map((c, idx) => selectedForChart.includes(c.id) ? (
                  <Line key={c.id} type="monotone" dataKey={c.name || c.id} stroke={["#3b82f6","#10b981","#f59e0b","#ef4444"][idx%4]} dot={false} strokeWidth={2} />
                ) : null)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Memory trend + events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow p-4">
          <ChartCard title="Memory trend (sample)" data={[{time:"t-6", value:40},{time:"t-5",value:42},{time:"t-4",value:41},{time:"t-3",value:47},{time:"t-2",value:44},{time:"now",value:50}]} type="area" />
        </div>

         <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Alerts & Recent Events</div>
          </div>
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


      {/* Containers table full-width */}
      <div>
        <ContainersTable onSelectionChange={onSelectionChange} />
      </div>
    </div>
  );
}
