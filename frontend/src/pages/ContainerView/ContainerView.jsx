import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useParams, useLocation } from "react-router-dom";
import { FaDocker, FaChevronUp, FaChevronDown } from "react-icons/fa";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { containerCache } from "../../utils/cache";

const WINDOW_SIZE = 60;

export default function ContainerView() {
  const { id } = useParams();
  const location = useLocation();
  const containerName = location.state?.name || "";
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [isStopping, setIsStopping] = useState(false);
  const [cpuHistory, setCpuHistory] = useState([]);
  
  const TOAST_ID = "status-error-container-view";
  
  const [fixedCpuWindowData, setFixedCpuWindowData] = useState(
    Array(WINDOW_SIZE).fill().map((_, index) => ({
      index: index,
      time: null,
      value: 0
    }))
  );
  
  const [cpuCurrentPosition, setCpuCurrentPosition] = useState(0);
  
  useEffect(() => {
    if (!cpuHistory || cpuHistory.length === 0) {
      setFixedCpuWindowData(
        Array(WINDOW_SIZE).fill().map((_, index) => ({
          index: index,
          time: null,
          value: 0
        }))
      );
      setCpuCurrentPosition(0);
      return;
    }
    
    const availablePoints = cpuHistory.length;
    const pointsToUse = Math.min(availablePoints, WINDOW_SIZE);
    
    const windowData = Array(WINDOW_SIZE).fill().map((_, index) => ({
      index: index,
      time: null,
      value: 0
    }));
    
    for (let i = 0; i < pointsToUse; i++) {
      const dataIndex = availablePoints - pointsToUse + i;
      if (dataIndex < cpuHistory.length) {
        const point = cpuHistory[dataIndex];
        windowData[i].value = point?.value || 0;
        windowData[i].time = point?.time || null;
      }
    }
    
    setFixedCpuWindowData(windowData);
    setCpuCurrentPosition(pointsToUse);
  }, [cpuHistory]);
  const [filePathInput, setFilePathInput] = useState("");
  const [fileTabs, setFileTabs] = useState([]);
  const [logs, setLogs] = useState([]); // array of { msg: string, seenAt: number }
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const statsIntervalRef = useRef(null);
  const logsIntervalRef = useRef(null);
  const logsBoxRef = useRef(null);
  const [activeTab, setActiveTab] = useState("details"); //Which top-level tab is active: "details" | "logs" | "files" | "file:/path/to/file"
  const [processes, setProcesses] = useState([]);
  const [processesLoading, setProcessesLoading] = useState(false);
  const [processesError, setProcessesError] = useState("");
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [fsPath, setFsPath] = useState("/"); // Current directory path being shown in the Files tab
  const [fsEntries, setFsEntries] = useState([]); // Directory listing (files + folders) for the current fsPath
  const [fsLoading, setFsLoading] = useState(false); // Loading flag while fetching a directory listing
  const [fsError, setFsError] = useState(""); // Error message when failing to fetch a directory listing
  const fsCacheRef = useRef(new Map()); // Cache of directory listings by path to reduce repeat API calls

  const cpuTrendMax = useMemo(() => {
    if (!cpuHistory.length) return 100;

    const max = cpuHistory.reduce((m, p) => {
      const n = Number(p.value);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);

    const padded = max + Math.max(2, max * 0.03);
    return Math.min(100, Math.ceil(padded));
  }, [cpuHistory]);

  function formatUptime(startedAt) {
    if (!startedAt) return "N/A";

    const start = new Date(startedAt).getTime();
    const now = Date.now();

    if (isNaN(start) || now < start) return "N/A";

    let seconds = Math.floor((now - start) / 1000);

    const days = Math.floor(seconds / 86400);
    seconds %= 86400;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds %= 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  function formatCPUtime(timeStr) {
    //cpu time is the time a process has been actively using the cpu since it started
    if (!timeStr || timeStr == "--") return "--";

    const parts = timeStr.split(/[-:]/);

    try {
      if (parts.length === 2) {
        const [min, sec] = parts.map(Number);
        if (min === 0) return `${sec}s`;
        return `${min}m ${sec}s`;
      } else if (parts.length === 3) {
        const [hrs, min, sec] = parts.map(Number);
        if (hrs === 0) {
          if (min === 0) return `${sec}s`;
          return `${min}m ${sec}s`;
        }
        return `${hrs}h ${min}m ${sec}s`;
      } else if (parts.length === 4) {
        const [days, hrs, min, sec] = parts.map(Number);
        if (days === 0) {
          if (hrs === 0) {
            if (min === 0) return `${sec}s`;
            return `${min}m ${sec}s`;
          }
          return `${hrs}h ${min}m ${sec}s`;
        }
        return `${days}d ${hrs}h ${min}m`;
      }
      return timeStr;
    } catch {
      return timeStr;
    }
  }

  const stampLogs = (prevStamped, nextRaw) => {
    const pool = new Map();
    for (const item of prevStamped) {
      const arr = pool.get(item.msg) || [];
      arr.push(item.seenAt);
      pool.set(item.msg, arr);
    }
    const now = Date.now();
    return (nextRaw || []).map((msg, i) => {
      const arr = pool.get(msg);
      const reused = arr && arr.length ? arr.shift() : null;
      if (arr && arr.length === 0) pool.delete(msg);
      return { msg, seenAt: reused ?? now + i };
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Files tab: fetch and display the directory listing for `path` (uses an in-memory cache to avoid repeat API calls)
  const fetchDir = async (path) => {
    setFsPath(path);
    setFsError("");

    const cached = fsCacheRef.current.get(path);
    if (cached) {
      setFsEntries(cached);
      return;
    }

    try {
      setFsLoading(true);
      const res = await fetch(
        `/api/containers/${id}/fs?path=${encodeURIComponent(path)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to list directory");

      const entries = Array.isArray(data.entries) ? data.entries : [];
      fsCacheRef.current.set(path, entries);
      setFsEntries(entries);
    } catch (e) {
      setFsError(e.message);
      setFsEntries([]);
    } finally {
      setFsLoading(false);
    }
  };

  // Opens a file inside the container by path and displays it in a new or existing file tab
  const openFilePath = async () => {
    const path = filePathInput.trim();
    if (!path) return;

    const name = path.split("/").filter(Boolean).pop() || path; // tab label
    const key = `file:${path}`;

    // Create tab if it doesn't exist
    setFileTabs((prev) => {
      if (prev.some((t) => t.key === key)) return prev;
      return [
        ...prev,
        {
          key,
          name,
          path,
          content: "",
          loading: true,
          error: "",
          truncated: false,
        },
      ];
    });

    // Switch to it
    setActiveTab(key);

    try {
      const res = await fetch(
        `/api/containers/${id}/file?path=${encodeURIComponent(path)}`
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data?.message || "Failed to open file");

      setFileTabs((prev) =>
        prev.map((t) =>
          t.key === key
            ? {
                ...t,
                content: data.content ?? "",
                truncated: !!data.truncated,
                loading: false,
                error: "",
              }
            : t
        )
      );
    } catch (e) {
      setFileTabs((prev) =>
        prev.map((t) =>
          t.key === key ? { ...t, loading: false, error: e.message } : t
        )
      );
    }
  };

  // --------- STOP A CONTAINER ----------
  const stopContainer = async () => {
    setIsStopping(true);

    try {
      const response = await fetch(`/api/containers/${id}/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();

      if (response.ok) {
        setStats((prevStats) => ({
          ...prevStats,
          status: "exited",
          cpu_percent: 0,
        }));
        setProcesses([]);
      } else {
        toast.error(data.message || "Failed to stop container.", {
          toastId: TOAST_ID,
          autoClose: 3000,
        });
      }
    } catch (error) {
      console.error("Error stopping container:", error);
      toast.error("An error occurred while stopping the container.", {
        toastId: TOAST_ID,
        autoClose: 3000,
      });
    } finally {
      setIsStopping(false);
    }
  };

  // --------- FETCH STATS----------
  useEffect(() => {
    const POLL_MS = 5000;
    const controller = new AbortController();

    const fetchStats = async () => {
      const statsCacheKey = `container_stats_${id}`;
      const cachedStats = containerCache.get(statsCacheKey);

      if (cachedStats) {
        setStatsError("");
        setStats(cachedStats);
        setStatsLoading(false);
      }

      try {
        const res = await fetch(`/api/containers/${id}/stats`, {
          signal: controller.signal,
        });

        let payload = {};
        try {
          payload = await res.json();
        } catch {
          payload = {};
        }

        if (res.status === 410) {
          if (!toast.isActive(TOAST_ID)) {
            toast.error(
              payload?.message ?? "Container has been removed from environment",
              { toastId: TOAST_ID, autoClose: 5000 }
            );
          }

          setStats(payload);
          setStatsError("Container deleted or removed.");
          setStatsLoading(false);

          if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
          statsIntervalRef.current = null;
          return;
        }

        if (!res.ok) {
          const message = payload.message || "Failed to fetch container stats";

          if (!toast.isActive(TOAST_ID)) {
            toast.error(message, { toastId: TOAST_ID, autoClose: 5000 });
          }

          setStatsError("No data from Docker — metrics unavailable.");
          setStatsLoading(false);
          setStats(payload);
          return;
        }

        containerCache.set(statsCacheKey, payload);
        setStatsError("");
        setStats(payload);
        setStatsLoading(false);

        const cpu = Number(payload?.cpu_percent ?? 0);
        const point = { time: new Date().toLocaleTimeString(), value: cpu };
        
        setCpuHistory((prev) => [...prev, point].slice(-30));
        
        setFixedCpuWindowData(prevWindow => {
          const newData = [...prevWindow];
          const insertIndex = cpuCurrentPosition % WINDOW_SIZE;
          newData[insertIndex] = {
            index: insertIndex,
            time: point.time,
            value: point.value
          };
          return newData;
        });
        
        setCpuCurrentPosition(prev => prev + 1);
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error(err);
        setStatsError("Could not load container stats.");
        setStatsLoading(false);
      }
    };

    fetchStats();
    statsIntervalRef.current = setInterval(fetchStats, POLL_MS);

    return () => {
      controller.abort();
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    };
  }, [id]);

  // --------- FETCH STORED METRICS (fetch once; don't overwrite live history) ----------
  useEffect(() => {
    const fetchHistoricalMetrics = () => {
      const historyCacheKey = `container_history_${id}`;
      const cachedHistory = containerCache.get(historyCacheKey);

      if (cachedHistory) {
        const cpuHistoryData = (cachedHistory.cpuHistory || []).map((item) => ({
          time: new Date(item.timestamp).toLocaleTimeString(),
          value: Number(item.value ?? 0),
        }));
        setCpuHistory((prev) => (prev.length ? prev : cpuHistoryData));
        return;
      }

      fetch(`/api/containers/${id}/metrics/history`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch stored metrics");
          return res.json();
        })
        .then((data) => {
          containerCache.set(historyCacheKey, data);

          const cpuHistoryData = (data.cpuHistory || []).map((item) => ({
            time: new Date(item.timestamp).toLocaleTimeString(),
            value: Number(item.value ?? 0),
          }));
          setCpuHistory((prev) => (prev.length ? prev : cpuHistoryData));
        })
        .catch((err) => {
          console.error("Failed to fetch stored metrics:", err);
        });
    };

    fetchHistoricalMetrics();
  }, [id]);

  // --------- FETCH LOGS WHEN TAB = "logs" (poll while active) ----------
  useEffect(() => {
    if (activeTab !== "logs") {
      if (logsIntervalRef.current) clearInterval(logsIntervalRef.current);
      logsIntervalRef.current = null;
      return;
    }

    const logsCacheKey = `container_logs_${id}`;
    const cachedLogs = containerCache.get(logsCacheKey);

    if (cachedLogs) {
      const raw = Array.isArray(cachedLogs) ? cachedLogs : [];
      setLogsLoading(false);
      setLogsError("");
      setLogs((prev) => stampLogs(prev, raw));
    }

    const POLL_MS = 3000;
    const controller = new AbortController();

    const fetchLogs = async () => {
      try {
        setLogsLoading(true);
        setLogsError("");

        const res = await fetch(`/api/containers/${id}/logs`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to fetch logs");
        const data = await res.json();

        containerCache.set(logsCacheKey, data.logs);

        const raw = Array.isArray(data.logs) ? data.logs : [];
        setLogs((prev) => stampLogs(prev, raw));

        setLogsLoading(false);
        setLogsError("");

        requestAnimationFrame(() => {
          if (logsBoxRef.current) {
            logsBoxRef.current.scrollTop = logsBoxRef.current.scrollHeight;
          }
        });
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error(err);
        setLogsError("Could not load logs.");
        setLogsLoading(false);
      }
    };

    fetchLogs();
    logsIntervalRef.current = setInterval(fetchLogs, POLL_MS);

    return () => {
      controller.abort();
      if (logsIntervalRef.current) clearInterval(logsIntervalRef.current);
      logsIntervalRef.current = null;
    };
  }, [activeTab, id]);

  // --------- FETCH PROCESSES ----------
  useEffect(() => {
    if (activeTab !== "details") return;

    const fetchProcesses = () => {
      setProcessesLoading(true);
      setProcessesError("");

      fetch(`/api/containers/${id}/processes`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch processes");
          return res.json();
        })
        .then((data) => {
          setProcessesLoading(false);
          setProcessesError("");
          setProcesses(Array.isArray(data.processes) ? data.processes : []);
        })
        .catch((err) => {
          console.error(err);
          setProcessesError("Could not load processes.");
          setProcessesLoading(false);
          setProcesses([]);
        });
    };

    // Initial fetch
    fetchProcesses();

    // Poll every 5 seconds
    const intervalId = setInterval(fetchProcesses, 10000);

    return () => clearInterval(intervalId);
  }, [activeTab, id]);

  useEffect(() => {
    if (activeTab === "files") {
      fetchDir(fsPath || "/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id]);

  useEffect(() => {
    fsCacheRef.current.clear();
    setFsPath("/");
    setFsEntries([]);
    setFsError("");
  }, [id]);

  const memPercent = (() => {
    if (!stats || !stats.mem_usage_bytes || !stats.mem_limit_bytes) return 0;
    if (stats.mem_limit_bytes === 0) return 0;
    return Math.min(100, (stats.mem_usage_bytes / stats.mem_limit_bytes) * 100);
  })();

  const memUsedMB = stats?.mem_usage_bytes
    ? stats.mem_usage_bytes / (1024 * 1024)
    : 0;
  const memTotalMB = stats?.mem_limit_bytes
    ? stats.mem_limit_bytes / (1024 * 1024)
    : 0;

  const statusLabel = stats ? formatStatus(stats.status) : "Unknown";
  const isRunning = statusLabel === "Running";

  if (statsLoading && !stats) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen bg-linear-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center gap-6 bg-white p-8 rounded-2xl shadow-lg">
          <div className="relative">
            <FaDocker className="text-6xl text-blue-600 animate-pulse" />
            <div className="absolute inset-0 w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mt-2"></div>
          </div>
          <div className="text-lg font-semibold text-gray-700">
            Loading container data…
          </div>
          <div className="text-sm text-gray-500">Fetching latest data</div>
        </div>
      </div>
    );
  }

  if (statsError && !stats) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen w-full">
        <p className="text-red-500 text-sm">{statsError}</p>
      </div>
    );
  }

  const cpuValue = stats?.cpu_percent ?? 0;

  return (
    <div className="p-8 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-gray-500 text-sm">Container</p>
          <h1 className="text-3xl font-bold">
            Container {containerName || id}
          </h1>

          <div className="flex gap-4 mt-1 items-center">
            <span
              className={`px-3 py-1 rounded-lg text-sm ${
                statusLabel === "Running"
                  ? "bg-green-100 text-green-700"
                  : statusLabel === "Stopped"
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              {statusLabel}
            </span>
            {/*uptime */}
            <span className="text-gray-500 text-sm">
              Uptime:{" "}
              {stats?.started_at
                ? formatUptime(stats.started_at)
                : stats?.uptime ?? "N/A"}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={stopContainer}
            disabled={!isRunning || isStopping}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
              isRunning && !isStopping
                ? "bg-red-500 text-white hover:bg-red-600 shadow-sm hover:shadow-md active:scale-95"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isStopping ? "Stopping..." : "Stop Container"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b mb-6 overflow-x-auto">
        <button
          className={`pb-2 ${
            activeTab === "details"
              ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
              : "text-gray-600"
          }`}
          onClick={() => setActiveTab("details")}
        >
          Details
        </button>

        <button
          className={`pb-2 ${
            activeTab === "logs"
              ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
              : "text-gray-600"
          }`}
          onClick={() => setActiveTab("logs")}
        >
          Logs
        </button>

        <button
          className={`pb-2 ${
            activeTab === "files"
              ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
              : "text-gray-600"
          }`}
          onClick={() => setActiveTab("files")}
        >
          Files
        </button>

        {fileTabs.map((t) => (
          <button
            key={t.key}
            className={`pb-2 whitespace-nowrap ${
              activeTab === t.key
                ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
                : "text-gray-600"
            }`}
            onClick={() => setActiveTab(t.key)}
            title={t.path}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* DETAILS TAB */}
      {activeTab === "details" && (
        <>
          {/* Metrics Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* CPU card */}
            <div className="bg-white shadow rounded-xl p-6 flex items-center justify-center">
              <div className="text-center">
                <div className="relative w-24 h-24 mx-auto mb-3">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="50%"
                      cy="50%"
                      r="40%"
                      stroke="#e5e7eb"
                      strokeWidth="10"
                      fill="none"
                    />
                    <circle
                      cx="50%"
                      cy="50%"
                      r="40%"
                      stroke="#3b82f6"
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray={`${cpuValue * 2.5} 1000`}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <p className="text-xl font-bold">{cpuValue.toFixed(1)}%</p>
                <p className="text-gray-500 text-sm">CPU</p>
              </div>
            </div>

            {/* Memory card */}
            <div className="bg-white shadow rounded-xl p-6">
              <p className="font-semibold text-gray-700 mb-2">Memory</p>
              <p className="text-xl font-bold mb-2">{memPercent.toFixed(1)}%</p>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-green-500"
                  style={{ width: `${memPercent}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {memUsedMB.toFixed(1)} MB / {memTotalMB.toFixed(1)} MB
              </p>
            </div>

            {/* CPU Trend */}
            <div className="bg-white shadow rounded-xl p-6">
              <p className="font-semibold text-gray-700 mb-3">
                Quick CPU trend
              </p>
              <div className="w-full h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fixedCpuWindowData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="index" 
                      stroke="#888" 
                      tick={{ fontSize: 10 }}
                      tickFormatter={(index) => {
                        const dataPoint = fixedCpuWindowData[index];
                        if (dataPoint && dataPoint.time && dataPoint.time !== "Invalid Date" && dataPoint.time !== "-0m") {
                          return dataPoint.time;
                        }
                        return '';
                      }}
                      axisLine={true}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      stroke="#888"
                      domain={[0, cpuTrendMax]}
                      tick={{ fontSize: 12 }}
                      width={30}
                      tickFormatter={(value) => `${Number(value).toFixed(1)}%`}
                    />
                    <Tooltip 
                      formatter={(value) => [`${Number(value).toFixed(1)}%`, 'CPU']}
                      labelFormatter={(index) => {
                        const dataPoint = fixedCpuWindowData[index];
                        if (dataPoint && dataPoint.time && dataPoint.time !== "Invalid Date" && dataPoint.time !== "-0m") {
                          return `Time: ${dataPoint.time}`;
                        }
                        return '';
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name="CPU Usage"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Processes Table */}
          <div className="bg-white shadow rounded-xl p-6">
            <p className="font-semibold mb-4 text-gray-700">Processes</p>

            {processesError && (
              <p className="text-red-500 text-sm mb-3">{processesError}</p>
            )}

            {processesLoading && processes.length === 0 ? (
              <p className="text-gray-500 text-sm">Loading processes…</p>
            ) : (
              (() => {
                const sortedProcesses = [...processes].sort((a, b) => {
                  if (!sortField) return 0;
                  const valA = a[sortField];
                  const valB = b[sortField];
                  if (typeof valA === "string" && typeof valB === "string") {
                    return sortOrder === "asc"
                      ? valA.localeCompare(valB)
                      : valB.localeCompare(valA);
                  }
                  return sortOrder === "asc"
                    ? valA > valB
                      ? 1
                      : -1
                    : valA < valB
                  ? 1
                  : -1;
                });

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-gray-600 border-b bg-gray-50">
                          {[
                            { key: "pid", label: "PID" },
                            { key: "cpu_percent", label: "CPU%" },
                            { key: "mem_percent", label: "MEM%" },
                            { key: "state", label: "State" },
                            { key: "time", label: "CPU Time (Total)" },
                            { key: "command", label: "Command" },
                          ].map((col) => (
                            <th
                              key={col.key}
                              className="py-3 px-3 cursor-pointer select-none"
                              onClick={() => handleSort(col.key)}
                            >
                              <div className="flex items-center gap-1">
                                {col.label}
                                {sortField === col.key &&
                                  (sortOrder === "asc" ? (
                                    <FaChevronUp className="text-xs" />
                                  ) : (
                                    <FaChevronDown className="text-xs" />
                                  ))}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {sortedProcesses.length === 0 ? (
                          <tr className="border-b text-sm">
                            <td className="py-2" colSpan="6">
                              <span className="text-gray-500">
                                No process data available
                              </span>
                            </td>
                          </tr>
                        ) : (
                          sortedProcesses.map((proc, idx) => (
                            <tr
                              key={idx}
                              className="border-b text-sm hover:bg-gray-50"
                            >
                              <td className="py-2 px-3">{proc.pid || "—"}</td>
                              <td className="px-3">
                                {proc.cpu_percent != null
                                  ? `${Number(proc.cpu_percent).toFixed(1)}%`
                                  : "—"}
                              </td>
                              <td className="px-3">
                                {proc.mem_percent != null
                                  ? `${Number(proc.mem_percent).toFixed(1)}%`
                                  : "—"}
                              </td>
                              <td className="px-3">{proc.state || "—"}</td>
                              <td className="px-3" title={proc.time || "—"}>
                                {formatCPUtime(proc.time)}
                              </td>
                              <td className="px-3 truncate max-w-xs">
                                {proc.command || "—"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            )}
          </div>
        </>
      )}

      {/* LOGS TAB */}
      {activeTab === "logs" && (
        <div
          ref={logsBoxRef}
          className="bg-black text-green-400 p-4 rounded-xl shadow h-[500px] overflow-y-auto font-mono text-sm"
        >
          {logsLoading && <p className="text-gray-400">Loading logs…</p>}
          {logsError && <p className="text-red-400">{logsError}</p>}
          {!logsLoading &&
            !logsError &&
            logs.map((item, i) => (
              <p key={i}>
                <span className="text-gray-400">
                  [{new Date(item.seenAt).toLocaleTimeString()}]
                </span>{" "}
                {item.msg}
              </p>
            ))}
          {!logsLoading && !logsError && logs.length === 0 && (
            <p className="text-gray-400">
              No logs available for this container.
            </p>
          )}
        </div>
      )}

      {/* FILE TAB */}
      {activeTab.startsWith("file:") &&
        (() => {
          const tab = fileTabs.find((t) => t.key === activeTab);
          if (!tab) return null;

          return (
            <div className="bg-white shadow rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-gray-500 text-sm">File</p>
                  <p className="font-semibold">{tab.path}</p>
                </div>

                <button
                  className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
                  onClick={() => {
                    setFileTabs((prev) =>
                      prev.filter((x) => x.key !== tab.key)
                    );
                    setActiveTab("details");
                  }}
                >
                  Close
                </button>
              </div>

              {tab.loading && <p className="text-gray-500 text-sm">Loading…</p>}
              {tab.error && <p className="text-red-500 text-sm">{tab.error}</p>}

              {!tab.loading && !tab.error && (
                <>
                  {tab.truncated && (
                    <p className="text-amber-600 text-sm mb-2">
                      Preview truncated.
                    </p>
                  )}

                  <pre className="bg-black text-green-200 rounded-xl p-4 overflow-auto max-h-[520px] text-sm font-mono">
                    {tab.content || "(empty)"}
                  </pre>
                </>
              )}
            </div>
          );
        })()}

      {activeTab === "files" && (
        <div className="bg-white shadow rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-gray-500 text-sm">Filesystem</p>
              <p className="font-mono font-semibold">{fsPath}</p>
            </div>

            <div className="flex gap-2">
              <button
                className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
                onClick={() => {
                  const parent =
                    fsPath === "/"
                      ? "/"
                      : fsPath.replace(/\/[^/]+$/, "") || "/";
                  fetchDir(parent);
                }}
              >
                Up
              </button>

              <button
                className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
                onClick={() => {
                  fsCacheRef.current.delete(fsPath);
                  fetchDir(fsPath);
                }}
              >
                Refresh
              </button>
            </div>
          </div>

          {fsLoading && <p className="text-gray-500 text-sm">Loading…</p>}
          {fsError && <p className="text-red-500 text-sm">{fsError}</p>}

          {!fsLoading && !fsError && (
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-1 bg-gray-50 text-xs text-gray-600 px-3 py-2">
                <div>Name</div>
              </div>

              {fsEntries.length === 0 ? (
                <div className="px-3 py-3 text-sm text-gray-500">
                  Empty directory
                </div>
              ) : (
                fsEntries.map((e) => (
                  <button
                    key={e.path}
                    className="w-full text-left grid grid-cols-1 px-3 py-2 text-sm hover:bg-gray-50 border-t"
                    onClick={() => {
                      if (e.type === "dir") {
                        fetchDir(e.path);
                      } else if (e.type === "file") {
                        setFilePathInput(e.path);
                        setTimeout(openFilePath, 0);
                      }
                    }}
                    title={e.path}
                  >
                    <div className="font-mono truncate">
                      {e.type === "dir" ? "[DIR] " : "[FILE] "}
                      {e.name}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* OPEN FILE INPUT (FILES TAB ONLY) */}
      {activeTab === "files" && (
        <div className="mt-8 bg-white shadow rounded-xl p-4">
          <p className="font-semibold text-gray-700 mb-2">
            Open file inside container
          </p>

          <div className="flex gap-3">
            <input
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
              placeholder="Try: /app/sample.txt"
              value={filePathInput}
              onChange={(e) => setFilePathInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") openFilePath();
              }}
            />

            <button
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
              onClick={openFilePath}
            >
              Open
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatStatus(status) {
  if (!status) return "Unknown";
  const s = status.toLowerCase();
  if (s === "running") return "Running";
  if (s === "exited" || s === "stopped") return "Stopped";
  if (s === "deleted") return "Deleted";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
