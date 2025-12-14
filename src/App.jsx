import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  AlertTriangle, CheckCircle2, Battery, Thermometer, Zap, TrendingUp, 
  Calendar, Loader2, Cpu, Activity, Navigation, Timer
} from 'lucide-react';

const BatteryDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [snapshots657, setSnapshots657] = useState([]);
  const [snapshots366, setSnapshots366] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIMEI, setSelectedIMEI] = useState("865044073967657");
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [tempSamplingRate, setTempSamplingRate] = useState("5deg");

  // --- 1. DATA LOADING ---
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch Summary
        const summaryRes = await fetch('/summary.json');
        if (!summaryRes.ok) throw new Error('Failed to load summary.json');
        const summaryData = await summaryRes.json();
        setSummary(summaryData);

        // Fetch Battery 1 (Stationary)
        const snapshots657Res = await fetch('/865044073967657_snapshots.json');
        if (!snapshots657Res.ok) throw new Error('Failed to load 865044073967657_snapshots.json');
        const snapshots657Data = await snapshots657Res.json();
        setSnapshots657(snapshots657Data.data || []);

        // Fetch Battery 2 (EV)
        const snapshots366Res = await fetch('/865044073949366_snapshots.json');
        if (!snapshots366Res.ok) throw new Error('Failed to load 865044073949366_snapshots.json');
        const snapshots366Data = await snapshots366Res.json();
        setSnapshots366(snapshots366Data.data || []);

        setLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // --- 2. DATA PROCESSING & SORTING ---
  const batteryType = selectedIMEI === "865044073967657" ? "Stationary Storage" : "Electric Vehicle";
  const batteryInfo = summary?.summary?.find(b => b.imei === selectedIMEI);
  
  // Prepare and Sort Snapshots (Cycle 0 -> Latest)
  // This is CRITICAL for the slider to work linearly
  const sortedSnapshots = useMemo(() => {
    const rawData = selectedIMEI === "865044073967657" ? snapshots657 : snapshots366;
    if (!rawData) return [];
    return [...rawData].sort((a, b) => a.cycle_number - b.cycle_number);
  }, [selectedIMEI, snapshots657, snapshots366]);

  // --- 3. CYCLE SELECTION STATE ---
  // Default to the latest cycle (last item in sorted list) when battery changes
  useEffect(() => {
    if (sortedSnapshots.length > 0 && selectedCycle === null) {
      setSelectedCycle(sortedSnapshots[sortedSnapshots.length - 1].cycle_number);
    }
  }, [sortedSnapshots, selectedCycle]);

  // Find the INDEX of the currently selected cycle
  // This connects the "Cycle Number" (e.g. 118) to the "Slider Position" (e.g. index 112)
  const currentSliderIndex = useMemo(() => {
    return sortedSnapshots.findIndex(s => s.cycle_number === selectedCycle);
  }, [selectedCycle, sortedSnapshots]);

  const currentCycleData = selectedCycle !== null 
    ? sortedSnapshots.find(s => s.cycle_number === selectedCycle) 
    : null;

  // Handle Slider Movement
  const handleSliderChange = (e) => {
    const newIndex = parseInt(e.target.value, 10);
    // Safety check
    if (newIndex >= 0 && newIndex < sortedSnapshots.length) {
      setSelectedCycle(sortedSnapshots[newIndex].cycle_number);
    }
  };

  // --- 4. CHART DATA PREPARATION ---
  const temperatureData = useMemo(() => {
    if (!currentCycleData) return [];
    const distKey = `temperature_dist_${tempSamplingRate}`;
    const dist = currentCycleData[distKey] || {};
    return Object.entries(dist)
      .filter(([_, value]) => value > 0)
      .map(([range, hours]) => ({ range, hours: parseFloat(hours.toFixed(2)) }))
      .sort((a, b) => {
        const aStart = parseInt(a.range.split('-')[0]) || 0;
        const bStart = parseInt(b.range.split('-')[0]) || 0;
        return aStart - bStart;
      });
  }, [currentCycleData, tempSamplingRate]);

  const sohTrendData = useMemo(() => {
    // Already sorted above
    return sortedSnapshots.map(s => ({
      cycle: s.cycle_number,
      soh: s.average_soh,
      soc: s.average_soc
    }));
  }, [sortedSnapshots]);

  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // --- 5. RENDER ---
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-yellow-400" />
          <p className="font-mono text-sm tracking-widest uppercase">Initializing Zenfinity Analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="bg-red-950/20 border border-red-900/50 p-8 rounded-lg max-w-md text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold text-red-400 mb-2">Connection Failed</h2>
          <p className="text-zinc-400 mb-6">{error || "Data stream unavailable. Please check API connection."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-200 font-sans selection:bg-yellow-500/30 selection:text-yellow-200">
      
      {/* --- NAVBAR --- */}
      <nav className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            {/* Tries to load logo.png, falls back to text icon if missing */}
            <img 
              src="/logo.png" 
              alt="Zenfinity Logo" 
              className="h-10 w-auto object-contain"
              onError={(e) => {
                e.target.style.display = 'none'; // Hide broken image
                e.target.nextSibling.style.display = 'flex'; // Show fallback
              }} 
            />
            {/* Fallback Logo (Hidden if image loads) */}
            <div className="hidden h-8 w-8 bg-yellow-400 rounded-lg items-center justify-center text-zinc-950 font-bold text-xl">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            
            <div className="flex flex-col leading-none ml-1">
              <span className="font-bold text-lg tracking-wide text-yellow-400">ZENFINITY</span>
              <span className="text-[10px] bg-white text-zinc-950 px-1 font-bold tracking-[0.2em] w-full text-center">ENERGY</span>
            </div>
          </div>
          
          {/* Controls & Status */}
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 text-xs font-mono text-emerald-500 bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-900/50">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              SYSTEM ONLINE
            </div>
            <div className="h-8 w-px bg-zinc-800"></div>
            <select 
              value={selectedIMEI}
              onChange={(e) => {
                setSelectedIMEI(e.target.value);
                setSelectedCycle(null);
              }}
              className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-4 py-2 focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition-all hover:border-zinc-500 cursor-pointer"
            >
              <option value="865044073967657">Pack 657 (Stationary)</option>
              <option value="865044073949366">Pack 366 (Electric Vehicle)</option>
            </select>
          </div>
        </div>
      </nav>

      <main className="max-w-[1920px] mx-auto px-6 py-8 space-y-6">
        
        {/* --- HEADER & OVERVIEW STATS --- */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Context Card */}
          <div className="xl:col-span-1 bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="text-zinc-500 text-xs font-mono uppercase tracking-wider mb-1">Active Asset</div>
              <h1 className="text-2xl font-light text-white">{batteryType}</h1>
              <div className="flex items-center gap-2 mt-2 text-emerald-400 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Monitoring Active</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-zinc-800">
               <div className="flex justify-between items-end">
                 <span className="text-zinc-500 text-sm">Total Cycles Recorded</span>
                 <span className="text-3xl font-bold text-white">{batteryInfo?.total_cycles || 0}</span>
               </div>
            </div>
          </div>

          {/* KPI Cards */}
          <StatCard 
            label="Avg Health (SOH)" 
            value={`${batteryInfo?.avg_soh_across_cycles.toFixed(1) || 0}%`} 
            icon={<Activity className="w-5 h-5" />} 
            color="text-emerald-400"
            borderColor="border-emerald-500/20"
          />
          <StatCard 
            label="Avg Temperature" 
            value={`${batteryInfo?.avg_temp_across_cycles.toFixed(1) || 0}°C`} 
            icon={<Thermometer className="w-5 h-5" />} 
            color="text-amber-400"
            borderColor="border-amber-500/20"
          />
          <StatCard 
            label="Charging Events" 
            value={batteryInfo?.total_charging_instances || 0} 
            icon={<Zap className="w-5 h-5" />} 
            color="text-yellow-400"
            borderColor="border-yellow-500/20"
          />
        </div>

        {/* --- CYCLE NAVIGATION SLIDER (FIXED: INDEX BASED) --- */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 w-full">
              <div className="flex justify-between text-xs font-mono text-zinc-500 mb-3 uppercase tracking-wider">
                {/* Labels show the ACTUAL cycle numbers, but slider uses index */}
                <span>First Recorded (Cycle {sortedSnapshots[0]?.cycle_number})</span>
                <span>Most Recent (Cycle {sortedSnapshots[sortedSnapshots.length-1]?.cycle_number})</span>
              </div>
              
              {/* SLIDER INPUT: Uses array index (0 to length-1) to guarantee valid data selection */}
              <input 
                type="range" 
                min={0} 
                max={sortedSnapshots.length - 1} 
                value={currentSliderIndex !== -1 ? currentSliderIndex : sortedSnapshots.length - 1} 
                onChange={handleSliderChange}
                className="w-full h-3 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-yellow-400 hover:accent-yellow-300 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400/20"
              />
            </div>
            
            <div className="flex flex-col items-center justify-center bg-zinc-950 border border-zinc-800 rounded-lg px-6 py-3 min-w-[140px] shadow-inner">
              <span className="text-xs text-zinc-500 uppercase font-mono mb-1">Selected Cycle</span>
              <span className="text-3xl font-bold text-yellow-400 tabular-nums">{selectedCycle}</span>
            </div>
          </div>
        </div>

        {currentCycleData ? (
          <div className="space-y-6">
            
            {/* --- CYCLE STATISTICS --- */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 backdrop-blur-sm">
              <DataPoint label="Start Time" value={formatDateTime(currentCycleData.cycle_start_time)} icon={<Calendar className="w-4 h-4" />} />
              <DataPoint label="End Time" value={formatDateTime(currentCycleData.cycle_end_time)} icon={<Calendar className="w-4 h-4" />} />
              <DataPoint label="Duration" value={`${currentCycleData.cycle_duration_hours.toFixed(1)} hrs`} icon={<Timer className="w-4 h-4" />} highlight />
              <DataPoint label="SOH Drop" value={`${currentCycleData.soh_drop.toFixed(2)}%`} icon={<TrendingUp className="w-4 h-4" />} color="text-red-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* --- LEFT COLUMN: METRICS & HEALTH --- */}
              <div className="space-y-6">
                {/* Performance Metrics */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-emerald-500" /> Performance
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                      <span className="text-zinc-400 text-sm">Total Distance</span>
                      <span className="text-xl font-bold text-white">{currentCycleData.total_distance.toFixed(1)} km</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                        <span className="text-zinc-500 text-xs block mb-1">Avg Speed</span>
                        <span className="text-lg font-bold text-white">{currentCycleData.average_speed.toFixed(1)} <span className="text-xs font-normal text-zinc-500">km/h</span></span>
                      </div>
                      <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                        <span className="text-zinc-500 text-xs block mb-1">Max Speed</span>
                        <span className="text-lg font-bold text-white">{currentCycleData.max_speed} <span className="text-xs font-normal text-zinc-500">km/h</span></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Battery Health */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Battery className="w-4 h-4 text-emerald-500" /> Battery Health
                  </h3>
                  
                  {/* SOC Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1 text-zinc-400">
                      <span>Avg SOC</span>
                      <span className="text-white font-bold">{currentCycleData.average_soc.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${currentCycleData.average_soc}%` }}></div>
                    </div>
                  </div>

                  {/* SOH Bar */}
                  <div className="mb-6">
                    <div className="flex justify-between text-xs mb-1 text-zinc-400">
                      <span>Avg SOH</span>
                      <span className="text-emerald-400 font-bold">{currentCycleData.average_soh.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2">
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${currentCycleData.average_soh}%` }}></div>
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                    <div className="text-zinc-500 text-xs mb-2">Voltage Range</div>
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-xs text-zinc-600">MIN</span>
                        <div className="text-white font-mono">{currentCycleData.voltage_min.toFixed(2)}V</div>
                      </div>
                      <div className="h-px bg-zinc-800 flex-1 mx-3 mb-2"></div>
                      <div className="text-right">
                        <span className="text-xs text-zinc-600">MAX</span>
                        <div className="text-white font-mono">{currentCycleData.voltage_max.toFixed(2)}V</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- CENTER/RIGHT: CHARTS --- */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Temperature Distribution */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-amber-500" /> Thermal Distribution
                    </h3>
                    <select 
                      value={tempSamplingRate}
                      onChange={(e) => setTempSamplingRate(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded px-2 py-1 outline-none focus:border-yellow-400 cursor-pointer"
                    >
                      <option value="5deg">5°C Step</option>
                      <option value="10deg">10°C Step</option>
                      <option value="15deg">15°C Step</option>
                      <option value="20deg">20°C Step</option>
                    </select>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={temperatureData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis dataKey="range" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                          cursor={{ fill: '#27272a' }}
                          contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', color: '#f4f4f5' }}
                        />
                        <Bar dataKey="hours" fill="#fbbf24" radius={[4, 4, 0, 0]} maxBarSize={60} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Alerts & Charging Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Alerts */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" /> System Alerts
                    </h3>
                    {(!currentCycleData.alert_details?.warnings?.length && !currentCycleData.alert_details?.protections?.length) ? (
                      <div className="flex items-center gap-3 bg-emerald-950/20 border border-emerald-900/30 p-4 rounded-lg h-24">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        <div>
                          <div className="text-emerald-400 font-medium">Optimal Operation</div>
                          <div className="text-emerald-500/60 text-xs">No faults detected</div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-24 overflow-y-auto">
                        {currentCycleData.alert_details?.warnings?.map((w, i) => (
                          <div key={i} className="bg-amber-950/20 border border-amber-900/30 p-2 rounded text-amber-200 text-xs flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3" /> {w}
                          </div>
                        ))}
                        {currentCycleData.alert_details?.protections?.map((p, i) => (
                          <div key={i} className="bg-red-950/20 border border-red-900/30 p-2 rounded text-red-200 text-xs flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3" /> {p}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Charging Insights */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" /> Charging Insights
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                        <div className="text-zinc-500 text-xs mb-1">Sessions</div>
                        <div className="text-2xl font-bold text-white">{currentCycleData.charging_instances_count}</div>
                      </div>
                      <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                        <div className="text-zinc-500 text-xs mb-1">Avg Start SOC</div>
                        <div className="text-2xl font-bold text-yellow-400">{currentCycleData.average_charge_start_soc?.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl text-zinc-500 bg-zinc-900/20">
            <Cpu className="w-12 h-12 mb-4 opacity-50" />
            <p>Select a cycle from the slider above to inspect detailed telemetry.</p>
          </div>
        )}

        {/* --- LONG TERM TRENDS --- */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Lifecycle Degradation Analysis (SOH vs SOC)
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sohTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="cycle" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'Cycle Number', position: 'insideBottom', offset: -5, fill: '#71717a', fontSize: 10 }} />
                <YAxis stroke="#71717a" domain={[0, 100]} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', color: '#f4f4f5' }}
                  itemStyle={{ fontSize: '12px' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Line type="monotone" dataKey="soh" stroke="#10b981" name="State of Health (%)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="soc" stroke="#3b82f6" name="Avg SOC (%)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} strokeOpacity={0.6} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </main>
    </div>
  );
};

// --- HELPER COMPONENTS ---

const StatCard = ({ label, value, icon, color = "text-white", borderColor = "border-zinc-800" }) => (
  <div className={`xl:col-span-1 bg-zinc-900 border ${borderColor} rounded-xl p-5 flex items-center justify-between shadow-sm hover:border-zinc-600 transition-colors`}>
    <div>
      <div className="text-zinc-500 text-xs font-mono uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
    <div className={`p-3 rounded-full bg-zinc-950 border border-zinc-800 ${color} opacity-80`}>
      {icon}
    </div>
  </div>
);

const DataPoint = ({ label, value, icon, highlight = false, color = "text-white" }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase tracking-wide">
      {icon} {label}
    </div>
    <div className={`font-mono font-medium ${highlight ? 'text-yellow-400 text-lg' : color}`}>
      {value}
    </div>
  </div>
);

export default BatteryDashboard;