import { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Layers } from 'lucide-react';
import { useSimulationStore } from '../../store/simulationStore';
import { SHIFT_DATA } from '../../data/mockTelemetry';
import { getEventsForTimeline } from '../../data/shiftEvents';

const CARD   = '#ffffff';
const BORDER = '#e2e8f0';
const PAGE   = '#f4f6f9';
const T1     = '#111827';
const T2     = '#6b7280';
const T3     = '#9ca3af';

function fmtTime(ms: number): string {
  const s  = Math.floor(ms / 1000);
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(6 + h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

const SPEEDS = [1, 10, 30, 60, 120, 300];

const SHOW_BEFORE = 120_000;
const SHOW_AFTER  = 480_000;

export function SimulationControls() {
  const {
    currentTime, isPlaying, playbackSpeed, showHeatmap, improvementScenario,
    setCurrentTime, setPlaying, setPlaybackSpeed, setShowHeatmap,
  } = useSimulationStore();

  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);

  const pct    = (currentTime / SHIFT_DATA.shiftDuration) * 100;
  const events = getEventsForTimeline(improvementScenario);

  return (
    <div style={{ background: CARD, borderTop: `1px solid ${BORDER}`, padding: '14px 20px 16px', flexShrink: 0 }}>

      {/* Top row: time + speed */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: T1, letterSpacing: '-0.02em' }}>
            {fmtTime(currentTime)}
          </span>
          <span style={{ fontSize: 11, color: T3 }}>shift time</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: T3, marginRight: 4 }}>Speed</span>
          {SPEEDS.map(s => {
            const active = playbackSpeed === s;
            return (
              <button key={s} onClick={() => setPlaybackSpeed(s)}
                style={{
                  padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                  cursor: 'pointer', transition: 'all 0.12s',
                  background: active ? T1 : PAGE,
                  color: active ? '#fff' : T2,
                  border: `1px solid ${active ? T1 : BORDER}`,
                }}>
                {s}×
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrubber + event markers */}
      <div style={{ marginBottom: 12 }}>
        {/* Event marker row — above the bar */}
        <div style={{ position: 'relative', height: 22, marginBottom: 3 }}>
          {events.map(ev => {
            const evPct  = (ev.time / SHIFT_DATA.shiftDuration) * 100;
            const isActive = currentTime >= ev.time - SHOW_BEFORE && currentTime <= ev.time + SHOW_AFTER;
            const isProblem = ev.type === 'problem';
            const dotColor  = isProblem ? '#ef4444' : '#22c55e';
            const isHovered = hoveredEvent === ev.id;

            return (
              <div key={ev.id} style={{ position: 'absolute', left: `${evPct}%`, transform: 'translateX(-50%)', top: 0, zIndex: 10 }}>
                {/* Tooltip */}
                {isHovered && (
                  <div style={{
                    position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                    marginBottom: 6, background: T1, color: '#fff', borderRadius: 7, padding: '7px 10px',
                    fontSize: 11, whiteSpace: 'normal', boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                    pointerEvents: 'none', zIndex: 20,
                    maxWidth: 220, textAlign: 'center', lineHeight: 1.4,
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 3 }}>
                      {isProblem ? '⚠ ' : '✓ '}{ev.timeLabel}
                    </div>
                    <div style={{ color: '#d1d5db' }}>{ev.title}</div>
                    <div style={{ fontSize: 9, color: '#6b7280', marginTop: 3 }}>Click to jump</div>
                  </div>
                )}
                <button
                  onClick={() => { setCurrentTime(ev.time); setPlaying(false); }}
                  onMouseEnter={() => setHoveredEvent(ev.id)}
                  onMouseLeave={() => setHoveredEvent(null)}
                  style={{
                    width: isActive ? 14 : 10,
                    height: isActive ? 14 : 10,
                    borderRadius: '50%',
                    background: dotColor,
                    border: isActive ? `2px solid ${dotColor}` : `2px solid ${CARD}`,
                    cursor: 'pointer',
                    outline: isActive ? `3px solid ${isProblem ? '#fecaca' : '#bbf7d0'}` : 'none',
                    boxShadow: isActive ? `0 0 8px ${dotColor}88` : '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'all 0.2s',
                    display: 'block',
                    padding: 0,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Track */}
        <div style={{ position: 'relative' }}>
          <div style={{ height: 6, borderRadius: 3, background: '#f0f2f5', position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: 6, borderRadius: 3, width: `${pct}%`, background: T1 }} />
          </div>
          <input type="range" min={0} max={SHIFT_DATA.shiftDuration} step={8000}
            value={currentTime} onChange={e => setCurrentTime(Number(e.target.value))}
            style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', height: '100%' }} />
        </div>

        {/* Hour labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
          {['6h','7h','8h','9h','10h','11h','12h','13h','14h'].map(h => (
            <span key={h} style={{ fontSize: 10, color: T3 }}>{h}</span>
          ))}
        </div>

        {/* Event legend */}
        {events.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 7 }}>
            <span style={{ fontSize: 10, color: T3 }}>Jump to:</span>
            {events.map(ev => {
              const isProblem = ev.type === 'problem';
              const isActive = currentTime >= ev.time - SHOW_BEFORE && currentTime <= ev.time + SHOW_AFTER;
              return (
                <button
                  key={ev.id}
                  onClick={() => { setCurrentTime(ev.time); setPlaying(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '3px 9px', borderRadius: 99, cursor: 'pointer',
                    fontSize: 10, fontWeight: 600,
                    background: isActive
                      ? (isProblem ? '#fef2f2' : '#f0fdf4')
                      : PAGE,
                    color: isActive
                      ? (isProblem ? '#dc2626' : '#16a34a')
                      : T2,
                    border: `1px solid ${isActive ? (isProblem ? '#fecaca' : '#bbf7d0') : BORDER}`,
                    transition: 'all 0.15s',
                  }}>
                  <span style={{ fontSize: 8 }}>{isProblem ? '⚠' : '✓'}</span>
                  {ev.timeLabel} — {ev.title.length > 24 ? ev.title.slice(0, 24) + '…' : ev.title}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Transport controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => setCurrentTime(0)}
          style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, background: PAGE, color: T2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <SkipBack size={13} />
        </button>

        <button onClick={() => setPlaying(!isPlaying)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 22px',
            borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: T1, color: '#fff', border: 'none',
          }}>
          {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          {isPlaying ? 'Pause' : 'Play Replay'}
        </button>

        <button onClick={() => setCurrentTime(SHIFT_DATA.shiftDuration)}
          style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, background: PAGE, color: T2, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <SkipForward size={13} />
        </button>

        <div style={{ flex: 1 }} />

        <button onClick={() => setShowHeatmap(!showHeatmap)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
            borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
            background: showHeatmap ? T1 : PAGE,
            color: showHeatmap ? '#fff' : T2,
            border: `1px solid ${showHeatmap ? T1 : BORDER}`,
          }}>
          <Layers size={12} />
          Heatmap {showHeatmap ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  );
}
