import React, { useCallback, useEffect, useMemo, useState ,useRef} from "react";
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
  const [selectedCores, setSelectedCores] = useState({ systemCpu: true }); 
  const [selectAllCores, setSelectAllCores] = useState(false);
  const [cpuCoreHistory, setCPUCoreHistory] = useState({});
  const [systemMemoryHistory, setSystemMemoryHistory] = useState([]);
  const [systemCpuHistory, setSystemCpuHistory] = useState([]); 
  const [backendStatus, setBackendStatus] = useState("connected");
  const hideBannerTimeout = useRef(null);


  // SINGLE UNIFIED POLLing effect for system, containers, stats, events
  useEffect(() => {
    let mounted = true;

    const pollAllData = async () => {
      try {
        const [
          sysRes,
          historyRes,
          contRes,
          latestSysRes,
          evRes
        ] = await Promise.all([
          fetch(`${API_BASE_URL}/system`),
          fetch(`${API_BASE_URL}/system/metrics/history`),
          fetch(`${API_BASE_URL}/containers?_=${Date.now()}`, { cache: "no-store" }),
          fetch(`${API_BASE_URL}/system/metrics/latest`),
          fetch(`${API_BASE_URL}/events?_=${Date.now()}`, { cache: "no-store" })
        ]);

        if (!sysRes.ok) throw new Error("System API failed");
        const sysData = await sysRes.json();
       if (mounted) {
       setSystem(sysData);
  
      setBackendStatus((prev) => {
      if (prev === "disconnected") return "reconnected";
      return prev;
      });

}

        if (sysData) {
          try {
            const latestSysData = latestSysRes.ok ? await latestSysRes.json() : null;
            
            if (latestSysData && latestSysData.systemCpu) {
              sysData.cpu = {
                ...sysData.cpu,
                total_percent: latestSysData.systemCpu.value
              };
            }
          } catch (e) {
            console.warn("Failed to fetch latest system metrics:", e);
          }
          
          if (mounted) setSystem(sysData);
        }
        const historyData = historyRes.ok ? await historyRes.json() : null;
        if (historyData) {
          if (mounted) {
            setCPUCoreHistory(historyData.cpuCoreHistories || {});
            setSystemMemoryHistory(historyData.memoryHistory || []);
            setSystemCpuHistory(historyData.systemCpuHistory || []); // Set system CPU history
          }
        }

        if (contRes.ok) {
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

          const statsPromises = mapped.map(async (container) => {
            try {
              const res = await fetch(`${API_BASE_URL}/containers/${container.id}/stats`);
              const stats = res.ok ? await res.json() : null;
              
              if (!stats) return null;
              
              // CPU value comes as decimal multiply by 100 to get percentage
              const rawCpu = Number(stats.cpu_percent ?? stats.CPUPercent ?? stats.cpu ?? 0);
              const cpuValue = rawCpu < 10 ? rawCpu * 100 : rawCpu;
              
              const result = {
                id: container.id,
                cpu_percent: Number(cpuValue) || 0,
                mem_usage: stats.mem_usage ?? stats.MemoryUsage ?? stats.memory ?? "—",
              };
              
              return result;
            } catch (err) {
              console.error(`Stats fetch error for ${container.id}:`, err);
              return null;
            }
          });

          const statsResults = await Promise.all(statsPromises);

          // Update all containers at once with stats
          if (mounted) {
            const updated = mapped.map((c) => {
              const stats = statsResults.find((s) => s && s.id === c.id);
              return stats ? { ...c, ...stats } : c;
            });
            setContainers(updated);
          }
        }

        if (evRes.ok) {
          const evData = await evRes.json();
          if (mounted) setEvents(Array.isArray(evData) ? evData : []);
        } else {
          // 404 or other error / clear events
          if (mounted) setEvents([]);
        }
      } catch (e) {
      console.error("pollAllData error:", e);
       if (mounted) {
       setBackendStatus("disconnected");
       }
     }
     finally {
        if (mounted) setLoadingSys(false);
         
      }
    };

    pollAllData();
    const iv = setInterval(pollAllData, 5000); 

    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  useEffect(() => {
  if (backendStatus === "reconnected") {
    if (hideBannerTimeout.current) {
      clearTimeout(hideBannerTimeout.current);
    }

    hideBannerTimeout.current = setTimeout(() => {
      setBackendStatus("connected");
    }, 2000);
  }

  return () => {
    if (hideBannerTimeout.current) {
      clearTimeout(hideBannerTimeout.current);
    }
  };
}, [backendStatus]);


  // CPU TREND FROM RING BUFFER
  const cpuTrendSeries = useMemo(() => {
    const hasSelectedCores = Object.keys(selectedCores).some(key => selectedCores[key]);
    const coreKeys = Object.keys(cpuCoreHistory).filter(coreIdx => selectedCores[coreIdx]);
    
    if (!hasSelectedCores) return [];
    
    let referenceData, startIndex;
    if (selectedCores.systemCpu && systemCpuHistory.length > 0) {
      referenceData = systemCpuHistory;
    } else if (coreKeys.length > 0) {
      const refCore = coreKeys[0];
      referenceData = cpuCoreHistory[refCore];
    } else {
      return [];
    }
    
    const maxLength = Math.min(referenceData.length, 50);
    startIndex = referenceData.length - maxLength;
    
    return referenceData.slice(startIndex).map((entry, idx) => {
      const point = { 
        time: entry.timestamp 
          ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
          : `Point ${idx}`
      };
      
      if (selectedCores.systemCpu && systemCpuHistory.length > 0) {
        const systemDataIndex = startIndex + idx;
        if (systemDataIndex >= 0 && systemDataIndex < systemCpuHistory.length) {
          point['System CPU'] = systemCpuHistory[systemDataIndex].value;
        } else {
          point['System CPU'] = 0;
        }
      }
      
      coreKeys.forEach(coreIdx => {
        const coreData = cpuCoreHistory[coreIdx];
        const dataIndex = startIndex + idx;
        
        if (dataIndex >= 0 && dataIndex < coreData.length) {
          point[`Core ${coreIdx}`] = coreData[dataIndex].value;
        } else {
          point[`Core ${coreIdx}`] = 0;
        }
      });
      
      return point;
    });
  }, [selectedCores, cpuCoreHistory, systemCpuHistory]);

  const memPct = useMemo(() => {
    if (!system) return 0;
    const used = system.memory?.used_bytes || 0;
    const limit = system.memory?.limit_bytes || 0;
    if (!limit) return 0;
    return Math.round((used / limit) * 100);
  }, [system]);

  const memoryTrendSeries = useMemo(() => {
    if (!systemMemoryHistory || systemMemoryHistory.length === 0) return [];
    
    const maxLength = Math.min(systemMemoryHistory.length, 50);
    const startIndex = systemMemoryHistory.length - maxLength;
    
    return systemMemoryHistory.slice(startIndex).map((entry, idx) => ({
      time: entry.timestamp 
        ? new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
        : `t-${maxLength - idx - 1}`,
      value: entry.value
    }));
  }, [systemMemoryHistory]);

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
  
  const handleSystemCpuToggle = useCallback(() => {
    setSelectedCores((prev) => ({
      ...prev,
      systemCpu: !prev.systemCpu
    }));
  }, []);
  
  const handleSelectAll = useCallback(() => {
    const newSelectAll = !selectAllCores;
    setSelectAllCores(newSelectAll);
    
    const newSelectedCores = { systemCpu: true };
    if (system?.cpu?.per_core) {
      system.cpu.per_core.forEach((_, i) => {
        newSelectedCores[i] = newSelectAll;
      });
    }
    setSelectedCores(newSelectedCores);
  }, [selectAllCores, system?.cpu?.per_core]);

  if (loadingSys) {
  return (
    <div className="p-6 flex items-center justify-center min-h-screen bg-linear-to-br from-blue-50 to-indigo-100">
      <div className="flex flex-col items-center gap-6 bg-white p-8 rounded-2xl shadow-lg">
        <div className="relative">
          <img 
          src="/hitachi_logo_icon_168125.svg" 
          alt="Hitachi Logo" 
          className="text-6xl text-gray-600 animate-pulse" />
          <div className="absolute inset-0 w-8 h-8 border-4 border-gray-600 border-t-transparent rounded-full animate-spin mx-auto mt-2"></div>
        </div>
        <div className="text-lg font-semibold text-gray-700">Loading dashboard…</div>
        <div className="text-sm text-gray-500">Fetching system data</div>
        </div>
      </div>
    );
  }

  const load = system?.load || [0, 0, 0];
  const uptime = system?.uptime || "N/A";
  const totalProcesses = system?.total_processes ?? 0;
  const running = system?.running ?? 0;
  const cpuPerCore = system?.cpu?.per_core || [];
  const systemCpu = system?.cpu?.total_percent || 0;
  
  return (
    <div className="p-6 space-y-6">
      {backendStatus !== "connected" && (
  <div className="sticky top-0 z-50">
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-sm mb-4 border ${
        backendStatus === "disconnected"
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-green-50 border-green-200 text-green-700"
      }`}
    >
      <div
        className={`w-2 h-8 rounded-full ${
          backendStatus === "disconnected"
            ? "bg-red-500"
            : "bg-green-500"
        }`}
      />
      <div className="flex-1">
        <div className="text-sm font-semibold">
          {backendStatus === "disconnected"
            ? "Backend disconnected"
            : "Backend reconnected"}
        </div>
        <div className="text-xs">
          {backendStatus === "disconnected"
            ? "Unable to reach server. Showing last known data."
            : "Connection restored. Live data resumed."}
        </div>
      </div>
    </div>
  </div>
)}

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
          <CircleMetric value={Math.round(systemCpu || 0)} label="System CPU" />
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
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectAllCores}
                onChange={handleSelectAll}
                className="w-4 h-4 cursor-pointer"
              />
              <div className="w-12 text-xs text-gray-600">All Cores</div>
              <div className="flex-1"></div>
            </div>
            
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={!!selectedCores.systemCpu}
                onChange={handleSystemCpuToggle}
                className="w-4 h-4 cursor-pointer"
              />
              <div className="text-xs text-gray-600">System CPU</div>
            </div>
            
            {cpuPerCore.length ? (
              cpuPerCore.map((v, i) => {
                const displayValue = cpuCoreHistory && cpuCoreHistory[i] && cpuCoreHistory[i].length > 0 
                  ? cpuCoreHistory[i][cpuCoreHistory[i].length - 1].value 
                  : v;
                return (
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
                        <div className="h-3 bg-[#2496ED]" style={{ width: `${Math.max(displayValue, 0.5)}%` }} />
                      </div>
                    </div>
                    <div className="w-12 text-right text-xs font-medium">{Math.round(displayValue)}%</div>
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-gray-500">No per-core data.</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">CPU trend (selected cores)</div>
            <div className="text-xs text-gray-500">Selected: {Object.values(selectedCores).filter(Boolean).length} items</div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cpuTrendSeries}>
                <XAxis dataKey="time" stroke="#888" />
                <YAxis stroke="#888" domain={[0, 100]} />
                <Tooltip formatter={(value, name) => [`${Math.round(value)}%`, name]} />
                <Legend />
                {selectedCores.systemCpu && (
                  <Line
                    type="monotone"
                    dataKey="System CPU"
                    stroke="#ff6b6b"
                    dot={false}
                    strokeWidth={2}
                  />
                )}
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
            title="System Memory trend"
            data={memoryTrendSeries}
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