import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import ChartCard from "../../components/ui/ChartCard";
import CircleMetric from "../../components/ui/CircleMetric";
import ContainersTable from "../../components/containers/ContainersTable";
import { API_BASE_URL } from "../../config";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid
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
  const [backendStatus, setBackendStatus] = useState("connected");
  const [isEditMode, setIsEditMode] = useState(true);
  const [layout, setLayout] = useState([]);
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

  const wasDisconnected = useRef(false);

  // Define default layout
  const defaultLayout = [
    { "i": "load-card", "x": 0, "y": 0, "w": 2, "h": 1, "moved": false },
    { "i": "cpu-card", "x": 2, "y": 0, "w": 2, "h": 1, "moved": false },
    { "i": "memory-card", "x": 4, "y": 0, "w": 2, "h": 1, "moved": false },
    { "i": "uptime-card", "x": 6, "y": 0, "w": 2, "h": 1, "moved": false },
    
    { "i": "cpu-activity-chart", "x": 0, "y": 1, "w": 4, "h": 2, "moved": false },
    { "i": "cpu-trend-chart", "x": 4, "y": 1, "w": 4, "h": 2, "moved": false },
    
    { "i": "memory-trend-chart", "x": 0, "y": 3, "w": 4, "h": 2, "moved": false },
    { "i": "alerts-panel", "x": 4, "y": 3, "w": 4, "h": 2, "moved": false },
    
    { "i": "containers-table", "x": 0, "y": 4.5, "w": 8, "h": 4, "moved": false }
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
            case 'cpu-trend-chart':
              newComponentStates[item.i] = (item.w === 4 && item.h === 2) ? 'minimized' : 'maximized';
              break;
            case 'memory-trend-chart':
              newComponentStates[item.i] = (item.w === 4 && item.h === 2) ? 'minimized' : 'maximized';
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
          case 'cpu-card':
          case 'memory-card':
          case 'uptime-card':
            updatedItem = {
              ...item,
              w: newState === 'minimized' ? 1 : 2,
              h: 1
            };
            break;
          case 'cpu-activity-chart':
          case 'cpu-trend-chart':
            updatedItem = {
              ...item,
              w: 4,
              h: newState === 'minimized' ? 2 : 4
            };
            break;
          case 'memory-trend-chart':
            updatedItem = {
              ...item,
              w: newState === 'minimized' ? 4 : 8,
              h: 2
            };
            break;
          case 'alerts-panel':
            updatedItem = {
              ...item,
              w: newState === 'minimized' ? 2 : 4,
              h: 2
            };
            break;
          case 'containers-table':
            updatedItem = {
              ...item,
              h: newState === 'minimized' ? 3 : 6
            };
            break;
          default:
            updatedItem = item;
        }
        
        updatedItem.w = Math.max(1, updatedItem.w);
        updatedItem.h = Math.max(1, updatedItem.h);
        
        updatedItem.x = Math.max(0, Math.min(updatedItem.x, 7)); // Max x position for 8 columns grid
        updatedItem.y = Math.max(0, updatedItem.y);
        
        if (updatedItem.x + updatedItem.w > 8) {
          updatedItem.x = Math.max(0, 8 - updatedItem.w);
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

  // Fetch system data
  useEffect(() => {
    let mounted = true;


    const fetchSystemData = async () => {
      try {
        const [sysRes, historyRes, latestSysRes, contRes, evRes] = await Promise.all([
          fetch(`${API_BASE_URL}/system`),
          fetch(`${API_BASE_URL}/system/metrics/history`),
          fetch(`${API_BASE_URL}/system/metrics/latest`),
          fetch(`${API_BASE_URL}/events?_=${Date.now()}`, { cache: "no-store" })
        ]);


        const sysData = sysRes.ok ? await sysRes.json() : null;
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
         
         if (mounted) {
        setSystem(sysData);
        
       }

        }
        const historyData = historyRes.ok ? await historyRes.json() : null;
        if (historyData) {
          if (mounted) {
            setCPUCoreHistory(historyData.cpuCoreHistories || {});
            setSystemMemoryHistory(historyData.memoryHistory || []);
            setSystemCpuHistory(historyData.systemCpuHistory || []);
          }
        }

        if (contRes.ok) {
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
          if (mounted) {
            setEvents(Array.isArray(evData) ? evData : []);
          }
        } else {
          if (mounted) {
            setEvents([]);
          }
        }

      } catch (e) {
      console.error("fetchSystemData error:", e);
      
      } finally {
        if (mounted) {
          setLoadingSys(false);
          setLoadingEvents(false);
        }
      }
    };

    fetchSystemData();
    const iv = setInterval(fetchSystemData, 5000); 

    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);


  // Fetch containers data
  useEffect(() => {
    let mounted = true;


    const fetchContainersData = async () => {
      try {
        const contRes = await fetch(`${API_BASE_URL}/containers?_=${Date.now()}`, { cache: "no-store" });


        if (contRes.ok) {
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
             
              const rawCpu = Number(stats.cpu_percent ?? stats.CPUPercent ?? stats.cpu ?? 0);
              const cpuValue = rawCpu;
             
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


          if (mounted) {
            const updated = mapped.map((c) => {
              const stats = statsResults.find((s) => s && s.id === c.id);
              return stats ? { ...c, ...stats } : c;
            });
            setContainers(updated);
          }
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
        const evRes = await fetch(`${API_BASE_URL}/events?_=${Date.now()}`, { cache: "no-store" });


        if (evRes.ok) {
          const evData = await evRes.json();
          if (mounted) setEvents(Array.isArray(evData) ? evData : []);
        } else {
          if (mounted) setEvents([]);
        }
      } catch (e) {
        console.error("fetchEventsData error:", e);
      } finally {
        if (mounted) setLoadingEvents(false);
      }
    };


    fetchEventsData();
    
  }, []);

  useEffect(() => {
  let mounted = true;
  let lastStatus = null;

  const checkBackend = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/system`, {
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

      <div className="flex justify-start mb-4">
        <button 
          onClick={resetToDefaultLayout}
          className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          Reset Layout
        </button>
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

        <div key="cpu-card" className="bg-white rounded-xl p-4 shadow flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <div className="text-xs text-gray-500">System CPU</div>
            <button 
              onClick={() => toggleComponentState('cpu-card')}
              className="text-xs text-gray-500 hover:text-gray-700 z-10"
            >
              {getButtonIcon('cpu-card')}
            </button>
          </div>
          <div className="flex-grow flex items-center justify-center min-h-[40px]">
            {loadingSys || !system ? (
              <CircleMetric value={0} label="System CPU" size={componentStates['cpu-card'] === 'minimized' ? 32 : 64} />
            ) : (
              <CircleMetric value={Math.round(system?.cpu?.total_percent || 0)} label="System CPU" size={componentStates['cpu-card'] === 'minimized' ? 32 : 64} />
            )}
          </div>
        </div>

        <div key="memory-card" className="bg-white rounded-xl p-4 shadow flex flex-col h-full">
          <div className="flex justify-between items-start">
            <div className="text-xs text-gray-500">Memory</div>
            <button 
              onClick={() => toggleComponentState('memory-card')}
              className="text-xs text-gray-500 hover:text-gray-700 z-10"
            >
              {getButtonIcon('memory-card')}
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
                <div 
                  className="h-2 bg-[#2496ED]" 
                  style={{ width: `${loadingSys || !system ? 0 : memPct}%` }} 
                />
              </div>
            </div>
          </div>
        </div>

        <div key="uptime-card" className="bg-white rounded-xl p-4 shadow flex flex-col h-full">
          <div className="flex justify-between items-start">
            <div className="text-xs text-gray-500">Uptime</div>
            <button 
              onClick={() => toggleComponentState('uptime-card')}
              className="text-xs text-gray-500 hover:text-gray-700 z-10"
            >
              {getButtonIcon('uptime-card')}
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


      {/* CPU ACTIVITY (PER CORE) */}
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

        <div className="flex-grow overflow-y-auto min-h-[150px] space-y-3">
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
                  <div className="w-12 text-right text-xs font-medium">{Math.round(displayValue)}%</div>
                </div>
              );
            })
          ) : (
            <div className="text-xs text-gray-500">No per-core data.</div>
          )}
        </div>
      </div>

      {/* CPU TREND */}
      
        <div key="cpu-trend-chart" className="bg-white rounded-2xl shadow p-3 flex flex-col h-full">

          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">CPU trend (selected cores)</div>
            <div className="flex items-center gap-2">
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
          <div className="flex-grow min-h-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cpuTrendSeries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" stroke="#888" tick={{ fontSize: 12 }} />
                <YAxis stroke="#888" domain={[0, 100]} tick={{ fontSize: 12 }} width={30} />
                <Tooltip formatter={(value, name) => [`${Math.round(value)}%`, name]} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {selectedCores.systemCpu && (
                  <Line
                    type="monotone"
                    dataKey="System CPU"
                    stroke="#ff6b6b"
                    dot={false}
                    strokeWidth={2}
                  />
                )}
                {system?.cpu?.per_core?.map((_, coreIdx) =>
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


      {/* Memory trend */}
      <div key="memory-trend-chart" className="bg-white rounded-2xl shadow p-3 flex flex-col h-full">
        <div className="flex justify-between items-start mb-2">
          <div className="text-sm font-medium">System Memory trend</div>
          <button 
            onClick={() => toggleComponentState('memory-trend-chart')}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            {getButtonIcon('memory-trend-chart')}
          </button>
        </div>
        {loadingSys || !system ? (
          <div className="flex items-center justify-center flex-grow text-gray-500">
            Loading memory trend data...
          </div>
        ) : (
          <ChartCard
            title="System Memory trend"
            data={memoryTrendSeries}
            type="area"
            showTitle={false}
          />
        )}
      </div>

      {/* Alerts panel */}
      <div key="alerts-panel" className="bg-white rounded-2xl shadow p-4 flex flex-col h-full">
        <div className="flex justify-between items-start mb-3">
          <div className="text-sm font-medium">Alerts & Recent Events</div>
          <button 
            onClick={() => toggleComponentState('alerts-panel')}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            {getButtonIcon('alerts-panel')}
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


      {/* Containers table */}
      <div key="containers-table" className="bg-white rounded-2xl shadow p-4 h-full flex flex-col">
        <div className="flex justify-between items-start mb-3">
          <div className="text-sm font-medium">Containers</div>
          <button 
            onClick={() => toggleComponentState('containers-table')}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            {getButtonIcon('containers-table')}
          </button>
        </div>
        {loadingContainers ? (
          <div className="flex items-center justify-center flex-grow text-gray-500">
            Loading containers...
          </div>
        ) : (
          <div className="flex-grow overflow-y-auto">
            <ContainersTable containers={containers} />
          </div>
        )}
      </div>
    </GridLayout>
    </div>
  );
});


export default Dashboard;