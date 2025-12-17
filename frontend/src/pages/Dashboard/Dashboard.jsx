import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import ChartCard from "../../components/ui/ChartCard";
import CircleMetric from "../../components/ui/CircleMetric";
import ContainersTable from "../../components/containers/ContainersTable";
import { API_BASE_URL } from "../../config";
import Spinner from "../../components/ui/Spinner";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const Dashboard = React.memo(() => {
  const [system, setSystem] = useState(null);
  const [containers, setContainers] = useState([]);
  const [events, setEvents] = useState([]);

  const [loadingSystemInfo, setLoadingSystemInfo] = useState(true); // /system
  const [loadingLatestMetrics, setLoadingLatestMetrics] = useState(true); // /system/metrics/latest
  const [loadingHistory, setLoadingHistory] = useState(true); // /system/metrics/history
  const [loadingContainers, setLoadingContainers] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [selectedCores, setSelectedCores] = useState({ systemCpu: true });
  const [selectAllCores, setSelectAllCores] = useState(false);

  const [cpuCoreHistory, setCPUCoreHistory] = useState({});
  const [systemMemoryHistory, setSystemMemoryHistory] = useState([]);
  const [systemCpuHistory, setSystemCpuHistory] = useState([]);

  const [backendStatus, setBackendStatus] = useState("connected");
  const wasDisconnected = useRef(false);

  const systemInfoLoadedOnce = useRef(false);
  const latestLoadedOnce = useRef(false);
  const historyLoadedOnce = useRef(false);

  // Fetch system data
  useEffect(() => {
    let mounted = true;

    const fetchSystem = async () => {
      if (!systemInfoLoadedOnce.current) setLoadingSystemInfo(true);

      try {
        const res = await fetch(`${API_BASE_URL}/system`, { cache: "no-store" });
        if (!mounted) return;

        if (res.ok) {
          if (backendStatus === "disconnected") wasDisconnected.current = true;
          setBackendStatus("connected");

          const data = await res.json();
          if (data) setSystem(data);
        } else {
          setBackendStatus("disconnected");
        }
      } catch (e) {
        if (mounted) setBackendStatus("disconnected");
        console.error("system fetch error:", e);
      } finally {
        if (mounted && !systemInfoLoadedOnce.current) {
          systemInfoLoadedOnce.current = true;
          setLoadingSystemInfo(false);
        }
      }
    };

    const fetchLatest = async () => {
      if (!latestLoadedOnce.current) setLoadingLatestMetrics(true);

      try {
        const res = await fetch(`${API_BASE_URL}/system/metrics/latest`, {
          cache: "no-store",
        });
        if (!mounted) return;

        const latest = res.ok ? await res.json() : null;
        if (latest?.systemCpu?.value != null) {
          setSystem((prev) =>
            prev
              ? { ...prev, cpu: { ...prev.cpu, total_percent: latest.systemCpu.value } }
              : prev
          );
        }
      } catch (e) {
        console.warn("latest metrics fetch error:", e);
      } finally {
        if (mounted && !latestLoadedOnce.current) {
          latestLoadedOnce.current = true;
          setLoadingLatestMetrics(false);
        }
      }
    };

    const fetchHistory = async () => {
      if (!historyLoadedOnce.current) setLoadingHistory(true);

      try {
        const res = await fetch(`${API_BASE_URL}/system/metrics/history`, {
          cache: "no-store",
        });
        if (!mounted) return;

        const history = res.ok ? await res.json() : null;
        if (history) {
          setCPUCoreHistory(history.cpuCoreHistories || {});
          setSystemMemoryHistory(history.memoryHistory || []);
          setSystemCpuHistory(history.systemCpuHistory || []);
        }
      } catch (e) {
        console.error("history fetch error:", e);
      } finally {
        if (mounted && !historyLoadedOnce.current) {
          historyLoadedOnce.current = true;
          setLoadingHistory(false);
        }
      }
    };

    // initial load
    fetchSystem();
    fetchLatest();
    fetchHistory();

    // refresh
    const iv = setInterval(() => {
      fetchSystem();
      fetchLatest();
      fetchHistory();
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(iv);
    };
    // backendStatus included so fetchSystem sees latest value
  }, [backendStatus]);

  // Fetch containers data
  useEffect(() => {
    let mounted = true;

    const fetchContainersData = async () => {
      try {
        const contRes = await fetch(`${API_BASE_URL}/containers?_=${Date.now()}`, {
          cache: "no-store",
        });

        if (!contRes.ok) return;

        const contListData = await contRes.json();
        if (!mounted || !Array.isArray(contListData)) return;

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

            const cpuValue = Number(stats.cpu_percent ?? stats.CPUPercent ?? stats.cpu ?? 0);

            return {
              id: container.id,
              cpu_percent: Number(cpuValue) || 0,
              mem_usage: stats.mem_usage ?? stats.MemoryUsage ?? stats.memory ?? "—",
            };
          } catch (err) {
            console.error(`Stats fetch error for ${container.id}:`, err);
            return null;
          }
        });

        const statsResults = await Promise.all(statsPromises);

        if (mounted) {
          const updated = mapped.map((c) => {
            const stats = statsResults.find((s) => s && s.id === c.id);
            return stats ? { ...c, ...stats } : c;
          });
          setContainers(updated);
        }
      } catch (e) {
        console.error("fetchContainersData error:", e);
      } finally {
        if (mounted) setLoadingContainers(false);
      }
    };

    fetchContainersData();
    const containerInterval = setInterval(fetchContainersData, 5000);

    return () => {
      mounted = false;
      clearInterval(containerInterval);
    };
  }, []);

  // Fetch events data
  useEffect(() => {
    let mounted = true;

    const fetchEventsData = async () => {
      try {
        const evRes = await fetch(`${API_BASE_URL}/events?_=${Date.now()}`, {
          cache: "no-store",
        });

        if (!mounted) return;

        if (evRes.ok) {
          const evData = await evRes.json();
          setEvents(Array.isArray(evData) ? evData : []);
        } else {
          setEvents([]);
        }
      } catch (e) {
        console.error("fetchEventsData error:", e);
      } finally {
        if (mounted) setLoadingEvents(false);
      }
    };

    fetchEventsData();

    return () => {
      mounted = false;
    };
  }, []);

  const cpuTrendSeries = useMemo(() => {
    const hasSelectedCores = Object.keys(selectedCores).some((key) => selectedCores[key]);
    const coreKeys = Object.keys(cpuCoreHistory).filter((coreIdx) => selectedCores[coreIdx]);

    if (!hasSelectedCores) return [];

    let referenceData;
    let startIndex;

    if (selectedCores.systemCpu && systemCpuHistory.length > 0) {
      referenceData = systemCpuHistory;
    } else if (coreKeys.length > 0) {
      referenceData = cpuCoreHistory[coreKeys[0]];
    } else {
      return [];
    }

    const maxLength = Math.min(referenceData.length, 50);
    startIndex = referenceData.length - maxLength;

    return referenceData.slice(startIndex).map((entry, idx) => {
      const point = {
        time: entry.timestamp
          ? new Date(entry.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : `Point ${idx}`,
      };

      if (selectedCores.systemCpu && systemCpuHistory.length > 0) {
        const systemDataIndex = startIndex + idx;
        point["System CPU"] =
          systemDataIndex >= 0 && systemDataIndex < systemCpuHistory.length
            ? systemCpuHistory[systemDataIndex].value
            : 0;
      }

      coreKeys.forEach((coreIdx) => {
        const coreData = cpuCoreHistory[coreIdx];
        const dataIndex = startIndex + idx;

        point[`Core ${coreIdx}`] =
          coreData && dataIndex >= 0 && dataIndex < coreData.length ? coreData[dataIndex].value : 0;
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
        ? new Date(entry.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        : `t-${maxLength - idx - 1}`,
      value: entry.value,
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
      } catch {
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
        alerts.push({
          severity: "critical",
          time: "",
          message: `${name} is ${c.status || "stopped"}`,
        });
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
      [coreIdx]: !prev[coreIdx],
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

  const handleSystemCpuToggle = useCallback(() => {
    setSelectedCores((prev) => ({
      ...prev,
      systemCpu: !prev.systemCpu,
    }));
  }, []);

  return (
    <div className="p-6 space-y-6">
      {backendStatus === "disconnected" && (
        <div className="rounded-lg px-4 py-3 text-sm font-medium bg-red-50 text-red-700 border border-red-200">
          Backend disconnected. Trying to reconnect…
        </div>
      )}

      {backendStatus === "connected" && wasDisconnected.current && (
        <div className="rounded-lg px-4 py-3 text-sm font-medium bg-green-50 text-green-700 border border-green-200">
          Backend reconnected successfully
        </div>
      )}

      {/* TOP CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Load card */}
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="text-xs text-gray-500 flex items-center gap-2">
            Load (1/5/15)
            {(loadingSystemInfo || !system) && <Spinner className="h-3 w-3 text-gray-400" />}
          </div>

          {loadingSystemInfo || !system ? (
            <div className="mt-2 h-6 w-40 bg-gray-200 rounded animate-pulse" />
          ) : (
            <>
              <div className="text-lg font-semibold">
                {system.load.map((l) => (typeof l === "number" ? l.toFixed(2) : l)).join(" / ")}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Processes: {system.total_processes} Running: {system.running}
              </div>
            </>
          )}
        </div>

        {/* CPU card */}
        <div className="bg-white rounded-xl p-4 shadow flex items-center justify-center">
          {loadingLatestMetrics || !system ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Spinner className="h-4 w-4 text-gray-400" />
              Loading CPU…
            </div>
          ) : (
            <CircleMetric value={Math.round(system.cpu.total_percent || 0)} label="System CPU" />
          )}
        </div>

        {/* Memory card */}
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="text-xs text-gray-500 flex items-center gap-2">
            Memory
            {(loadingSystemInfo || !system) && <Spinner className="h-3 w-3 text-gray-400" />}
          </div>

          {loadingSystemInfo || !system ? (
            <>
              <div className="mt-2 h-4 w-12 bg-gray-200 rounded animate-pulse" />
              <div className="mt-3 h-2 w-full bg-gray-200 rounded animate-pulse" />
            </>
          ) : (
            <>
              <div className="mt-2 text-sm font-semibold">{memPct}%</div>
              <div className="mt-3">
                <div className="bg-gray-200 h-2 rounded overflow-hidden">
                  <div className="h-2 bg-[#2496ED]" style={{ width: `${memPct}%` }} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Uptime card */}
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="text-xs text-gray-500 flex items-center gap-2">
            Uptime
            {(loadingSystemInfo || !system) && <Spinner className="h-3 w-3 text-gray-400" />}
          </div>

          {loadingSystemInfo || !system ? (
            <div className="mt-2 h-6 w-28 bg-gray-200 rounded animate-pulse" />
          ) : (
            <>
              <div className="mt-2 text-lg font-semibold">{system.uptime}</div>
              <div className="text-xs text-gray-400 mt-1">Host</div>
            </>
          )}
        </div>
      </div>

      {/* CPU ACTIVITY (PER CORE) + TREND */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Per-core list */}
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="text-sm font-medium mb-3 flex items-center gap-2">
            CPU Activity (per core)
            {(loadingSystemInfo || !system) && <Spinner className="h-3 w-3 text-gray-400" />}
          </div>

          {loadingSystemInfo || !system ? (
            <div className="h-32 bg-gray-200 rounded animate-pulse" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectAllCores}
                  onChange={handleSelectAll}
                  className="w-4 h-4 cursor-pointer"
                />
                <div className="w-12 text-xs text-gray-600">All Cores</div>
                <div className="flex-1" />
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

              {system?.cpu?.per_core?.length ? (
                system.cpu.per_core.map((v, i) => {
                  const displayValue =
                    cpuCoreHistory?.[i]?.length > 0
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
                          <div
                            className="h-3 bg-[#2496ED]"
                            style={{ width: `${Math.max(displayValue, 0.5)}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-12 text-right text-xs font-medium">
                        {Math.round(displayValue)}%
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-gray-500">No per-core data.</div>
              )}
            </div>
          )}
        </div>

        {/* Trend chart */}
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium flex items-center gap-2">
              CPU trend (selected cores)
              {loadingHistory && <Spinner className="h-3 w-3 text-gray-400" />}
            </div>
            <div className="text-xs text-gray-500">
              Selected: {Object.values(selectedCores).filter(Boolean).length} items
            </div>
          </div>

          {loadingHistory ? (
            <div className="h-40 bg-gray-200 rounded animate-pulse" />
          ) : (
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

                  {(system?.cpu?.per_core || []).map((_, coreIdx) =>
                    selectedCores[coreIdx] ? (
                      <Line
                        key={coreIdx}
                        type="monotone"
                        dataKey={`Core ${coreIdx}`}
                        stroke={
                          ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"][
                            coreIdx % 6
                          ]
                        }
                        dot={false}
                        strokeWidth={2}
                      />
                    ) : null
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Memory trend + alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memory trend */}
        <div>
          {loadingHistory ? (
            <div className="bg-white rounded-2xl shadow-sm p-4 h-full">
              <div className="text-sm font-medium mb-3 flex items-center gap-2">
                System Memory trend
                <Spinner className="h-3 w-3 text-gray-400" />
              </div>
              <div className="h-40 bg-gray-200 rounded animate-pulse" />
            </div>
          ) : (
            <ChartCard title="System Memory trend" data={memoryTrendSeries} type="area" />
          )}
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="text-sm font-medium mb-3 flex items-center gap-2">
            Alerts & Recent Events
            {loadingEvents && <Spinner className="h-3 w-3 text-gray-400" />}
          </div>

          {loadingEvents ? (
            <div className="h-40 bg-gray-200 rounded animate-pulse" />
          ) : (
            <div className="space-y-2 text-sm text-gray-700 max-h-80 overflow-y-auto">
              {derivedAlerts.length === 0 ? (
                <div className="text-xs text-gray-400">No alerts or events</div>
              ) : (
                derivedAlerts.map((a, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded flex items-start gap-3 ${
                      a.severity === "critical"
                        ? "bg-red-50"
                        : a.severity === "warning"
                        ? "bg-yellow-50"
                        : "bg-gray-50"
                    }`}
                  >
                    <div
                      className={`w-2 h-6 rounded ${
                        a.severity === "critical"
                          ? "bg-red-500"
                          : a.severity === "warning"
                          ? "bg-yellow-400"
                          : "bg-gray-400"
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
          )}
        </div>
      </div>

      {/* Containers */}
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="text-sm font-medium mb-3 flex items-center gap-2">
          Containers
          {loadingContainers && <Spinner className="h-3 w-3 text-gray-400" />}
        </div>

        {loadingContainers ? (
          <div className="text-sm text-gray-500 flex items-center gap-2">
            <Spinner className="h-4 w-4 text-gray-400" />
            Loading…
          </div>
        ) : containers.length === 0 ? (
          <div className="text-sm text-gray-500">No containers found.</div>
        ) : (
          <ContainersTable containers={containers} />
        )}
      </div>
    </div>
  );
});

export default Dashboard;
