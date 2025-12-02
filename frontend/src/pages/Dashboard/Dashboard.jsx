// src/pages/Dashboard/Dashboard.jsx
import React, { useMemo } from "react";
import ContainerListPanel from "../../components/containers/ContainerListPanel";
import ChartCard from "../../components/ui/ChartCard";
import CircleMetric from "../../components/ui/CircleMetric";

/* Dummy data - later replace with backend fetches */
const cpuTrend = [
  { time: "10:00", value: 20 }, { time: "10:05", value: 30 }, { time: "10:10", value: 25 },
  { time: "10:15", value: 45 }, { time: "10:20", value: 35 }, { time: "10:25", value: 55 },
];
const memTrend = [
  { time: "10:00", value: 40 }, { time: "10:05", value: 42 }, { time: "10:10", value: 41 },
  { time: "10:15", value: 47 }, { time: "10:20", value: 44 }, { time: "10:25", value: 50 },
];

export default function Dashboard() {
  // Dummy system snapshot
  const snapshot = {
    load: [0.92, 0.85, 0.7],
    uptime: "2 days 4h",
    total_processes: 128,
    running: 24,
    cpu: { total_percent: 37, per_core: [28, 44, 33, 43] },
    memory: { used_bytes: 3_221_225_472, limit_bytes: 8_589_934_592 }
  };

  const memPct = useMemo(()=> Math.round((snapshot.memory.used_bytes / snapshot.memory.limit_bytes) * 100), [snapshot]);

  return (
    <div className="flex gap-6">
      <div className="w-80 shrink-0">
        <ContainerListPanel showHeader={true} />
      </div>

      <div className="flex-1 space-y-6">
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">System Overview</h2>
            <div className="text-sm text-gray-500">Updated: {new Date().toLocaleTimeString()}</div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">Load (1/5/15)</div>
              <div className="text-lg font-semibold">{snapshot.load.map(l=>l.toFixed(2)).join(" / ")}</div>
              <div className="text-xs text-gray-400 mt-1">Processes: {snapshot.total_processes} • Running: {snapshot.running}</div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm flex items-center">
              <CircleMetric value={snapshot.cpu.total_percent} label="CPU Avg" />
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">Memory</div>
              <div className="mt-2 text-sm font-semibold">{memPct}%</div>
              <div className="mt-3"><div className="bg-gray-200 h-2 rounded overflow-hidden"><div style={{width:`${memPct}%`}} className="h-2 bg-[#2496ED]"></div></div></div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gray-500">Uptime</div>
              <div className="mt-2 text-lg font-semibold">{snapshot.uptime}</div>
              <div className="text-xs text-gray-400 mt-1">Nodes: Docker host</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="text-sm font-medium mb-3">CPU Activity (per core)</div>
            <div className="space-y-3">
              {snapshot.cpu.per_core.map((v,i)=>(
                <div key={i} className="flex items-center gap-3">
                  <div className="w-12 text-xs text-gray-600">CPU {i}</div>
                  <div className="flex-1">
                    <div className="bg-gray-100 rounded h-3 overflow-hidden"><div style={{width:`${v}%`}} className="h-3 bg-[#2496ED]"></div></div>
                  </div>
                  <div className="w-12 text-right text-xs font-medium">{Math.round(v)}%</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-4">
            <ChartCard title="CPU trend (30m)" data={cpuTrend} type="line" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <ChartCard title="Memory trend (30m)" data={memTrend} type="area" />
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="text-sm font-medium mb-3">Quick events</div>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="p-2 bg-gray-50 rounded">[11:50] ied-05 high CPU alert</li>
              <li className="p-2 bg-gray-50 rounded">[11:45] ied-03 restarted</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
