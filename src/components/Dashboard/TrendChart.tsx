import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const CARD   = '#ffffff';
const PAGE   = '#f4f6f9';
const BORDER = '#e2e8f0';
const T1     = '#111827';
const T2     = '#6b7280';
const T3     = '#9ca3af';
const RED    = '#dc2626';
const GREEN  = '#16a34a';

const HOURLY = [
  { hour: '06', cases: 198, util: 72, congestion: 45, recv: 18, ship: 12 },
  { hour: '07', cases: 243, util: 78, congestion: 71, recv: 24, ship: 19 },
  { hour: '08', cases: 267, util: 82, congestion: 67, recv: 31, ship: 22 },
  { hour: '09', cases: 221, util: 74, congestion: 52, recv: 26, ship: 28 },
  { hour: '10', cases: 285, util: 88, congestion: 38, recv: 29, ship: 34 },
  { hour: '11', cases: 201, util: 65, congestion: 42, recv: 14, ship: 30 },
  { hour: '12', cases: 234, util: 79, congestion: 44, recv: 19, ship: 38 },
  { hour: '13', cases: 198, util: 71, congestion: 35, recv: 11, ship: 41 },
];

const SPEED_DATA = [
  { name: 'FL-1 Rivera',   avg: 4.8, max: 6.2, idle: 0.9 },
  { name: 'FL-2 Chen',     avg: 2.1, max: 4.1, idle: 3.1 },
  { name: 'FL-3 Kim',      avg: 3.6, max: 5.8, idle: 1.6 },
  { name: 'PJ-1 Williams', avg: 3.9, max: 5.1, idle: 1.2 },
  { name: 'PJ-2 Patel',    avg: 3.2, max: 4.7, idle: 2.1 },
];

const BATTERY_DATA = [
  { hour: '06', fl1: 96, fl2: 94, fl3: 98, pj1: 100, pj2: 95 },
  { hour: '07', fl1: 88, fl2: 89, fl3: 91, pj1: 93,  pj2: 88 },
  { hour: '08', fl1: 79, fl2: 84, fl3: 83, pj1: 86,  pj2: 80 },
  { hour: '09', fl1: 68, fl2: 78, fl3: 74, pj1: 78,  pj2: 71 },
  { hour: '10', fl1: 57, fl2: 73, fl3: 64, pj1: 69,  pj2: 61 },
  { hour: '11', fl1: 81, fl2: 67, fl3: 55, pj1: 59,  pj2: 30 },
  { hour: '12', fl1: 74, fl2: 61, fl3: 44, pj1: 72,  pj2: 62 },
  { hour: '13', fl1: 63, fl2: 55, fl3: 35, pj1: 64,  pj2: 54 },
];

const DISTANCE_DATA = [
  { name: 'FL-1 Rivera',   pick: 3840, travel: 5120, idle: 640  },
  { name: 'FL-2 Chen',     pick: 1680, travel: 2240, idle: 5280 },
  { name: 'FL-3 Kim',      pick: 2880, travel: 3360, idle: 1920 },
  { name: 'PJ-1 Williams', pick: 4320, travel: 2880, idle: 960  },
  { name: 'PJ-2 Patel',    pick: 2640, travel: 3200, idle: 2160 },
];

const ZONE_DATA = [
  { zone: 'Receiving',  h0: 8, h1: 6, h2: 4, h3: 3, h4: 2, h5: 2, h6: 1, h7: 1 },
  { zone: 'Put-Away',   h0: 6, h1: 5, h2: 4, h3: 3, h4: 3, h5: 2, h6: 2, h7: 1 },
  { zone: 'Zone A',     h0: 4, h1: 7, h2: 8, h3: 7, h4: 8, h5: 5, h6: 6, h7: 5 },
  { zone: 'Zone B',     h0: 3, h1: 5, h2: 6, h3: 5, h4: 6, h5: 4, h6: 5, h7: 4 },
  { zone: 'Pick Lane',  h0: 5, h1: 8, h2: 9, h3: 8, h4: 9, h5: 6, h6: 7, h7: 6 },
  { zone: 'Aisle 1',   h0: 6, h1: 9, h2: 8, h3: 5, h4: 5, h5: 4, h6: 4, h7: 3 },
];

const WEEKLY = [
  { day: 'Mon 6/9',  cases: 2240, util: 81, congestion: 44 },
  { day: 'Tue 6/10', cases: 2180, util: 79, congestion: 51 },
  { day: 'Wed 6/11', cases: 2310, util: 83, congestion: 39 },
  { day: 'Thu 6/12', cases: 1960, util: 72, congestion: 58 },
  { day: 'Fri 6/13', cases: 2390, util: 86, congestion: 36 },
  { day: 'Sat 6/14', cases: 1840, util: 68, congestion: 62 },
  { day: 'Today',    cases: 1847, util: 71, congestion: 67 },
];

function heatColor(v: number) {
  if (v <= 2) return '#f0f9ff';
  if (v <= 4) return '#bfdbfe';
  if (v <= 6) return '#fde68a';
  if (v <= 8) return '#fb923c';
  return '#dc2626';
}

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T1, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ fontSize: 11, color: T2, marginBottom: 2 }}>
          {p.name}: <span style={{ fontWeight: 700, color: T1 }}>{p.value}{p.name?.includes('%') ? '%' : ''}</span>
        </div>
      ))}
    </div>
  );
};

export function TrendChart({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={HOURLY} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#111827" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#111827" stopOpacity={0}    />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
          <XAxis dataKey="hour" tick={{ fill: T3, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={h => `${h}h`} />
          <YAxis tick={{ fill: T3, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip content={<Tip />} />
          <ReferenceLine y={250} stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Target', fill: T3, fontSize: 10 }} />
          <Area type="monotone" dataKey="cases" stroke="#111827" strokeWidth={2} fill="url(#cg)" name="Cases" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Row 1: Throughput + Dock Activity side by side ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Cases Picked / Hour" sub="Hourly throughput vs 250-case target">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={HOURLY} margin={{ top: 8, right: 4, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#111827" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#111827" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
              <XAxis dataKey="hour" tick={{ fill: T3, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={h => `${h}h`} />
              <YAxis tick={{ fill: T3, fontSize: 11 }} axisLine={false} tickLine={false} width={34} />
              <Tooltip content={<Tip />} />
              <ReferenceLine y={250} stroke="#e5e7eb" strokeDasharray="5 3" label={{ value: 'Target 250', fill: T3, fontSize: 10 }} />
              <Area type="monotone" dataKey="cases" stroke="#111827" strokeWidth={2.5} fill="url(#g1)" name="Cases" dot={{ fill: '#111827', r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Dock Throughput / Hour" sub="Pallets received vs shipped per hour">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={HOURLY} barGap={3} margin={{ top: 8, right: 4, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
              <XAxis dataKey="hour" tick={{ fill: T3, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={h => `${h}h`} />
              <YAxis tick={{ fill: T3, fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="recv" fill="#3b82f6" name="Received" radius={[3,3,0,0]} maxBarSize={14} />
              <Bar dataKey="ship" fill="#10b981" name="Shipped"  radius={[3,3,0,0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'flex-end' }}>
            <LegendDot color="#3b82f6" label="Received" />
            <LegendDot color="#10b981" label="Shipped" />
          </div>
        </Card>
      </div>

      {/* ── Row 2: Utilization vs Congestion + Battery ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Utilization vs Congestion" sub="Fleet utilization % and congestion level by hour">
          <ResponsiveContainer width="100%" height={175}>
            <BarChart data={HOURLY} barGap={4} margin={{ top: 8, right: 4, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
              <XAxis dataKey="hour" tick={{ fill: T3, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={h => `${h}h`} />
              <YAxis tick={{ fill: T3, fontSize: 11 }} axisLine={false} tickLine={false} width={34} domain={[0, 100]} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="util"       fill="#374151" name="Util %"  radius={[3,3,0,0]} maxBarSize={18} />
              <Bar dataKey="congestion" fill="#d1d5db" name="Cong %"  radius={[3,3,0,0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'flex-end' }}>
            <LegendDot color="#374151" label="Utilization %" />
            <LegendDot color="#d1d5db" label="Congestion %" />
          </div>
        </Card>

        <Card title="Battery Discharge by Equipment" sub="State of charge (%) across shift hours">
          <ResponsiveContainer width="100%" height={175}>
            <LineChart data={BATTERY_DATA} margin={{ top: 8, right: 4, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
              <XAxis dataKey="hour" tick={{ fill: T3, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={h => `${h}h`} />
              <YAxis tick={{ fill: T3, fontSize: 11 }} axisLine={false} tickLine={false} width={30} domain={[20, 100]} />
              <Tooltip content={<Tip />} />
              <ReferenceLine y={30} stroke="#fca5a5" strokeDasharray="4 3" label={{ value: 'Low', fill: '#dc2626', fontSize: 9 }} />
              <Line type="monotone" dataKey="fl1" stroke="#f5c518" strokeWidth={2} dot={false} name="FL-1" />
              <Line type="monotone" dataKey="fl2" stroke="#e8a000" strokeWidth={2} dot={false} name="FL-2" />
              <Line type="monotone" dataKey="fl3" stroke="#d49000" strokeWidth={2} dot={false} name="FL-3" />
              <Line type="monotone" dataKey="pj1" stroke="#cc2200" strokeWidth={2} dot={false} name="PJ-1" />
              <Line type="monotone" dataKey="pj2" stroke="#aa1a00" strokeWidth={2} dot={false} name="PJ-2" strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {[['#f5c518','FL-1'],['#e8a000','FL-2'],['#d49000','FL-3'],['#cc2200','PJ-1'],['#aa1a00','PJ-2']].map(([c,l]) => (
              <LegendDot key={l} color={c} label={l} />
            ))}
          </div>
        </Card>
      </div>

      {/* ── Row 3: Equipment Cycles + Speed ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Equipment Cycles vs Daily Target" sub="Completed pick/put cycles — target marker shown">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { id: 'FL-1', name: 'Mark Rivera',   cycles: 38, target: 32 },
              { id: 'FL-2', name: 'James Chen',    cycles: 21, target: 32 },
              { id: 'FL-3', name: 'Sarah Kim',     cycles: 29, target: 32 },
              { id: 'PJ-1', name: 'Deon Williams', cycles: 45, target: 40 },
              { id: 'PJ-2', name: 'Priya Patel',   cycles: 35, target: 40 },
            ].map(eq => {
              const miss = eq.cycles < eq.target;
              const pct  = (eq.cycles / 50) * 100;
              const tpct = (eq.target / 50) * 100;
              return (
                <div key={eq.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T3, width: 36, flexShrink: 0 }}>{eq.id}</span>
                  <span style={{ fontSize: 12, color: T2, width: 100, flexShrink: 0 }}>{eq.name}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#f0f2f5', position: 'relative' }}>
                    <div style={{ height: 8, borderRadius: 4, width: `${pct}%`, background: miss ? RED : '#111827' }} />
                    <div style={{ position: 'absolute', top: -2, bottom: -2, width: 2, left: `${tpct}%`, background: '#6b7280', borderRadius: 1 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 70, flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: miss ? RED : '#111827' }}>{eq.cycles}</span>
                    <span style={{ fontSize: 11, color: T3 }}>/ {eq.target}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Avg Speed & Idle Time by Operator" sub="Travel speed (mph) and unproductive idle hours">
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={SPEED_DATA} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" horizontal={false} />
              <XAxis type="number" tick={{ fill: T3, fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 7]} unit=" mph" />
              <YAxis dataKey="name" type="category" tick={{ fill: T2, fontSize: 10 }} axisLine={false} tickLine={false} width={88} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="avg"  fill="#374151" name="Avg mph"  radius={[0,3,3,0]} maxBarSize={12} />
              <Bar dataKey="max"  fill="#d1d5db" name="Max mph"  radius={[0,3,3,0]} maxBarSize={12} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
            <LegendDot color="#374151" label="Avg speed" />
            <LegendDot color="#d1d5db" label="Max speed" />
          </div>
        </Card>
      </div>

      {/* ── Row 4: Zone Heatmap (full width) ── */}
      <Card title="Zone Activity Heatmap" sub="Congestion level per zone by hour (0 = clear, 10 = blocked)">
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6, paddingLeft: 80 }}>
            {['6h','7h','8h','9h','10h','11h','12h','13h'].map(h => (
              <div key={h} style={{ width: 36, textAlign: 'center', fontSize: 10, color: T3 }}>{h}</div>
            ))}
          </div>
          {ZONE_DATA.map(row => (
            <div key={row.zone} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <div style={{ width: 76, fontSize: 11, textAlign: 'right', paddingRight: 8, color: T2, flexShrink: 0 }}>{row.zone}</div>
              {[row.h0,row.h1,row.h2,row.h3,row.h4,row.h5,row.h6,row.h7].map((v, i) => (
                <div key={i} style={{
                  width: 36, height: 28, borderRadius: 4,
                  background: heatColor(v),
                  border: `1px solid ${BORDER}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: v > 6 ? '#fff' : '#6b7280' }}>{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 10, color: T3 }}>Low</span>
          {['#f0f9ff','#bfdbfe','#fde68a','#fb923c','#dc2626'].map(c => (
            <div key={c} style={{ width: 20, height: 14, borderRadius: 3, background: c, border: `1px solid ${BORDER}` }} />
          ))}
          <span style={{ fontSize: 10, color: T3 }}>High</span>
        </div>
      </Card>

      {/* ── Row 5: Travel Distance breakdown + Operator detail table ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Travel Distance Breakdown" sub="Feet traveled: productive pick, travel, and idle (shift total)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            {DISTANCE_DATA.map(d => {
              const total = d.pick + d.travel + d.idle;
              const pickPct  = (d.pick  / total) * 100;
              const travelPct = (d.travel / total) * 100;
              const idlePct  = (d.idle  / total) * 100;
              return (
                <div key={d.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: T1 }}>{d.name}</span>
                    <span style={{ fontSize: 11, color: T3 }}>{(total / 5280).toFixed(1)} mi total</span>
                  </div>
                  <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 1 }}>
                    <div style={{ width: `${pickPct}%`,   background: '#111827', transition: 'width 0.4s' }} />
                    <div style={{ width: `${travelPct}%`, background: '#9ca3af', transition: 'width 0.4s' }} />
                    <div style={{ width: `${idlePct}%`,  background: '#fde68a', transition: 'width 0.4s' }} />
                  </div>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
              <LegendDot color="#111827" label="Pick/Put" />
              <LegendDot color="#9ca3af" label="Travel" />
              <LegendDot color="#fde68a" label="Idle" />
            </div>
          </div>
        </Card>

        <Card title="Operator Detail Stats" sub="Full breakdown: idle time, cycles, distance, battery">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Operator','Cycles','Idle h','Dist mi','Batt %'].map(h => (
                  <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase', borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Rivera', cycles: 38, idle: 0.9, dist: 1.74, batt: 63, ok: true  },
                { name: 'Chen',   cycles: 21, idle: 3.1, dist: 0.74, batt: 55, ok: false },
                { name: 'Kim',    cycles: 29, idle: 1.6, dist: 1.19, batt: 35, ok: true  },
                { name: 'Williams',cycles:45, idle: 1.2, dist: 1.74, batt: 64, ok: true  },
                { name: 'Patel',  cycles: 35, idle: 2.1, dist: 1.48, batt: 54, ok: true  },
              ].map((r, i) => (
                <tr key={r.name} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? CARD : PAGE }}>
                  <td style={{ padding: '9px 8px', fontSize: 12, fontWeight: 600, color: T1 }}>{r.name}</td>
                  <td style={{ padding: '9px 8px', fontSize: 12, color: r.ok ? T1 : RED, fontWeight: r.ok ? 400 : 700 }}>{r.cycles}</td>
                  <td style={{ padding: '9px 8px', fontSize: 12, color: r.idle > 2 ? RED : T2 }}>{r.idle}h</td>
                  <td style={{ padding: '9px 8px', fontSize: 12, color: T2 }}>{r.dist}</td>
                  <td style={{ padding: '9px 8px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: r.batt < 40 ? RED : T1 }}>{r.batt}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* ── Row 6: 7-day weekly comparison ── */}
      <Card title="7-Day Performance Comparison" sub="Cases picked, fleet utilization, and congestion score — last 7 shifts">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 90px 90px 90px', gap: 0, borderBottom: `1px solid ${BORDER}`, padding: '8px 12px' }}>
            {['Shift Date', 'Throughput', 'Cases', 'Util %', 'Cong.'].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: T3, textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>
          {WEEKLY.map((w, i) => {
            const isToday = w.day === 'Today';
            const prevCases = i > 0 ? WEEKLY[i - 1].cases : null;
            const delta = prevCases !== null ? w.cases - prevCases : null;
            const Icon = delta === null ? null : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
            const barPct = (w.cases / 2500) * 100;
            return (
              <div key={w.day} style={{
                display: 'grid', gridTemplateColumns: '120px 1fr 90px 90px 90px', gap: 0,
                padding: '10px 12px', borderBottom: `1px solid ${BORDER}`,
                background: isToday ? '#fffbeb' : i % 2 === 0 ? CARD : PAGE,
              }}>
                <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? '#92400e' : T1 }}>
                  {w.day}{isToday && <span style={{ fontSize: 10, color: '#d97706', marginLeft: 6 }}>← TODAY</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#f0f2f5' }}>
                    <div style={{ height: 6, borderRadius: 3, width: `${barPct}%`, background: isToday ? '#d97706' : '#374151' }} />
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T1, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {w.cases.toLocaleString()}
                  {Icon && <Icon size={11} color={delta! > 0 ? GREEN : delta! < 0 ? RED : T3} />}
                </div>
                <div style={{ fontSize: 12, color: w.util < 75 ? RED : T2 }}>{w.util}%</div>
                <div style={{ fontSize: 12, color: w.congestion > 55 ? RED : T2 }}>{w.congestion}</div>
              </div>
            );
          })}
        </div>
      </Card>

    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T1, marginBottom: 3 }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: T3 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
      <span style={{ fontSize: 11, color: T2 }}>{label}</span>
    </div>
  );
}
