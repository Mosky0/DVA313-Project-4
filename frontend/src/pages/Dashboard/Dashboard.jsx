import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import ChartCard from "../../components/ui/ChartCard";
import CircleMetric from "../../components/ui/CircleMetric";
import ContainersTable from "../../components/containers/ContainersTable";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, AreaChart, Area
} from "recharts";
import GridLayout from "react-grid-layout";
import "./../../../node_modules/react-grid-layout/css/styles.css";
import "./../../../node_modules/react-resizable/css/styles.css";


// Debounce function to limit the rate of function execution
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}


const Dashboard = React.memo(() => {
  // Custom grid
  const customGridStyles = `
    .react-grid-item.react-grid-placeholder {
      background: transparent !important;
      border: none !important;
      opacity: 0 !important;
    }
    
    .react-grid-item > .react-resizable-handle {
      position: absolute;
      width: 16px;
      height: 16px;
      bottom: 2px;
      right: 2px;
      cursor: se-resize;
      background-repeat: no-repeat;
      background-position: bottom right;
      box-sizing: border-box;

      background-image: url("data:image/svg+xml;utf8,\
    <svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'>\
      <line x1='2' y1='10' x2='10' y2='2' stroke='%239CA3AF' stroke-width='1'/>\
      <line x1='5' y1='10' x2='10' y2='5' stroke='%239CA3AF' stroke-width='1'/>\
      <line x1='8' y1='10' x2='10' y2='8' stroke='%239CA3AF' stroke-width='1'/>\
    </svg>");
    }

        
    .react-grid-item.resizing {
      border: none !important;
      box-shadow: none !important;
    }
    
    .react-grid-item.react-draggable-dragging {
      border: none !important;
      box-shadow: none !important;
    }
    
    .react-grid-item.cssTransforms {
      transition-property: none;
    }
  `;

  React.useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = customGridStyles;
    document.head.appendChild(styleElement);
    
    // Cleanup function to remove the style element when component unmounts
    return () => {
      if (document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

  const [system, setSystem] = useState(null);
  const [containers, setContainers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loadingSys, setLoadingSys] = useState(true);
  const [loadingContainers, setLoadingContainers] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selectedCores, setSelectedCores] = useState({ systemCpu: true });
  const [selectAllCores, setSelectAllCores] = useState(false);
  const [cpuCoreHistory, setCPUCoreHistory] = useState({});
  const [systemMemoryHistory, setSystemMemoryHistory] = useState([]);
  const [systemCpuHistory, setSystemCpuHistory] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [backendStatus, setBackendStatus] = useState("connected");
  const [isEditMode, setIsEditMode] = useState(true);
  const [layout, setLayout] = useState([]);
  const [visibleComponents, setVisibleComponents] = useState({
    'load-card': true,
    'cpu-card': true,
    'memory-card': true,
    'uptime-card': true,
    'cpu-activity-chart': true,
    'cpu-trend-chart': true,
    'memory-trend-chart': true,
    'alerts-panel': true,
    'containers-table': true
  });
  const [width, setWidth] = useState(window.innerWidth - 100);
  const [componentStates, setComponentStates] = useState({
    'load-card': 'minimized',
    'cpu-card': 'minimized',
    'memory-card': 'minimized',
    'uptime-card': 'minimized',
    'cpu-activity-chart': 'maximized',
    'cpu-trend-chart': 'maximized',
    'memory-trend-chart': 'maximized',
    'alerts-panel': 'minimized',
    'containers-table': 'maximized'
  });

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const initialTimeRange = localStorage.getItem('dashboard_time_range') || '30min';
  
  const [cpuYAxisScale, setCpuYAxisScale] = useState(() => {
    const saved = localStorage.getItem('dashboard_cpu_yaxis_scale');
    return saved ? Number(saved) : 100;
  }); 
  const [memoryYAxisScale, setMemoryYAxisScale] = useState(() => {
    const saved = localStorage.getItem('dashboard_memory_yaxis_scale');
    return saved ? Number(saved) : 100;
  }); 
  const [timeRange, setTimeRange] = useState(initialTimeRange);
  const wasDisconnected = useRef(false);
  
  const [bufferSize, setBufferSize] = useState(() => {
    const rangeMap = { '1min': 12, '5min': 60, '15min': 180, '30min': 360 };
    return rangeMap[initialTimeRange] || 360;
  }); 

  useEffect(() => {
    localStorage.setItem('dashboard_cpu_yaxis_scale', cpuYAxisScale.toString());
  }, [cpuYAxisScale]);

  useEffect(() => {
    localStorage.setItem('dashboard_memory_yaxis_scale', memoryYAxisScale.toString());
  }, [memoryYAxisScale]);

  // Handle time range changes
  useEffect(() => {
    const rangeMap = { '1min': 12, '5min': 60, '15min': 180, '30min': 360 };
    setBufferSize(rangeMap[timeRange] || 360);
    localStorage.setItem('dashboard_time_range', timeRange);
  }, [timeRange]);

  const [fixedWindowData, setFixedWindowData] = useState(
    Array(bufferSize).fill().map((_, index) => ({
      index: index,
      time: null,
      SystemCPU: 0,
      Core0: 0,
      Core1: 0,
      Core2: 0,
      Core3: 0,
      Core4: 0,
      Core5: 0
    }))
  );

  const [currentPosition, setCurrentPosition] = useState(0);
  const [isWindowFull, setIsWindowFull] = useState(false);

  useEffect(() => {
    
    if (!isDataLoaded) return;
    
    const hasSystemData = systemCpuHistory && systemCpuHistory.length > 0;
    const hasCoreData = Object.keys(cpuCoreHistory).length > 0 && 
                       Object.values(cpuCoreHistory).some(coreData => coreData && coreData.length > 0);
    
    if (!hasSystemData && !hasCoreData) {
      setFixedWindowData(
        Array(bufferSize).fill().map((_, index) => ({
          index: index,
          time: null,
          SystemCPU: 0,
          Core0: 0,
          Core1: 0,
          Core2: 0,
          Core3: 0,
          Core4: 0,
          Core5: 0
        }))
      );
      setCurrentPosition(0);
      setIsWindowFull(false);
      return;
    }
    
    const windowData = Array(bufferSize).fill().map((_, index) => ({
      index: index,
      time: null,
      SystemCPU: 0,
      Core0: 0,
      Core1: 0,
      Core2: 0,
      Core3: 0,
      Core4: 0,
      Core5: 0
    }));
    
    let minDataPoints = bufferSize;
    if (hasSystemData) {
      minDataPoints = Math.min(minDataPoints, systemCpuHistory.length);
    }
    if (hasCoreData) {
      Object.values(cpuCoreHistory).forEach(coreData => {
        if (coreData && coreData.length > 0) {
          minDataPoints = Math.min(minDataPoints, coreData.length);
        }
      });
    }
    
    const pointsToUse = Math.min(minDataPoints, bufferSize);
    
    for (let i = 0; i < pointsToUse; i++) {
      const dataIndex = minDataPoints - pointsToUse + i;
      const dataPoint = {
        index: i,
        time: null,
        SystemCPU: 0,
        Core0: 0,
        Core1: 0,
        Core2: 0,
        Core3: 0,
        Core4: 0,
        Core5: 0
      };
      
      if (hasSystemData && dataIndex < systemCpuHistory.length) {
        const systemPoint = systemCpuHistory[dataIndex];
        dataPoint.SystemCPU = systemPoint?.value || 0;
        dataPoint.time = systemPoint?.timestamp || null;
      }
      
      Object.entries(cpuCoreHistory).forEach(([coreIdx, coreData]) => {
        if (coreData && coreData.length > 0 && dataIndex < coreData.length) {
          const corePoint = coreData[dataIndex];
          dataPoint[`Core${coreIdx}`] = corePoint?.value || 0;
          
          if (!dataPoint.time && corePoint?.timestamp) {
            dataPoint.time = corePoint.timestamp;
          }
        }
      });
      
      windowData[i] = dataPoint;
    }
    
    setFixedWindowData(windowData);
    setCurrentPosition(pointsToUse);
    setIsWindowFull(pointsToUse >= bufferSize);
  }, [isDataLoaded, systemCpuHistory, cpuCoreHistory, bufferSize]);

  const [fixedMemoryWindowData, setFixedMemoryWindowData] = useState(
    Array(bufferSize).fill().map((_, index) => ({
      index: index,
      time: null,
      value: 0
    }))
  );

  const [memoryCurrentPosition, setMemoryCurrentPosition] = useState(0);
  const [isMemoryWindowFull, setIsMemoryWindowFull] = useState(false);

  useEffect(() => {
    if (!isDataLoaded) return;
    
    if (!systemMemoryHistory || systemMemoryHistory.length === 0) {
      setFixedMemoryWindowData(
        Array(bufferSize).fill().map((_, index) => ({
          index: index,
          time: null,
          value: 0
        }))
      );
      setMemoryCurrentPosition(0);
      setIsMemoryWindowFull(false);
      return;
    }
    
    const windowData = Array(bufferSize).fill().map((_, index) => ({
      index: index,
      time: null,
      value: 0
    }));
    
    const pointsToUse = Math.min(systemMemoryHistory.length, bufferSize);
    
    for (let i = 0; i < pointsToUse; i++) {
      const dataIndex = systemMemoryHistory.length - pointsToUse + i;
      if (dataIndex < systemMemoryHistory.length) {
        const memoryPoint = systemMemoryHistory[dataIndex];
        windowData[i] = {
          index: i,
          time: memoryPoint?.timestamp || null,
          value: memoryPoint?.value || 0
        };
      }
    }
    
    setFixedMemoryWindowData(windowData);
    setMemoryCurrentPosition(pointsToUse);
    setIsMemoryWindowFull(pointsToUse >= bufferSize);
  }, [isDataLoaded, systemMemoryHistory, bufferSize]);

  // Define default layout
  const defaultLayout = [
    { "i": "load-card", "x": 2, "y": 0, "w": 3, "h": 1, "moved": false },
    { "i": "cpu-card", "x": 5, "y": 0, "w": 2, "h": 1, "moved": false },
    { "i": "memory-card", "x": 7, "y": 0, "w": 4, "h": 1, "moved": false },
    { "i": "uptime-card", "x": 0, "y": 0, "w": 2, "h": 1, "moved": false },
    
    { "i": "cpu-activity-chart", "x": 0, "y": 1, "w": 5, "h": 2, "moved": false },
    { "i": "cpu-trend-chart", "x": 5, "y": 1, "w": 6, "h": 2, "moved": false },
    
    { "i": "memory-trend-chart", "x": 5, "y": 3, "w": 6, "h": 2, "moved": false },
    { "i": "alerts-panel", "x": 0, "y": 3, "w": 5, "h": 2, "moved": false },
    
    { "i": "containers-table", "x": 0, "y": 4.5, "w": 11, "h": 4, "moved": false }
  ];

  useEffect(() => {
    const savedLayoutV4 = localStorage.getItem('dashboard_layout_v4');
    
    if (savedLayoutV4) {
      try {
        const parsedLayout = JSON.parse(savedLayoutV4);
        
        const isProblematicLayout = parsedLayout.every(item => item.w === 1 && item.h === 1);
        
        if (isProblematicLayout) {
          localStorage.removeItem('dashboard_layout_v4');
          setLayout(defaultLayout);
        } else {
          const layoutWithoutStatic = parsedLayout.map(item => {
            const { static: itemStatic, ...rest } = item;
            return rest;
          });
          setLayout(layoutWithoutStatic);
        }
      } catch (e) {
        localStorage.removeItem('dashboard_layout_v4');
        setLayout(defaultLayout);
      }
    } else {
      setLayout(defaultLayout);
    }
  }, []);
  



  useEffect(() => {
    if (layout.length > 0) {
      setComponentStates(prevStates => {
        const newComponentStates = { ...prevStates }; 
        
        layout.forEach(item => {
          switch (item.i) {
            case 'load-card':
            case 'cpu-card':
            case 'memory-card':
            case 'uptime-card':
              newComponentStates[item.i] = (item.w === 1 && item.h === 1) ? 'minimized' : 'maximized';
              break;
            case 'cpu-activity-chart':
              newComponentStates[item.i] = (item.w === 5 && item.h === 2) ? 'minimized' : 'maximized';
              break;
            case 'cpu-trend-chart':
              newComponentStates[item.i] = (item.w === 6 && item.h === 2) ? 'minimized' : 'maximized';
              break;
            case 'memory-trend-chart':
              newComponentStates[item.i] = (item.w === 3 && item.h === 2) ? 'minimized' : 'maximized';
              break;
            case 'alerts-panel':
              newComponentStates[item.i] = (item.w === 2 && item.h === 2) ? 'minimized' : 'maximized';
              break;
            case 'containers-table':
              newComponentStates[item.i] = (item.h === 3) ? 'minimized' : 'maximized';
              break;
            default:
              newComponentStates[item.i] = 'maximized';
          }
        });
        
        return newComponentStates;
      });
    }
  }, [layout]);

  const onLayoutChange = (newLayout) => {
    const isValidLayout = newLayout.every(item => 
      typeof item.x === 'number' && 
      typeof item.y === 'number' && 
      typeof item.w === 'number' && 
      typeof item.h === 'number' &&
      item.w > 0 && item.h > 0
    );
    
    const isStackedLayout = newLayout.length > 0 && newLayout.every(item => item.w === 1 && item.h === 1);
    
    if (isValidLayout && !isStackedLayout) {
      setLayout(newLayout);
      const layoutToSave = newLayout.map(item => ({ ...item, static: true }));
      localStorage.setItem('dashboard_layout_v4', JSON.stringify(layoutToSave));
    } else if (isEditMode && isStackedLayout) {
      setTimeout(() => {
        setLayout(defaultLayout);
        const layoutToSave = defaultLayout.map(item => ({ ...item, static: true }));
        localStorage.setItem('dashboard_layout_v4', JSON.stringify(layoutToSave));
      }, 50);
    }
  };

  const getButtonIcon = (componentId) => {
    const currentState = componentStates[componentId];
    const isMinimized = currentState === 'minimized';
    
    if (isMinimized) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
      </svg>

      );
    } else {
      return (
      <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4 rotate-90"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      >
      <polyline points="21 15 15 15 15 21" />
      <polyline points="3 9 9 9 9 3" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="9" y1="9" x2="3" y2="3" />
    </svg>
      );
    }
  };

  const toggleComponentState = (componentId) => {
    const currentItem = layout.find(item => item.i === componentId);
    
    if (!currentItem) {
      console.warn(`Component ${componentId} not found in layout`);
      return;
    }
    
    const currentState = componentStates[componentId];
    const newState = currentState === 'minimized' ? 'maximized' : 'minimized';
    
    setComponentStates(prev => ({
      ...prev,
      [componentId]: newState
    }));
    
    const updatedLayout = layout.map(item => {
      if (item.i === componentId) {
        let updatedItem;
        switch (componentId) {
          case 'load-card':
            updatedItem = {
              ...item,
              w: newState === 'minimized' ? 1 : 3,
              h: 1
            };
            break;
          case 'cpu-card':
            updatedItem = {
              ...item,
              w: newState === 'minimized' ? 1 : 2,
              h: 1
            };
            break;
          case 'memory-card':
            updatedItem = {
              ...item,
              w: newState === 'minimized' ? 1 : 4,
              h: 1
            };
            break;
          case 'uptime-card':
            updatedItem = {
              ...item,
              w: newState === 'minimized' ? 1 : 2,
              h: 1
            };
            break;
          case 'cpu-activity-chart':
            updatedItem = {
              ...item,
              w: 5,
              h: newState === 'minimized' ? 2 : 4
            };
            break;
          case 'cpu-trend-chart':
            updatedItem = {
              ...item,
              w: newState === 'minimized' ? 6 : 6,
              h: newState === 'minimized' ? 2 : 4
            };
            break;
          case 'memory-trend-chart':
            updatedItem = {
              ...item,
              w: newState === 'minimized' ? 3 : 6,
              h: 2
            };
            break;
          case 'alerts-panel':
            updatedItem = {
              ...item,
              w: newState === 'minimized' ? 2 : 5,
              h: 2
            };
            break;
          case 'containers-table':
            updatedItem = {
              ...item,
              h: newState === 'minimized' ? 3 : 4
            };
            break;
          default:
            updatedItem = item;
        }
        
        updatedItem.w = Math.max(1, updatedItem.w);
        updatedItem.h = Math.max(1, updatedItem.h);
        
        updatedItem.x = Math.max(0, Math.min(updatedItem.x, 10)); // Max x position for 8 columns grid
        updatedItem.y = Math.max(0, updatedItem.y);
        
        if (updatedItem.x + updatedItem.w > 11) {
          updatedItem.x = Math.max(0, 11 - updatedItem.w);
        }
        
        return updatedItem;
      }
      return item;
    });
    
    setLayout(updatedLayout);
  };

  const resetToDefaultLayout = () => {
    setTimeout(() => {
      setLayout(defaultLayout);
      const layoutToSave = defaultLayout.map(item => ({ ...item, static: true }));
      localStorage.setItem('dashboard_layout_v4', JSON.stringify(layoutToSave));
    }, 50);
  };

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth - 100);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initial fetch
  useEffect(() => {
    let mounted = true;

    const fetchInitialSystemData = async () => {
      try {
        const [sysRes, historyRes, bufferConfigRes] = await Promise.all([
          fetch(`/api/system`),
          fetch(`/api/system/metrics/history`),
          fetch(`/api/system/buffer-config`)
        ]);

       

        const sysData = sysRes.ok ? await sysRes.json() : null;
        if (sysData && mounted) {
          setSystem(sysData);
        }

        const historyData = historyRes.ok ? await historyRes.json() : null;
        if (historyData && mounted) {
          setCPUCoreHistory(historyData.cpuCoreHistories || {});
          setSystemMemoryHistory(historyData.memoryHistory || []);
          setSystemCpuHistory(historyData.systemCpuHistory || []);
          setIsDataLoaded(true);
        }

      } catch (e) {
        console.error("fetchInitialSystemData error:", e);
      } finally {
        if (mounted) {
          setLoadingSys(false);
        }
      }
    };

    fetchInitialSystemData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const fetchLatestSystemValues = async () => {
      if (!isDataLoaded) return;

      try {
        const [sysRes, latestSysRes] = await Promise.all([
          fetch(`/api/system`),
          fetch(`/api/system/metrics/latest`)
        ]);

        const sysData = sysRes.ok ? await sysRes.json() : null;
        if (sysData && mounted) {
          const latestSysData = latestSysRes.ok ? await latestSysRes.json() : null;
          if (latestSysData && latestSysData.systemCpu) {
            sysData.cpu = {
              ...sysData.cpu,
              total_percent: latestSysData.systemCpu.value
            };
          }
          setSystem(sysData);

          const now = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          });

          if (latestSysData && latestSysData.systemCpu) {
            setSystemCpuHistory(prev => [
              ...prev,
              {
                timestamp: now,
                value: latestSysData.systemCpu.value
              }
            ].slice(-bufferSize)); 
          }


          if (latestSysData && latestSysData.memory) {
            setSystemMemoryHistory(prev => [
              ...prev,
              {
                timestamp: now,
                value: latestSysData.memory.value
              }
            ].slice(-bufferSize));
          }

          if (latestSysData && latestSysData.cpuCores) {
            setCPUCoreHistory(prev => {
              const updated = {...prev};
              Object.entries(latestSysData.cpuCores).forEach(([coreIdx, coreData]) => {
                if (coreData) {
                  if (!updated[coreIdx]) updated[coreIdx] = [];
                  updated[coreIdx] = [
                    ...updated[coreIdx],
                    {
                      timestamp: now,
                      value: coreData.value
                    }
                  ].slice(-bufferSize);
                }
              });
              return updated;
            });
          }
        }

      } catch (e) {
        console.error("fetchLatestSystemValues error:", e);
      }
    };

    if (isDataLoaded) {
      fetchLatestSystemValues();
    }

    const iv = setInterval(() => {
      if (mounted && isDataLoaded) {
        fetchLatestSystemValues();
      }
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, [isDataLoaded, bufferSize]);

  useEffect(() => {
    let mounted = true;

    const fetchAllContainerStats = async () => {
      try {
        const res = await fetch(`/api/containers/all/stats`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error("Failed to fetch container stats");

        const data = await res.json();
        if (!mounted || !Array.isArray(data)) return;

        setContainers(data);
        setLoadingContainers(false);
      } catch (err) {
        console.error("fetchAllContainerStats error:", err);
        if (mounted) setLoadingContainers(false);
      }
    };

    fetchAllContainerStats();
    const iv = setInterval(fetchAllContainerStats, 5000);

    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  useEffect(() => {
  let mounted = true;
  let lastStatus = null;

  const checkBackend = async () => {
    try {
      const res = await fetch(`/api/system`, {
        cache: "no-store",
      });

      if (!mounted) return;

  if (res.ok) {
    if (lastStatus === "disconnected") {
     wasDisconnected.current = true;
     setBackendStatus("connected");
     }
     lastStatus = "connected";
}

      else {
        if (lastStatus !== "disconnected") {
          setBackendStatus("disconnected");
          lastStatus = "disconnected";
        }
      }
    } catch (err) {
      if (!mounted) return;
      if (lastStatus !== "disconnected") {
       wasDisconnected.current = true;
       setBackendStatus("disconnected");
       lastStatus = "disconnected";
    }

    }
  };

   checkBackend();

  const interval = setInterval(checkBackend, 5000);

  return () => {
    mounted = false;
    clearInterval(interval);
  };
}, []);

useEffect(() => {
  if (backendStatus === "connected") {
    const t = setTimeout(() => {
      setBackendStatus("unknown");
    }, 2000);
    return () => clearTimeout(t);
  }
}, [backendStatus]);

  const cpuTrendSeries = useMemo(() => {
    return fixedWindowData;
  }, [fixedWindowData]);

  const cpuTrendMax = useMemo(() => {
    return cpuYAxisScale;
  }, [cpuYAxisScale]);

  const memPct = useMemo(() => {
    if (!system) return 0;
    const used = system.memory?.used_bytes || 0;
    const limit = system.memory?.limit_bytes || 0;
    if (!limit) return 0;
    return Number(((used / limit) * 100).toFixed(1));
  }, [system]);

  const [alertTimestamps, setAlertTimestamps] = useState({});

  const memoryTrendSeries = useMemo(() => {
    if (!systemMemoryHistory || systemMemoryHistory.length === 0) return [];
   
    const maxLength = Math.min(systemMemoryHistory.length, 360);
    const startIndex = systemMemoryHistory.length - maxLength;
   
    return systemMemoryHistory.slice(startIndex).map((entry, idx) => ({
      time: entry.timestamp || `t-${maxLength - idx - 1}`,
      value: entry.value
    }));
  }, [systemMemoryHistory]);

  const memoryTrendMax = useMemo(() => {
    return memoryYAxisScale;
  }, [memoryYAxisScale]);


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

    const currentAlerts = new Set();

    if (events && events.length) {
      events.slice(0, 10).forEach((ev) => {
        const eventKey = `event_${ev.id || ev.timestamp || JSON.stringify(ev)}`;
        currentAlerts.add(eventKey);
      
        if (!alertTimestamps[eventKey]) {
          const eventTime = ev.time || ev.timestamp || new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          });
          setAlertTimestamps(prev => ({
            ...prev,
            [eventKey]: eventTime
          }));
        }
      
        alerts.push({
          severity: "info",
          time: alertTimestamps[eventKey] || (ev.time || ev.timestamp || ""),
          message: ev.message ?? ev.msg ?? JSON.stringify(ev),
        });
      });
    }

    containers.forEach((c) => {
      if (!c) return;
      const name = c.name || c.id;
      
      if ((c.status || "").toLowerCase() !== "running") {
        const statusKey = `container_status_${c.id}_${c.status}`;
        currentAlerts.add(statusKey);
      
        if (!alertTimestamps[statusKey]) {
          const statusTime = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          });
          setAlertTimestamps(prev => ({
            ...prev,
            [statusKey]: statusTime
          }));
        }
      
        alerts.push({ 
          severity: "critical", 
          time: alertTimestamps[statusKey] || "", 
          message: `${name} is ${c.status || "stopped"}` 
        });
      }
      
      const cpu = Number(c.cpu_percent ?? 0);
      if (cpu && cpu >= 75) {
        const cpuKey = `container_cpu_high_${c.id}`;
        currentAlerts.add(cpuKey);
      
        if (!alertTimestamps[cpuKey]) {
          const cpuTime = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          });
          setAlertTimestamps(prev => ({
            ...prev,
            [cpuKey]: cpuTime
          }));
        }
      
        alerts.push({ 
          severity: "warning", 
          time: alertTimestamps[cpuKey] || "", 
          message: `${name} high CPU ${cpu}%` 
        });
      }
      
      const memPctC = parseMemPercent(c.mem_usage) ?? (c.mem_percent ?? null);
      if (memPctC && memPctC >= 75) {
        const memKey = `container_mem_high_${c.id}`;
        currentAlerts.add(memKey);
      
        if (!alertTimestamps[memKey]) {
          const memTime = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          });
          setAlertTimestamps(prev => ({
            ...prev,
            [memKey]: memTime
          }));
        }
      
        alerts.push({ 
          severity: "warning", 
          time: alertTimestamps[memKey] || "", 
          message: `${name} high MEM ${memPctC}%` 
        });
      }
    });

    const cleanupKeys = Object.keys(alertTimestamps).filter(key => !currentAlerts.has(key));
    if (cleanupKeys.length > 0) {
      setAlertTimestamps(prev => {
        const newTimestamps = { ...prev };
        cleanupKeys.forEach(key => delete newTimestamps[key]);
        return newTimestamps;
      });
    }

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
  }, [events, containers, alertTimestamps]);


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
      system?.cpu?.per_core?.forEach((_, i) => {
        newSelectedCores[i] = newSelectAll;
      });
    }
    setSelectedCores(newSelectedCores);
  }, [selectAllCores, system?.cpu?.per_core]);


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

      <div className="flex justify-start mb-4 relative gap-2">
        <button 
          onClick={() => {
            resetToDefaultLayout();
            
            setVisibleComponents(prev => {
              const allVisible = {};
              Object.keys(prev).forEach(key => {
                allVisible[key] = true;
              });
              
              setLayout(prevLayout => {
                const allItems = [...prevLayout];
                Object.keys(allVisible).forEach(componentId => {
                  const existingItem = prevLayout.find(item => item.i === componentId);
                  if (!existingItem) {
                    const defaultItem = defaultLayout.find(item => item.i === componentId);
                    if (defaultItem) {
                      allItems.push({ ...defaultItem });
                    }
                  }
                });
                return allItems;
              });
              
              return allVisible;
            });
          }}
          className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          Reset Layout
        </button>
        
        <button 
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="px-3 py-1.5 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 transition-colors flex items-center text-sm"
        >
          Toggle Dashboard Cards
          <svg 
            className={`ml-1.5 w-3.5 h-3.5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {isDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-4">
            <div className="space-y-3">
              {Object.keys(visibleComponents).map(componentId => (
                <div key={componentId} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={visibleComponents[componentId]}
                    onChange={() => {
                      setVisibleComponents(prev => {
                        const nextVisible = !prev[componentId];
                        setLayout(prevLayout => {
                          if (nextVisible) {
                            const defaultItem = defaultLayout.find(item => item.i === componentId);
                            if (!defaultItem) return prevLayout;
                            const without = prevLayout.filter(item => item.i !== componentId);
                            return [...without, { ...defaultItem }];
                          } else {
                            return prevLayout.filter(item => item.i !== componentId);
                          }
                        });
                        return {
                          ...prev,
                          [componentId]: nextVisible
                        };
                      });
                    }}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <label className="ml-3 text-sm font-medium text-gray-700 capitalize cursor-pointer">
                    {componentId.replace(/-/g, ' ')}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {isDropdownOpen && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsDropdownOpen(false)}
          />
        )}
      </div>
      
      {/* Grid Layout */}
      <GridLayout
        className="layout"
        layout={layout.map(item => ({ ...item, static: false }))}
        cols={8}
        rowHeight={40}
        width={width}
        isDraggable={isEditMode}
        isResizable={isEditMode}
        onLayoutChange={onLayoutChange}
        margin={[10, 10]}
        containerPadding={[15, 15]}
      >
        {/* TOP CARDS */}
        {visibleComponents['load-card'] && (
        <div key="load-card" className="bg-white rounded-xl p-4 shadow flex flex-col h-full">
          <div className="flex justify-between items-start">
            <div className="text-xs text-gray-500">Load (1/5/15)</div>
            <button 
              onClick={() => toggleComponentState('load-card')}
              className="text-xs text-gray-500 hover:text-gray-700 z-10"
            >
              {getButtonIcon('load-card')}
            </button>
          </div>
          <div className="flex-grow flex flex-col justify-center min-h-[40px]">
            {loadingSys || !system ? (
              <div className="text-lg font-semibold text-gray-400">Loading...</div>
            ) : (
              <div className="text-lg font-semibold">
                {system?.load?.map((l) => (typeof l === "number" ? l.toFixed(2) : l)).join(" / ")}
              </div>
            )}
            {loadingSys || !system ? (
              <div className="text-xs text-gray-400 mt-1">Processes: — • Running: —</div>
            ) : (
              <div className="text-xs text-gray-400 mt-1">
                Processes: {system.total_processes} • Running: {system.running}
              </div>
            )}
          </div>
        </div>

        )}
        {visibleComponents["cpu-card"] && (
        <div key="cpu-card" className="bg-white rounded-xl p-4 shadow flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <div className="text-xs text-gray-500">System CPU</div>
            <button
              onClick={() => toggleComponentState("cpu-card")}
              className="text-xs text-gray-500 hover:text-gray-700 z-10"
            >
              {getButtonIcon("cpu-card")}
            </button>
          </div>

          <div className="flex-grow flex items-center justify-center min-h-[40px]">
            {loadingSys || !system ? (
              <CircleMetric value={0} label="System CPU" size={componentStates["cpu-card"] === "minimized" ? 32 : 64} />
            ) : (
              <CircleMetric value={Number((system?.cpu?.total_percent || 0).toFixed(1))} label="System CPU" size={componentStates['cpu-card'] === 'minimized' ? 32 : 64} />
            )}
          </div>
        </div>
      )}

        {visibleComponents["memory-card"] && (
  <div key="memory-card" className="bg-white rounded-xl p-4 shadow flex flex-col h-full">
    <div className="flex justify-between items-start">
      <div className="text-xs text-gray-500">Memory</div>
      <button
        onClick={() => toggleComponentState("memory-card")}
        className="text-xs text-gray-500 hover:text-gray-700 z-10"
      >
        {getButtonIcon("memory-card")}
      </button>
    </div>

    <div className="flex-grow flex flex-col justify-center min-h-[40px]">
      {loadingSys || !system ? (
        <div className="mt-2 text-sm font-semibold text-gray-400">—</div>
      ) : (
        <div className="mt-2 text-sm font-semibold">{memPct}%</div>
      )}

      <div className="mt-3">
        <div className="bg-gray-200 h-2 rounded overflow-hidden">
          <div className="h-2 bg-[#2496ED]" style={{ width: `${loadingSys || !system ? 0 : memPct}%` }} />
        </div>
      </div>
    </div>
  </div>
)}


        {visibleComponents["uptime-card"] && (
  <div key="uptime-card" className="bg-white rounded-xl p-4 shadow flex flex-col h-full">
    <div className="flex justify-between items-start">
      <div className="text-xs text-gray-500">Uptime</div>
      <button
        onClick={() => toggleComponentState("uptime-card")}
        className="text-xs text-gray-500 hover:text-gray-700 z-10"
      >
        {getButtonIcon("uptime-card")}
      </button>
    </div>

    <div className="flex-grow flex flex-col justify-center min-h-[40px]">
      {loadingSys || !system ? (
        <div className="mt-2 text-lg font-semibold text-gray-400">Loading...</div>
      ) : (
        <div className="mt-2 text-lg font-semibold">{system.uptime}</div>
      )}
      <div className="text-xs text-gray-400 mt-1">Host</div>
    </div>
  </div>
)}



      {/* CPU ACTIVITY (PER CORE) */}
      {visibleComponents['cpu-activity-chart'] && (
          <div key="cpu-activity-chart" className="bg-white rounded-2xl shadow p-4 flex flex-col h-full">
        <div className="flex justify-between items-start mb-3">
          <div className="text-sm font-medium">CPU Activity (per core)</div>
          <button 
            onClick={() => toggleComponentState('cpu-activity-chart')}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            {getButtonIcon('cpu-activity-chart')}
          </button>
        </div>

        <div className="grow overflow-y-auto min-h-[150px] space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectAllCores}
              onChange={handleSelectAll}
              className="w-4 h-4 cursor-pointer"
              disabled={loadingSys || !system}
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
              disabled={loadingSys || !system}
            />
            <div className="text-xs text-gray-600">System CPU</div>
          </div>
         
          {loadingSys || !system ? (
            <div className="text-xs text-gray-500">Loading CPU data...</div>
          ) : system?.cpu?.per_core?.length ? (
            system?.cpu?.per_core?.map((v, i) => {
              const displayValue = cpuCoreHistory && cpuCoreHistory[i] && cpuCoreHistory[i].length > 0
                ? cpuCoreHistory[i][cpuCoreHistory[i].length - 1].value
                : v;
              return (
                <div key={`cpu-core-${i}`} className="flex items-center gap-3">
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
                  <div className="w-12 text-right text-xs font-medium">{Number(displayValue.toFixed(1))}%</div>
                </div>
              );
            })
          ) : (
            <div className="text-xs text-gray-500">No per-core data.</div>
          )}
        </div>
      </div>
    )}
      {/* CPU TREND */}

        {visibleComponents['cpu-trend-chart'] && (
  <div key="cpu-trend-chart" className="bg-white rounded-2xl shadow p-3 flex flex-col h-full">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">CPU trend (selected cores)</div>
            <div className="flex items-center gap-2">
              {(() => {
                const cpuTrendItem = layout.find(item => item.i === 'cpu-trend-chart');
                const showAxisButtons = cpuTrendItem && cpuTrendItem.w >= 4;
                
                return showAxisButtons ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Y-Axis:</span>
                      <select 
                        value={cpuYAxisScale}
                        onChange={(e) => setCpuYAxisScale(Number(e.target.value))}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value={10}>10%</option>
                        <option value={25}>25%</option>
                        <option value={50}>50%</option>
                        <option value={75}>75%</option>
                        <option value={100}>100%</option>
                      </select>
                    </div>
                  </>
                ) : null;
              })()}
              {(() => {
                const cpuTrendItem = layout.find(item => item.i === 'cpu-trend-chart');
                const showAxisButtons = cpuTrendItem && cpuTrendItem.w >= 4;
                
                return showAxisButtons ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Time:</span>
                    <select 
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      className="text-xs border rounded px-2 py-1"
                    >
                      <option value="1min">1 min</option>
                      <option value="5min">5 min</option>
                      <option value="15min">15 min</option>
                      <option value="30min">30 min</option>
                    </select>
                  </div>
                ) : null;
              })()}
              <div className="text-xs text-gray-500">
                {loadingSys || !system ? 'Loading...' : `Selected: ${Object.values(selectedCores).filter(Boolean).length} items`}
              </div>
              <button 
                onClick={() => toggleComponentState('cpu-trend-chart')}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                {getButtonIcon('cpu-trend-chart')}
              </button>
            </div>
          </div>
          <div className="grow min-h-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fixedWindowData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="index" 
                  stroke="#888" 
                  tick={{ fontSize: 10 }}
                  tickFormatter={(index) => {
                    const dataPoint = cpuTrendSeries[index];
                    if (dataPoint && dataPoint.time) {
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
                />
                <Tooltip 
                  formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
                  labelFormatter={(index) => {
                    const dataPoint = cpuTrendSeries[index];
                    if (dataPoint && dataPoint.time) {
                      return `Time: ${dataPoint.time}`;
                    }
                    return `Point ${index}`;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {selectedCores.systemCpu && (
                  <Line
                    type="monotone"
                    dataKey="SystemCPU"
                    name="System CPU"
                    stroke="#ff6b6b"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                )}
                {system?.cpu?.per_core?.map((_, coreIdx) =>
                  selectedCores[coreIdx] ? (
                    <Line
                      key={coreIdx}
                      type="monotone"
                      dataKey={`Core${coreIdx}`}
                      name={`Core ${coreIdx}`}
                      stroke={["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"][coreIdx % 6]}
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  ) : null
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}


      {/* Memory trend */}
      {visibleComponents["memory-trend-chart"] && (
        <div key="memory-trend-chart" className="bg-white rounded-2xl shadow p-3 flex flex-col h-full">
          <div className="flex justify-between items-start mb-2">
            <div className="text-sm font-medium">System Memory trend</div>
            <div className="flex items-center gap-2">
              {(() => {
                const memoryTrendItem = layout.find(item => item.i === 'memory-trend-chart');
                const showAxisButtons = memoryTrendItem && memoryTrendItem.w >= 3;
                
                return showAxisButtons ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Y-Axis:</span>
                      <select 
                        value={memoryYAxisScale}
                        onChange={(e) => setMemoryYAxisScale(Number(e.target.value))}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value={10}>10%</option>
                        <option value={25}>25%</option>
                        <option value={50}>50%</option>
                        <option value={75}>75%</option>
                        <option value={100}>100%</option>
                      </select>
                    </div>
                  </>
                ) : null;
              })()}
              {(() => {
                const memoryTrendItem = layout.find(item => item.i === 'memory-trend-chart');
                const showAxisButtons = memoryTrendItem && memoryTrendItem.w >= 3;
                
                return showAxisButtons ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Time:</span>
                    <select 
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value)}
                      className="text-xs border rounded px-2 py-1"
                    >
                      <option value="1min">1 min</option>
                      <option value="5min">5 min</option>
                      <option value="15min">15 min</option>
                      <option value="30min">30 min</option>
                    </select>
                  </div>
                ) : null;
              })()}
              <button
                onClick={() => toggleComponentState("memory-trend-chart")}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                {getButtonIcon("memory-trend-chart")}
              </button>
            </div>
          </div>

          {loadingSys || !system ? (
            <div className="flex items-center justify-center grow text-gray-500">
              Loading memory trend data...
            </div>
          ) : (
            <div className="w-full flex-grow min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={fixedMemoryWindowData}>
                  <defs>
                    <linearGradient id="memoryGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#2496ED" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#2496ED" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="index"
                    stroke="#888"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(index) => (memoryTrendSeries[index]?.time ? memoryTrendSeries[index].time : "")}
                    axisLine={true}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis stroke="#888" domain={[0, memoryTrendMax]} tick={{ fontSize: 12 }} width={30} />
                  <Tooltip
                    formatter={(value) => [`${Number(value).toFixed(1)}%`, "Memory"]}
                    labelFormatter={(index) =>
                      memoryTrendSeries[index]?.time ? `Time: ${memoryTrendSeries[index].time}` : `Point ${index}`
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Memory Usage"
                    stroke="#2496ED"
                    fill="url(#memoryGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}



    {/* Alerts panel */}
    {visibleComponents["alerts-panel"] && (
      <div key="alerts-panel" className="bg-white rounded-2xl shadow p-4 flex flex-col h-full">
        <div className="flex justify-between items-start mb-3">
          <div className="text-sm font-medium">Alerts & Recent Events</div>
          <button
            onClick={() => toggleComponentState("alerts-panel")}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            {getButtonIcon("alerts-panel")}
          </button>
        </div>

        <div className="flex-grow overflow-y-auto min-h-[50px] space-y-2 text-sm text-gray-700">
          {loadingSys || !system ? (
            <div className="text-xs text-gray-400">Loading alerts...</div>
          ) : derivedAlerts.length === 0 ? (
            <div className="text-xs text-gray-400">No alerts or events</div>
          ) : (
            derivedAlerts.map((a, i) => (
              <div
                key={`alert-${i}`}
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
      </div>
    )}



      {/* Containers table */}
      {visibleComponents["containers-table"] && (
  <div key="containers-table" className="bg-white rounded-2xl shadow p-4 h-full flex flex-col">
    <div className="flex justify-between items-start mb-3">
      <div className="text-sm font-medium">Containers</div>
      <button
        onClick={() => toggleComponentState("containers-table")}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        {getButtonIcon("containers-table")}
      </button>
    </div>

    {loadingContainers ? (
      <div className="flex items-center justify-center grow text-gray-500">
        Loading containers...
      </div>
    ) : (
      <div className="grow overflow-y-auto">
        <ContainersTable containers={containers} />
      </div>
    )}
  </div>
)}

    </GridLayout>
    </div>
  );
});


export default Dashboard;
