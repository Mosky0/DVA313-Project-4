// src/pages/Dashboard/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import ContainerListPanel from "../../components/containers/ContainerListPanel";
import ChartCard from "../../components/ui/ChartCard";
import CircleMetric from "../../components/ui/CircleMetric";
import { API_BASE_URL } from "../../config"; // make sure this exists

// Still using dummy trend for now; can be wired later to history
const cpuTrendDummy = [
  { time: "10:00", value: 20 }, { time: "10:05", value: 30 }, { time: "10:10", value: 25 },
  { time: "10:15", value: 45 }, { time: "10:20", value: 35 }, { time: "10:25", value: 55 },
];
const memTrendDummy = [
  { time: "10:00", value: 40 }, { time: "10:05", value: 42 }, { time: "10:10", value: 41 },
  { time: "10:15", value: 47 }, { time: "10:20", value: 44 }, { time: "10:25", value: 50 },
];

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // fetch system overview
  useEffect(() => {
    setLoading(true);
    setError("");

    fetch(`${API_BASE_URL}/system`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch system metrics");
        return res.json();
      })
      .then((data) => {
        setSnapshot(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load system overview.");
        setLoading(false);
      });
  }, []);

  const memPct = useMemo(() => {
    if (!snapshot) return 0;
    const used = snapshot.memory?.used_bytes ?? 0;
    const total = snapshot.memory?.limit_bytes ?? 0;
    if (!total) return 0;
    return Math.round((used / total) * 100);
  }, [snapshot]);

  if (loading && !snapshot) {
    return (
      <div className="flex gap-6">
        <div className="w-80 shrink-0">
          <ContainerListPanel showHeader={true} />
        </div>
        <div className="flex-1">
          <div className="bg-white rounded-2xl shadow p-4 text-sm text-gray-500">
            Loading system overview…
          </div>
        </div>
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="flex gap-6">
        <div className="w-80 shrink-0">
          <ContainerListPanel showHeader={true} />
        </div>
        <div className="flex-1">
          <div className="bg-white rounded-2xl shadow p-4 text-sm text-red-500">
            {error}
          </div>
        </div>
      </div>
    );
  }

  // Fallbacks if some fields are missing
  const load = snapshot?.load || [0, 0, 0];
  const uptime = snapshot?.uptime || "N/A";
  const totalProcesses = snapshot?.total_processes ?? 0;
  const running = snapshot?.running ?? 0;
  const cpuTotal = snapshot?.cpu?.total_percent ?? 0;
  const cpuPerCore = snapshot?.cpu?.per_core || [];

  return (
    <div className="flex gap-6">
      <div className="w-80 shrink-0">
        <ContainerListPanel showHeader={true} />
      </div>

      <div className="flex-1 space-y-6">
        {/* ------- System Overview ------- */}
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">System Overview</h2>
            <div className="text-sm text-gray-500">
              Updated: {new Date().toLocaleTimeString()}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {/* Load + processes */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">Load (1 / 5 / 15)</div>
              <div className="text-lg font-semibold">
                {load.map((l) => l.toFixed(2)).join(" / ")}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Processes: {totalProcesses} • Running: {running}
              </div>
            </div>

            {/* CPU avg */}
            <div className="bg-white rounded-xl p-4 shadow-sm flex items-center">
              <CircleMetric value={cpuTotal} label="CPU Avg" />
            </div>

            {/* Memory */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">Memory</div>
              <div className="mt-2 text-sm font-semibold">{memPct}%</div>
              <div className="mt-3">
                <div className="bg-gray-200 h-2 rounded overflow-hidden">
                  <div
                    style={{ width: `${memPct}%` }}
                    className="h-2 bg-[#2496ED]"
                  ></div>
                </div>
              </div>
            </div>

            {/* Uptime */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">Uptime</div>
              <div className="mt-2 text-lg font-semibold">{uptime}</div>
              <div className="text-xs text-gray-400 mt-1">
                Nodes: Docker host
              </div>
            </div>
          </div>
        </div>

        {/* ------- CPU cards ------- */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="text-sm font-medium mb-3">
              CPU Activity (per core)
            </div>
            <div className="space-y-3">
              {cpuPerCore.map((v, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-12 text-xs text-gray-600">CPU {i}</div>
                  <div className="flex-1">
                    <div className="bg-gray-100 rounded h-3 overflow-hidden">
                      <div
                        style={{ width: `${v}%` }}
                        className="h-3 bg-[#2496ED]"
                      ></div>
                    </div>
                  </div>
                  <div className="w-12 text-right text-xs font-medium">
                    {Math.round(v)}%
                  </div>
                </div>
              ))}
              {cpuPerCore.length === 0 && (
                <div className="text-xs text-gray-500">
                  No per-core data available.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <ChartCard title="CPU trend (30m)" data={cpuTrendDummy} type="line" />
          </div>
        </div>

        {/* ------- Memory trend + events ------- */}
        <div className="grid grid-cols-2 gap-6">
          <ChartCard title="Memory trend (30m)" data={memTrendDummy} type="area" />
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="text-sm font-medium mb-3">Quick events</div>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="p-2 bg-gray-50 rounded">
                [11:50] ied-05 high CPU alert
              </li>
              <li className="p-2 bg-gray-50 rounded">
                [11:45] ied-03 restarted
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
