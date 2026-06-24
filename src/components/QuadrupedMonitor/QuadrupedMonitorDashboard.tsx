import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

/* ── Color palette ──────────────────────────────────────────────────────── */
const BG   = '#020b18';
const PNL  = '#061528';
const PNL2 = '#071a32';
const BDR  = '#1e3a5f';
const ACC  = '#00b4d8';
const RED  = '#ef4444';
const GRN  = '#22c55e';
const AMB  = '#f59e0b';
const T1   = '#e2e8f0';
const T2   = '#94a3b8';
const T3   = '#475569';

/* ── Types ──────────────────────────────────────────────────────────────── */
type MissionStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type DriveMode   = 'autonomous' | 'manual';
type CamMode     = 'third' | 'first';
type Sev         = 'LOW' | 'MED' | 'HIGH' | 'CRIT';

interface AlertEntry { id: string; ts: number; sensor: string; msg: string; sev: Sev; }

/* ── Mission step definitions ───────────────────────────────────────────── */
const STEP_META: Record<number, { label: string; sub: string; stepEnd: number }> = {
  1: { label: 'Dispatch',       sub: 'Mission initialized · Patrol route planned',          stepEnd: 14 },
  2: { label: 'Patrol',         sub: 'SLAM navigation · Obstacle clearance active',          stepEnd: 32 },
  3: { label: 'Condition Scan', sub: 'Multi-sensor scan active · Baseline comparison',       stepEnd: 62 },
  4: { label: 'AI Analysis',    sub: 'Anomaly correlation · Health prediction running',      stepEnd: 88 },
  5: { label: 'Evidence',       sub: 'Evidence captured · Digital report generated',        stepEnd: 108 },
  6: { label: 'Risk Marking',   sub: 'Virtual hazard zone marked · Crew advisory broadcast', stepEnd: 130 },
};

/* ── Asset positions on patrol map (% of map div width/height) ──────────── */
const ASSETS = [
  { id: 'DOCK',  label: 'Docking Stn',  x: 8,  y: 78, color: '#0ea5e9', icon: '⏏' },
  { id: 'TF-T1', label: 'Transformer T1', x: 22, y: 30, color: '#3b82f6', icon: '⚡' },
  { id: 'TF-T2', label: 'Transformer T2', x: 50, y: 25, color: RED,       icon: '⚡', alarm: true },
  { id: 'TF-T3', label: 'Transformer T3', x: 78, y: 30, color: '#3b82f6', icon: '⚡' },
  { id: 'GIS',   label: 'GIS',           x: 83, y: 14, color: '#8b5cf6', icon: '⊞' },
  { id: 'SWG',   label: 'Switchgear',    x: 50, y: 58, color: '#64748b', icon: '▦' },
  { id: 'BKR',   label: 'Breaker Row',   x: 32, y: 50, color: '#64748b', icon: '◫' },
  { id: 'RLY',   label: 'Relay Bldg',    x: 78, y: 60, color: '#475569', icon: '▣' },
];

/* ── Robot waypoints per mission step ───────────────────────────────────── */
const STEP_POS: Record<number, { x: number; y: number; hdg: number }> = {
  0: { x: 8,  y: 78, hdg: 0   },
  1: { x: 8,  y: 78, hdg: 0   },
  2: { x: 36, y: 48, hdg: 315 },
  3: { x: 49, y: 27, hdg: 270 },
  4: { x: 49, y: 27, hdg: 270 },
  5: { x: 49, y: 27, hdg: 270 },
  6: { x: 54, y: 36, hdg: 225 },
};

/* ── Utility functions ──────────────────────────────────────────────────── */
function elapsedToStep(t: number): MissionStep {
  if (t < 0)   return 0;
  if (t < 14)  return 1;
  if (t < 32)  return 2;
  if (t < 62)  return 3;
  if (t < 88)  return 4;
  if (t < 108) return 5;
  return 6;
}

function elapsedToHealth(t: number): number {
  if (t < 32) return 9.2;
  if (t < 62) return 9.2 - ((t - 32) / 30) * 0.8;
  if (t < 88) return 8.4 - ((t - 62) / 26) * 5.6;
  return 2.8;
}

function tempToColor(n: number): string {
  const stops: [number, [number, number, number]][] = [
    [0.0, [30, 90, 180]],
    [0.25,[6,  182, 212]],
    [0.5, [234,195, 8]],
    [0.72,[249,115, 22]],
    [1.0, [239,60,  60]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (n >= t0 && n <= t1) {
      const f = (n - t0) / (t1 - t0);
      return `rgb(${Math.round(c0[0]+f*(c1[0]-c0[0]))},${Math.round(c0[1]+f*(c1[1]-c0[1]))},${Math.round(c0[2]+f*(c1[2]-c0[2]))})`;
    }
  }
  return 'rgb(239,60,60)';
}

function makeThermalGrid(step: MissionStep): number[][] {
  const anomaly = step >= 3;
  return Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: 8 }, (_, col) => {
      let t = 30 + (Math.random() - 0.5) * 6;
      if (anomaly) {
        const dist = Math.hypot(col - 6.5, row - 0.5);
        if (dist < 3) t += (85 - 30) * Math.exp(-dist * 0.65);
      }
      return Math.round(t * 10) / 10;
    })
  );
}

function makeAcousticBars(step: MissionStep): number[] {
  const bars = Array.from({ length: 20 }, () => 3 + Math.random() * 12);
  if (step >= 3) {
    bars[7]  = 72 + Math.random() * 18;  // 40kHz PD spike
    bars[8]  = 55 + Math.random() * 15;
    bars[6]  = 28 + Math.random() * 12;
    bars[9]  = 20 + Math.random() * 10;
  }
  return bars;
}

/* ══ 3D COMPONENTS ══════════════════════════════════════════════════════════ */

/* ── Preload the GLB so it's cached before first render ─────────────────── */
useGLTF.preload('/robot_dog_unitree_go2.glb');

function QuadrupedModel({ walking, anomalyActive }: { walking: boolean; anomalyActive: boolean }) {
  const { scene, animations } = useGLTF('/robot_dog_unitree_go2.glb') as any;
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);

  /* ── Clone + auto-normalize scale so model always fits the scene ── */
  const clonedScene = useRef<THREE.Group | null>(null);
  if (!clonedScene.current && scene) {
    const clone = (scene as THREE.Group).clone(true);

    // Apply tech-dark material to all meshes
    clone.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color('#1c2d48'),
          metalness: 0.78,
          roughness: 0.32,
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    // Fit to ~0.85 unit tall, centered at origin, feet at y=0
    const box    = new THREE.Box3().setFromObject(clone);
    const size   = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale  = 0.85 / Math.max(size.x, size.y, size.z);
    clone.scale.setScalar(scale);
    clone.position.set(
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale,
    );

    clonedScene.current = clone;
  }

  /* ── Set up animation mixer once ── */
  useEffect(() => {
    const target = clonedScene.current;
    if (!target || !animations?.length) return;
    const mixer = new THREE.AnimationMixer(target);
    mixerRef.current = mixer;
    const clip   = animations[0];
    const action = mixer.clipAction(clip);
    action.loop = THREE.LoopRepeat;
    actionRef.current = action;
    return () => { mixer.stopAllAction(); mixerRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!clonedScene.current, animations?.length]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;

    if (mixerRef.current && actionRef.current) {
      if (walking) {
        actionRef.current.paused = false;
        actionRef.current.play();
        actionRef.current.timeScale = 1.2;
      } else {
        // Idle: slow sway without walking animation
        actionRef.current.paused = true;
      }
      mixerRef.current.update(dt);
    }

    if (groupRef.current) {
      if (walking) {
        groupRef.current.position.y = Math.abs(Math.sin(t * 7)) * 0.018;
      } else {
        groupRef.current.rotation.y += Math.sin(t * 0.4) * 0.0008;
        groupRef.current.position.y = Math.sin(t * 0.9) * 0.006;
      }
    }
  });

  /* ── Anomaly: overlay a pulsing emissive accent mesh ── */
  const accentMatRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (accentMatRef.current) {
      accentMatRef.current.emissiveIntensity = anomalyActive
        ? 0.6 + Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.6
        : 0.2;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {clonedScene.current && <primitive object={clonedScene.current} scale={1} />}

      {/* Sensor strip overlay on top of the body */}
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[0.12, 0.018, 0.35]} />
        <meshStandardMaterial
          ref={accentMatRef}
          color={anomalyActive ? '#ef4444' : ACC}
          emissive={anomalyActive ? '#ef4444' : ACC}
          emissiveIntensity={0.2}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* LiDAR dome */}
      <mesh position={[0, 0.42, 0.1]}>
        <sphereGeometry args={[0.045, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#1a3050" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

function SubstationEnv({ anomalyActive }: { anomalyActive: boolean }) {
  const hazardMat  = useRef<THREE.MeshStandardMaterial>(null);
  const bushing0   = useRef<THREE.MeshStandardMaterial>(null);
  const bushing1   = useRef<THREE.MeshStandardMaterial>(null);
  const bushing2   = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!anomalyActive) return;
    const pulse = 0.5 + Math.abs(Math.sin(t * 2.5)) * 0.8;
    if (hazardMat.current)  hazardMat.current.emissiveIntensity = pulse;
    if (bushing0.current)   bushing0.current.emissiveIntensity  = pulse * 0.7;
    if (bushing1.current)   bushing1.current.emissiveIntensity  = pulse * 0.7;
    if (bushing2.current)   bushing2.current.emissiveIntensity  = pulse * 0.7;
  });

  return (
    <>
      {/* Concrete floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[24, 24]} />
        <meshStandardMaterial color="#060e1a" />
      </mesh>
      <gridHelper args={[24, 24, '#112233', '#0a1825']} />

      {/* Transformer T2 — alarmed (center) */}
      <group position={[1.6, 0, -1.8]}>
        <mesh position={[0, 0.62, 0]} castShadow>
          <boxGeometry args={[0.72, 1.24, 0.54]} />
          <meshStandardMaterial color="#0d1e35" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Cooling fins */}
        {[-0.28, 0, 0.28].map((x, i) => (
          <mesh key={i} position={[0.4, 0.5, x]}>
            <boxGeometry args={[0.04, 0.8, 0.07]} />
            <meshStandardMaterial color="#0a1828" />
          </mesh>
        ))}
        {/* Bushings */}
        {[0].map((_, bi) => {
          const matRefs = [bushing0, bushing1, bushing2];
          return [-0.2, 0, 0.2].map((x, i) => (
            <mesh key={`${bi}-${i}`} position={[x, 1.46, 0]}>
              <cylinderGeometry args={[0.038, 0.055, 0.55, 10]} />
              <meshStandardMaterial
                ref={matRefs[i]}
                color={anomalyActive ? '#ff5a00' : '#1a3a60'}
                emissive={anomalyActive ? '#ff3300' : '#000000'}
                emissiveIntensity={0}
              />
            </mesh>
          ));
        })}
        {/* Alarm sphere */}
        {anomalyActive && (
          <mesh position={[0, 2.0, 0]}>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshStandardMaterial
              ref={hazardMat}
              color="#ef4444"
              emissive="#ef4444"
              emissiveIntensity={0}
              transparent
              opacity={0.85}
            />
          </mesh>
        )}
      </group>

      {/* Transformer T1 (left) */}
      <group position={[-2.0, 0, -1.4]}>
        <mesh position={[0, 0.52, 0]}>
          <boxGeometry args={[0.65, 1.04, 0.48]} />
          <meshStandardMaterial color="#091624" metalness={0.6} roughness={0.4} />
        </mesh>
        {[-0.15, 0.1, 0.35].map((x, i) => (
          <mesh key={i} position={[x, 1.22, 0]}>
            <cylinderGeometry args={[0.03, 0.045, 0.44, 8]} />
            <meshStandardMaterial color="#112236" />
          </mesh>
        ))}
      </group>

      {/* Transformer T3 (right) */}
      <group position={[3.2, 0, -1.3]}>
        <mesh position={[0, 0.52, 0]}>
          <boxGeometry args={[0.65, 1.04, 0.48]} />
          <meshStandardMaterial color="#091624" metalness={0.6} roughness={0.4} />
        </mesh>
        {[-0.15, 0.1, 0.35].map((x, i) => (
          <mesh key={i} position={[x, 1.22, 0]}>
            <cylinderGeometry args={[0.03, 0.045, 0.44, 8]} />
            <meshStandardMaterial color="#112236" />
          </mesh>
        ))}
      </group>

      {/* Circuit breakers row */}
      {[-0.6, 0, 0.6].map((x, i) => (
        <mesh key={i} position={[x, 0.32, 0.9]}>
          <boxGeometry args={[0.26, 0.64, 0.2]} />
          <meshStandardMaterial color="#0c1e34" metalness={0.5} />
        </mesh>
      ))}

      {/* Control building back wall */}
      <mesh position={[0, 1.0, -4.0]}>
        <boxGeometry args={[8, 2.0, 0.15]} />
        <meshStandardMaterial color="#040c18" />
      </mesh>

      {/* Fence posts */}
      {[-4, -2, 0, 2, 4].map((x, i) => (
        <mesh key={i} position={[x, 0.9, 3.5]}>
          <cylinderGeometry args={[0.025, 0.025, 1.8, 6]} />
          <meshStandardMaterial color="#1e3a5f" metalness={0.8} />
        </mesh>
      ))}

      {/* Lighting */}
      <ambientLight intensity={0.18} color="#0a1e38" />
      <directionalLight position={[3, 6, 2]} intensity={0.7} color="#b0d0ff" castShadow />
      <pointLight position={[-2, 3, 0]} intensity={0.4} color="#2050a0" />
      {anomalyActive && <pointLight position={[1.6, 2, -1.8]} intensity={2} color="#ff4400" distance={4} />}
    </>
  );
}

function SceneCamera({ mode }: { mode: CamMode }) {
  const { camera } = useThree();

  useFrame(() => {
    if (mode === 'third') {
      // Third-person: orbiting over-shoulder view
      camera.position.x += (1.9 - camera.position.x) * 0.04;
      camera.position.y += (1.4 - camera.position.y) * 0.04;
      camera.position.z += (2.6 - camera.position.z) * 0.04;
      camera.lookAt(0, 0.42, 0);
    } else {
      // First-person: robot head position, looking forward into substation
      camera.position.x += (0    - camera.position.x) * 0.07;
      camera.position.y += (0.62 - camera.position.y) * 0.07;
      camera.position.z += (-0.38 - camera.position.z) * 0.07;
      camera.lookAt(0, 0.5, -5);
    }
  });

  return null;
}

/* ── Loading placeholder shown while GLB downloads ─────────────────────── */
function ModelLoading() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) meshRef.current.rotation.y = clock.elapsedTime * 1.2;
  });
  return (
    <mesh ref={meshRef} position={[0, 0.4, 0]}>
      <boxGeometry args={[0.5, 0.2, 0.85]} />
      <meshStandardMaterial color={ACC} wireframe />
    </mesh>
  );
}

function RobotScene3D({ walking, anomalyActive, camMode }: { walking: boolean; anomalyActive: boolean; camMode: CamMode }) {
  return (
    <Canvas
      shadows
      camera={{ position: [2.6, 1.9, 3.2], fov: 50 }}
      style={{ width: '100%', height: '100%', background: BG }}
    >
      <SceneCamera mode={camMode} />
      <SubstationEnv anomalyActive={anomalyActive} />
      <Suspense fallback={<ModelLoading />}>
        <QuadrupedModel walking={walking} anomalyActive={anomalyActive} />
      </Suspense>
    </Canvas>
  );
}

/* ══ SENSOR PANELS ══════════════════════════════════════════════════════════ */

function ThermalPanel({ grid, active }: { grid: number[][]; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const rows = grid.length, cols = grid[0].length;
    const cw = W / cols, ch = H / rows;

    grid.forEach((row, ri) => {
      row.forEach((temp, ci) => {
        const n = Math.max(0, Math.min(1, (temp - 25) / 65));
        ctx.fillStyle = tempToColor(n);
        ctx.fillRect(ci * cw + 0.5, ri * ch + 0.5, cw - 1, ch - 1);
        ctx.fillStyle = n > 0.55 ? 'rgba(255,255,255,0.9)' : 'rgba(148,163,184,0.8)';
        ctx.font = `bold ${Math.floor(cw * 0.28)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(temp)}`, ci * cw + cw / 2, ri * ch + ch / 2);
      });
    });
  }, [grid]);

  return (
    <div style={{ position: 'relative', width: '100%', flex: 1 }}>
      <canvas
        ref={canvasRef}
        width={256}
        height={256}
        style={{ width: '100%', height: '100%', display: 'block', borderRadius: 4 }}
      />
      {active && (
        <div style={{
          position: 'absolute', top: 4, right: 4,
          background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444',
          borderRadius: 4, padding: '2px 6px', fontSize: 9, color: '#ef4444', fontWeight: 700,
        }}>
          HOTSPOT 85.2°C
        </div>
      )}
      {/* Temp scale legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
        <span style={{ fontSize: 8, color: T3 }}>25°C</span>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'linear-gradient(to right, rgb(30,90,180), rgb(6,182,212), rgb(234,195,8), rgb(249,115,22), rgb(239,60,60))' }} />
        <span style={{ fontSize: 8, color: T3 }}>90°C</span>
      </div>
    </div>
  );
}

function AcousticPanel({ bars, active }: { bars: number[]; active: boolean }) {
  const freqLabels = ['10','15','20','25','30','35','40★','45','50','55','60','65','70','75','80','85','90','95','100','kHz'];

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
        {bars.map((h, i) => {
          const isPD = i === 7 || i === 8;
          const pct = Math.min(100, h);
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              <div style={{
                width: '100%',
                height: `${pct}%`,
                background: isPD && active
                  ? `linear-gradient(to top, ${RED}, #ff8a80)`
                  : `linear-gradient(to top, ${ACC}88, ${ACC}44)`,
                borderRadius: '2px 2px 0 0',
                transition: 'height 0.3s ease',
                minHeight: 2,
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 2 }}>
        {freqLabels.map((lbl, i) => (
          <div key={i} style={{ flex: 1, fontSize: 6, color: i === 6 && active ? RED : T3, textAlign: 'center', fontWeight: i === 6 ? 700 : 400 }}>
            {lbl}
          </div>
        ))}
      </div>
      {active && (
        <div style={{ marginTop: 4, fontSize: 9, color: RED, fontWeight: 700 }}>
          ▲ PD SIGNATURE DETECTED @ 40kHz — 78 dB
        </div>
      )}
    </div>
  );
}

function EMIPanel({ history, active }: { history: number[]; active: boolean }) {
  const W = 240, H = 50;
  const max = Math.max(...history, active ? 6 : 0.5);
  const pts = history.map((v, i) =>
    `${Math.round((i / (history.length - 1)) * W)},${Math.round(H - (v / max) * (H - 4) - 2)}`
  ).join(' ');

  return (
    <div style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="emiGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={active ? RED : ACC} stopOpacity="0.6" />
            <stop offset="100%" stopColor={active ? RED : ACC} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${H} ${pts} ${W},${H}`}
          fill="url(#emiGrad)"
        />
        <polyline
          points={pts}
          fill="none"
          stroke={active ? RED : ACC}
          strokeWidth="1.5"
        />
        {/* Threshold line */}
        <line x1={0} y1={Math.round(H - (0.5 / max) * (H - 4) - 2)} x2={W} y2={Math.round(H - (0.5 / max) * (H - 4) - 2)} stroke={AMB} strokeWidth="0.8" strokeDasharray="3,3" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: T3, marginTop: 2 }}>
        <span>0 µT</span>
        <span style={{ color: active ? RED : T3, fontWeight: active ? 700 : 400 }}>
          {active ? `⚠ ${history[history.length - 1]?.toFixed(2)} µT — SPIKE` : `${history[history.length - 1]?.toFixed(2)} µT`}
        </span>
        <span>{max.toFixed(1)} µT</span>
      </div>
    </div>
  );
}

/* ── Health score gauge (SVG semicircle) ──────────────────────────────────── */
function HealthGauge({ score }: { score: number }) {
  const cx = 80, cy = 68, R = 52, SW = 11;
  const pct = score / 10;
  const a = Math.PI - pct * Math.PI;
  const nx = cx + R * Math.cos(a), ny = cy - R * Math.sin(a);
  const largeArc = pct > 0.5 ? 1 : 0;
  const arcBg   = `M ${cx - R} ${cy} A ${R} ${R} 0 1 1 ${cx + R} ${cy}`;
  const arcFill = `M ${cx - R} ${cy} A ${R} ${R} 0 ${largeArc} 1 ${nx} ${ny}`;
  const color = score >= 6 ? GRN : score >= 4 ? AMB : RED;
  const trend = score < 5 ? 'CRITICAL' : score < 7 ? 'DEGRADING' : 'STABLE';

  const ticks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <svg viewBox="0 0 160 90" width="100%" height={90}>
      {/* Background arc */}
      <path d={arcBg} fill="none" stroke="#0d1e35" strokeWidth={SW} strokeLinecap="round" />
      {/* Zone colors */}
      {[
        { from: 0, to: 0.33, color: '#7f1d1d88' },
        { from: 0.33, to: 0.66, color: '#78350f66' },
        { from: 0.66, to: 1, color: '#14532d55' },
      ].map(({ from, to, color: c }) => {
        const a0 = Math.PI - from * Math.PI, a1 = Math.PI - to * Math.PI;
        const x0 = cx + R * Math.cos(a0), y0 = cy - R * Math.sin(a0);
        const x1 = cx + R * Math.cos(a1), y1 = cy - R * Math.sin(a1);
        return (
          <path key={from} d={`M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`}
            fill="none" stroke={c} strokeWidth={SW + 2} strokeLinecap="butt" />
        );
      })}
      {/* Filled arc */}
      {pct > 0.01 && (
        <path d={arcFill} fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" />
      )}
      {/* Tick marks */}
      {ticks.map(n => {
        const ta = Math.PI - (n / 10) * Math.PI;
        const inner = R - 4, outer = R + 5;
        return (
          <line key={n}
            x1={cx + inner * Math.cos(ta)} y1={cy - inner * Math.sin(ta)}
            x2={cx + outer * Math.cos(ta)} y2={cy - outer * Math.sin(ta)}
            stroke="#1e3a5f" strokeWidth={n % 5 === 0 ? 1.5 : 0.8}
          />
        );
      })}
      {/* Needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill={color} />
      {/* Score text */}
      <text x={cx} y={cy + 20} textAnchor="middle" fill={color} fontSize="22" fontWeight="900" fontFamily="monospace">
        {score.toFixed(1)}
      </text>
      <text x={cx} y={cy + 30} textAnchor="middle" fill={T3} fontSize="7">/10</text>
      <text x={cx - R - 2} y={cy + 8} textAnchor="middle" fill="#7f1d1d" fontSize="7">0</text>
      <text x={cx + R + 2} y={cy + 8} textAnchor="middle" fill={GRN} fontSize="7">10</text>
      {/* Trend label */}
      <text x={cx} y={cy + 41} textAnchor="middle" fill={color} fontSize="8" fontWeight="700">
        {trend}
      </text>
    </svg>
  );
}

/* ── Top-down patrol map ─────────────────────────────────────────────────── */
function PatrolMap({
  step, robotX, robotY, anomalyActive, running,
}: {
  step: MissionStep; robotX: number; robotY: number; anomalyActive: boolean; running: boolean;
}) {
  const PATROL_PATH = '8,78 36,48 49,27 78,30 83,14 50,58 32,50 78,60 8,78';

  return (
    <div style={{ position: 'relative', width: '100%', flex: 1, background: '#030d1a', borderRadius: 6, overflow: 'hidden' }}>
      {/* Concrete grid lines */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3 }}>
        <defs>
          <pattern id="cgrid" width="8%" height="8%" patternUnits="objectBoundingBox">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#1e3a5f" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cgrid)" />
      </svg>

      {/* Patrol route path */}
      {running && (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <polyline
            points={PATROL_PATH.split(' ').map(pt => {
              const [px, py] = pt.split(',').map(Number);
              return `${px}%,${py}%`;
            }).join(' ')}
            fill="none"
            stroke={ACC}
            strokeWidth="1"
            strokeDasharray="4,4"
            opacity="0.4"
          />
        </svg>
      )}

      {/* Assets */}
      {ASSETS.map(a => (
        <div key={a.id} style={{
          position: 'absolute',
          left: `${a.x}%`, top: `${a.y}%`,
          transform: 'translate(-50%,-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          pointerEvents: 'none',
        }}>
          <div style={{
            width: a.alarm ? 36 : 28, height: a.alarm ? 36 : 28,
            background: a.alarm && anomalyActive ? `${RED}22` : `${a.color}18`,
            border: `1.5px solid ${a.alarm && anomalyActive ? RED : a.color}`,
            borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: a.alarm ? 14 : 11,
            animation: a.alarm && anomalyActive ? 'quadPulse 1.5s ease-in-out infinite' : 'none',
            boxShadow: a.alarm && anomalyActive ? `0 0 12px ${RED}80` : 'none',
          }}>
            {a.icon}
          </div>
          <span style={{ fontSize: 7, color: a.alarm && anomalyActive ? RED : T3, fontWeight: a.alarm ? 700 : 400, whiteSpace: 'nowrap' }}>
            {a.label}
          </span>
          {a.alarm && anomalyActive && (
            <span style={{ fontSize: 7, color: RED, fontWeight: 800, animation: 'quadBlink 0.8s step-end infinite' }}>
              ALARM
            </span>
          )}
        </div>
      ))}

      {/* Hazard zone circle */}
      {anomalyActive && (
        <div style={{
          position: 'absolute', left: '50%', top: '25%',
          transform: 'translate(-50%,-50%)',
          width: 60, height: 60,
          border: `2px dashed ${RED}`,
          borderRadius: '50%',
          background: `${RED}12`,
          animation: 'quadPulse 2s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}

      {/* Robot marker */}
      <div style={{
        position: 'absolute',
        left: `${robotX}%`, top: `${robotY}%`,
        transform: 'translate(-50%,-50%)',
        width: 20, height: 20,
        background: ACC,
        borderRadius: '50%',
        border: `2px solid #fff`,
        boxShadow: `0 0 10px ${ACC}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9,
        transition: 'left 2s cubic-bezier(0.4,0,0.2,1), top 2s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 10,
      }}>
        🤖
      </div>

      {/* Mission step label */}
      {step > 0 && (
        <div style={{
          position: 'absolute', bottom: 8, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(6,21,40,0.9)', border: `1px solid ${BDR}`,
            borderRadius: 6, padding: '4px 12px', backdropFilter: 'blur(4px)',
          }}>
            <span style={{ fontSize: 10, color: ACC, fontWeight: 700 }}>
              Step {step}: {STEP_META[step]?.label}
            </span>
            <span style={{ fontSize: 9, color: T2, marginLeft: 8 }}>
              {STEP_META[step]?.sub}
            </span>
          </div>
        </div>
      )}

      {/* Pre-run overlay */}
      {!running && step === 0 && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(2,11,24,0.7)', backdropFilter: 'blur(2px)',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: T1, fontWeight: 700, marginBottom: 4 }}>Unitree Go2 — Ready</div>
            <div style={{ fontSize: 10, color: T2 }}>Press <span style={{ color: ACC }}>Launch Mission</span> to begin</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Mission step progress bar ───────────────────────────────────────────── */
function MissionStepBar({ step }: { step: MissionStep }) {
  const steps = [1, 2, 3, 4, 5, 6];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 0' }}>
      {steps.map((s, i) => {
        const done    = step > s;
        const current = step === s;
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: done ? GRN : current ? ACC : BDR,
                border: `2px solid ${done ? GRN : current ? ACC : T3}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700,
                color: done || current ? '#fff' : T3,
                boxShadow: current ? `0 0 8px ${ACC}` : 'none',
                flexShrink: 0,
              }}>
                {done ? '✓' : s}
              </div>
              <span style={{ fontSize: 7, color: current ? ACC : done ? GRN : T3, marginTop: 2, textAlign: 'center', lineHeight: 1.1 }}>
                {STEP_META[s]?.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                height: 2, flex: 1, maxWidth: 24,
                background: done ? GRN : BDR,
                transition: 'background 0.5s',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Alert ticker ────────────────────────────────────────────────────────── */
function AlertTicker({ alerts }: { alerts: AlertEntry[] }) {
  const sevColor: Record<Sev, string> = { LOW: '#64748b', MED: AMB, HIGH: RED, CRIT: '#ff0000' };
  const sevBg:    Record<Sev, string> = { LOW: '#0d1e35', MED: '#292524', HIGH: '#1f1010', CRIT: '#2a0a0a' };

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {alerts.length === 0 ? (
        <div style={{ padding: '12px 0', fontSize: 10, color: T3, textAlign: 'center' }}>Awaiting mission start…</div>
      ) : (
        alerts.slice(0, 12).map((a, i) => (
          <div key={a.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            background: sevBg[a.sev], borderLeft: `2px solid ${sevColor[a.sev]}`,
            padding: '5px 8px', borderRadius: '0 4px 4px 0',
            animation: i === 0 ? 'tickIn 0.2s ease-out' : 'none',
          }}>
            <span style={{ fontSize: 8, fontWeight: 800, color: sevColor[a.sev], minWidth: 28 }}>{a.sev}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: T2 }}>{a.sensor}</div>
              <div style={{ fontSize: 10, color: T1, lineHeight: 1.3 }}>{a.msg}</div>
            </div>
            <span style={{ fontSize: 8, color: T3, flexShrink: 0 }}>{a.ts}s</span>
          </div>
        ))
      )}
    </div>
  );
}

/* ── Telemetry row ───────────────────────────────────────────────────────── */
function TelemetryRow({
  battery, signal, speed, heading, cpu, step,
}: {
  battery: number; signal: number; speed: number; heading: number; cpu: number; step: MissionStep;
}) {
  const chips: { label: string; value: string; color: string }[] = [
    { label: 'BAT',  value: `${battery}%`,         color: battery > 20 ? GRN : RED },
    { label: 'SIG',  value: `${signal}%`,           color: signal > 50 ? GRN : AMB  },
    { label: 'SPD',  value: `${speed.toFixed(1)}m/s`, color: T1 },
    { label: 'HDG',  value: `${Math.round(heading)}°`, color: ACC },
    { label: 'CPU',  value: `${cpu}%`,              color: cpu < 70 ? GRN : AMB },
    { label: 'YAW',  value: `${Math.round(heading % 360)}°`, color: T2 },
  ];

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '6px 0' }}>
      {chips.map(c => (
        <div key={c.label} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: PNL, border: `1px solid ${BDR}`, borderRadius: 5, padding: '3px 7px', minWidth: 42,
        }}>
          <span style={{ fontSize: 7, color: T3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: c.color, fontVariantNumeric: 'tabular-nums' }}>{c.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Keyboard control pad ────────────────────────────────────────────────── */
function KeyboardPad({ keysHeld, driveMode }: { keysHeld: Set<string>; driveMode: DriveMode }) {
  const K = (key: string, label: string, wide?: boolean) => (
    <div style={{
      width: wide ? 56 : 28, height: 24,
      background: keysHeld.has(key) ? ACC : '#0d1e35',
      border: `1px solid ${keysHeld.has(key) ? ACC : BDR}`,
      borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: keysHeld.has(key) ? 10 : 9, fontWeight: 700,
      color: keysHeld.has(key) ? '#fff' : T3,
      transition: 'all 0.08s',
      boxShadow: keysHeld.has(key) ? `0 0 6px ${ACC}` : 'none',
    }}>
      {label}
    </div>
  );

  if (driveMode === 'autonomous') {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontSize: 9, color: T3, marginBottom: 4 }}>Manual override disabled — autonomous mode</div>
        <div style={{ fontSize: 9, color: ACC }}>Press <span style={{ fontWeight: 700 }}>M</span> to take manual control</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 8, color: AMB, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>
        ⚠ MANUAL OVERRIDE ACTIVE
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div>{K('w', 'W')}</div>
        <div style={{ display: 'flex', gap: 3 }}>{K('a', 'A')}{K('s', 'S')}{K('d', 'D')}</div>
        <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
          {K('ArrowUp', '↑')}{K('ArrowDown', '↓')}{K('ArrowLeft', '←')}{K('ArrowRight', '→')}
        </div>
        <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
          {K(' ', 'SPC', true)}
        </div>
      </div>
      <div style={{ fontSize: 8, color: T3, textAlign: 'center', marginTop: 6 }}>
        WASD: move · ↑↓←→: camera · SPC: stop · ESC: exit manual
      </div>
    </div>
  );
}

/* ── First-person HUD overlay ────────────────────────────────────────────── */
function FPHudOverlay({ anomalyActive, driveMode, heading }: { anomalyActive: boolean; driveMode: DriveMode; heading: number }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      border: `2px solid ${anomalyActive ? RED : '#00b4d840'}`,
      borderRadius: 6, overflow: 'hidden',
    }}>
      {/* Corner brackets */}
      {[
        { top: 6, left: 6,    borderTop: `2px solid ${anomalyActive ? RED : ACC}`,    borderLeft: `2px solid ${anomalyActive ? RED : ACC}` },
        { top: 6, right: 6,   borderTop: `2px solid ${anomalyActive ? RED : ACC}`,    borderRight: `2px solid ${anomalyActive ? RED : ACC}` },
        { bottom: 6, left: 6, borderBottom: `2px solid ${anomalyActive ? RED : ACC}`, borderLeft: `2px solid ${anomalyActive ? RED : ACC}` },
        { bottom: 6, right: 6,borderBottom: `2px solid ${anomalyActive ? RED : ACC}`, borderRight: `2px solid ${anomalyActive ? RED : ACC}` },
      ].map((s, i) => (
        <div key={i} style={{ position: 'absolute', width: 16, height: 16, ...s }} />
      ))}

      {/* Crosshair */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 20, height: 20 }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: `${ACC}88` }} />
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: `${ACC}88` }} />
          <div style={{ position: 'absolute', inset: 6, border: `1px solid ${ACC}55`, borderRadius: '50%' }} />
        </div>
      </div>

      {/* Heading compass */}
      <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)' }}>
        <div style={{ background: 'rgba(6,21,40,0.8)', border: `1px solid ${BDR}`, borderRadius: 3, padding: '2px 8px', fontSize: 9, color: ACC, fontWeight: 700, letterSpacing: 2 }}>
          {Math.round(heading)}° HDG
        </div>
      </div>

      {/* Sensor status — bottom left */}
      <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[
          { label: 'THERMAL', active: true },
          { label: 'ACOUSTIC', active: true },
          { label: 'EMI',     active: true },
          { label: 'LIDAR',   active: true },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: anomalyActive && s.label === 'THERMAL' ? RED : GRN, boxShadow: `0 0 4px ${GRN}` }} />
            <span style={{ fontSize: 7, color: T2, fontWeight: 600 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Temperature overlay top-right */}
      {anomalyActive && (
        <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(239,68,68,0.15)', border: `1px solid ${RED}`, borderRadius: 4, padding: '4px 8px' }}>
          <div style={{ fontSize: 8, color: RED, fontWeight: 700 }}>IR HOTSPOT</div>
          <div style={{ fontSize: 16, color: '#fff', fontWeight: 900 }}>85.2°C</div>
        </div>
      )}

      {/* Manual override warning */}
      {driveMode === 'manual' && (
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', marginTop: 20 }}>
          <div style={{ background: `${AMB}20`, border: `1px solid ${AMB}`, borderRadius: 4, padding: '2px 10px', fontSize: 9, color: AMB, fontWeight: 800 }}>
            ⚠ MANUAL OVERRIDE
          </div>
        </div>
      )}
    </div>
  );
}

/* ══ MAIN DASHBOARD ══════════════════════════════════════════════════════════ */

export function QuadrupedMonitorDashboard() {
  const [running,    setRunning]    = useState(false);
  const [elapsed,    setElapsed]    = useState(0);
  const [driveMode,  setDriveMode]  = useState<DriveMode>('autonomous');
  const [camMode,    setCamMode]    = useState<CamMode>('third');
  const [keysHeld,   setKeysHeld]   = useState<Set<string>>(new Set());
  const [alerts,     setAlerts]     = useState<AlertEntry[]>([]);
  const [thermalGrid,setThermalGrid]= useState(() => makeThermalGrid(0));
  const [acousticBars, setAcousticBars] = useState(() => makeAcousticBars(0));
  const [emiHistory, setEmiHistory] = useState<number[]>(() => Array(40).fill(0.08 + Math.random() * 0.04));
  const [healthScore,setHealthScore]= useState(9.2);
  const [battery,    setBattery]    = useState(91);
  const [signal,     setSignal]     = useState(94);
  const [cpu,        setCpu]        = useState(22);
  const [robotPos,   setRobotPos]   = useState({ x: 8, y: 78, hdg: 0 });
  const [manRobotPos,setManRobotPos]= useState({ x: 8, y: 78 });

  const ivRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertCounter = useRef(0);
  const alertsRef    = useRef<AlertEntry[]>([]);

  const step: MissionStep = elapsedToStep(elapsed);
  const anomalyActive = step >= 3;
  const walking = running && (step === 2 || step === 6) && driveMode === 'autonomous';

  /* ── Mission timer ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!running) return;
    ivRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        if (next >= 132) { setRunning(false); return 130; }
        return next;
      });
    }, 1000);
    return () => clearInterval(ivRef.current!);
  }, [running]);

  /* ── Sensor data updates ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      setThermalGrid(makeThermalGrid(step));
      setAcousticBars(makeAcousticBars(step));
      setEmiHistory(prev => {
        const base = anomalyActive ? 3.5 + Math.random() * 2.5 : 0.06 + Math.random() * 0.08;
        return [...prev.slice(1), Math.round(base * 100) / 100];
      });
      setHealthScore(elapsedToHealth(elapsed));
      setBattery(prev => Math.max(50, prev - (Math.random() < 0.1 ? 1 : 0)));
      setSignal(prev => Math.max(70, Math.min(100, prev + (Math.random() - 0.5) * 4)));
      setCpu(anomalyActive ? 55 + Math.floor(Math.random() * 25) : 18 + Math.floor(Math.random() * 12));
    }, 800);
    return () => clearInterval(iv);
  }, [running, step, anomalyActive, elapsed]);

  /* ── Robot position tracking ─────────────────────────────────────────────── */
  useEffect(() => {
    if (driveMode === 'autonomous') {
      const target = STEP_POS[step] ?? { x: 8, y: 78, hdg: 0 };
      setRobotPos(target);
    }
  }, [step, driveMode]);

  /* ── Alert generation ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!running) return;
    const ALERT_TRIGGERS: { at: number; sensor: string; msg: string; sev: Sev }[] = [
      { at: 14, sensor: 'GridOS',   msg: 'Phase-0 inspection started — Transformer T2',     sev: 'LOW'  },
      { at: 32, sensor: 'Navigation', msg: 'SLAM initialized · Patrol route engaged',        sev: 'LOW'  },
      { at: 35, sensor: 'Thermal IR', msg: 'Scan initiated · Baseline temp 31.2°C established', sev: 'LOW' },
      { at: 45, sensor: 'Thermal IR', msg: 'HOTSPOT: Bushing A @ 85.2°C — δ+54°C above baseline', sev: 'CRIT' },
      { at: 48, sensor: 'Acoustic',   msg: 'PD signature detected @ 40kHz — 78dB — partial discharge', sev: 'HIGH' },
      { at: 52, sensor: 'EMI Field',  msg: 'EMI spike 4.8µT near busbar joint — arc precursor', sev: 'HIGH' },
      { at: 58, sensor: 'Vibration',  msg: 'Mechanical vibration +67% vs baseline — structural anomaly', sev: 'MED' },
      { at: 62, sensor: 'Ground Pot', msg: 'Step-touch potential detected 0.8V — grounding issue', sev: 'HIGH' },
      { at: 70, sensor: 'AI Engine',  msg: 'Transformer T2 Health Score: 2.8/10 — CRITICAL DEGRADATION', sev: 'CRIT' },
      { at: 75, sensor: 'AI Engine',  msg: 'Fault type: Loose connection + insulation breakdown', sev: 'CRIT' },
      { at: 80, sensor: 'AI Engine',  msg: 'Entry recommendation: RESTRICTED · Specialist required', sev: 'CRIT' },
      { at: 90, sensor: 'CMMS',       msg: 'Work order auto-created: WO-2024-0847 · Priority: URGENT', sev: 'HIGH' },
      { at: 100,sensor: 'GridOS',     msg: 'Report uploaded to SCADA · Anomaly tagged in AEMS', sev: 'MED'  },
      { at: 110,sensor: 'Safety Sys', msg: 'Virtual hazard perimeter active · Crew exclusion zone set', sev: 'HIGH' },
      { at: 120,sensor: 'Go2',        msg: 'Phase-0 complete · Returning to docking station',    sev: 'LOW'  },
    ];

    ALERT_TRIGGERS.forEach(t => {
      if (elapsed === t.at) {
        const entry: AlertEntry = {
          id: `${alertCounter.current++}`, ts: elapsed,
          sensor: t.sensor, msg: t.msg, sev: t.sev,
        };
        alertsRef.current = [entry, ...alertsRef.current].slice(0, 25);
        setAlerts([...alertsRef.current]);
      }
    });
  }, [elapsed, running]);

  /* ── Keyboard events ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      setKeysHeld(prev => { const s = new Set(prev); s.add(e.key); return s; });
      if (e.key === 'm' || e.key === 'M') {
        setDriveMode(d => d === 'manual' ? 'autonomous' : 'manual');
      }
      if (e.key === 'Escape') setDriveMode('autonomous');
      if (e.key === 'c' || e.key === 'C') setCamMode(c => c === 'third' ? 'first' : 'third');
    };
    const onUp = (e: KeyboardEvent) => {
      setKeysHeld(prev => { const s = new Set(prev); s.delete(e.key); return s; });
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  /* ── Manual robot movement ───────────────────────────────────────────────── */
  useEffect(() => {
    if (driveMode !== 'manual') return;
    const iv = setInterval(() => {
      setManRobotPos(prev => {
        let { x, y } = prev;
        if (keysHeld.has('w') || keysHeld.has('W')) y = Math.max(5,  y - 1);
        if (keysHeld.has('s') || keysHeld.has('S')) y = Math.min(90, y + 1);
        if (keysHeld.has('a') || keysHeld.has('A')) x = Math.max(5,  x - 1);
        if (keysHeld.has('d') || keysHeld.has('D')) x = Math.min(95, x + 1);
        return { x, y };
      });
    }, 80);
    return () => clearInterval(iv);
  }, [driveMode, keysHeld]);

  const displayPos = driveMode === 'manual'
    ? manRobotPos
    : { x: robotPos.x, y: robotPos.y };

  const handleLaunch = useCallback(() => {
    setElapsed(0);
    setAlerts([]);
    alertsRef.current = [];
    alertCounter.current = 0;
    setHealthScore(9.2);
    setRunning(true);
    setDriveMode('autonomous');
    setEmiHistory(Array(40).fill(0.08 + Math.random() * 0.04));
  }, []);

  const handleStop = useCallback(() => {
    setRunning(false);
    setElapsed(0);
    setAlerts([]);
    alertsRef.current = [];
    setHealthScore(9.2);
    setRobotPos({ x: 8, y: 78, hdg: 0 });
    setManRobotPos({ x: 8, y: 78 });
    setDriveMode('autonomous');
  }, []);

  const missionDone = elapsed >= 130 && !running;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: BG, color: T1, overflow: 'hidden', minHeight: 0 }}>
      <style>{`
        @keyframes quadPulse { 0%,100%{opacity:.5;transform:translate(-50%,-50%) scale(1)} 50%{opacity:1;transform:translate(-50%,-50%) scale(1.06)} }
        @keyframes quadBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes tickIn    { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
      `}</style>

      {/* ── Header bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px', height: 50,
        background: PNL2, borderBottom: `1px solid ${BDR}`, flexShrink: 0,
      }}>
        {/* Logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ACC}20`, border: `1px solid ${ACC}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            🤖
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: T1, letterSpacing: '-0.01em' }}>Quadruped AI Inspector</div>
            <div style={{ fontSize: 9, color: T3 }}>Unitree Go2 · Substation T2 · 230kV Yard</div>
          </div>
        </div>

        <div style={{ width: 1, height: 28, background: BDR }} />

        {/* Mission step */}
        {step > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, color: T3, textTransform: 'uppercase' }}>Step {step}/6</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: ACC }}>{STEP_META[step]?.label}</span>
          </div>
        )}

        {/* Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: running ? GRN : missionDone ? ACC : '#334155',
            boxShadow: running ? `0 0 6px ${GRN}` : 'none',
          }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: T1, fontVariantNumeric: 'tabular-nums' }}>
            {String(Math.floor(elapsed / 60)).padStart(2,'0')}:{String(elapsed % 60).padStart(2,'0')}
          </span>
          <span style={{ fontSize: 9, color: T3 }}>/ 02:10</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Health KPI */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: T3, textTransform: 'uppercase' }}>Asset Health</span>
          <span style={{
            fontSize: 16, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
            color: healthScore >= 6 ? GRN : healthScore >= 4 ? AMB : RED,
          }}>{healthScore.toFixed(1)}/10</span>
        </div>

        <div style={{ width: 1, height: 28, background: BDR }} />

        {/* Mode badges */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setDriveMode(d => d === 'manual' ? 'autonomous' : 'manual')} style={{
            padding: '4px 10px', borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none',
            background: driveMode === 'manual' ? `${AMB}22` : PNL,
            color: driveMode === 'manual' ? AMB : T2,
            boxShadow: driveMode === 'manual' ? `0 0 8px ${AMB}55` : 'none',
          }}>
            {driveMode === 'manual' ? '⚠ MANUAL' : '⚙ AUTO'}
          </button>
          <button onClick={() => setCamMode(c => c === 'third' ? 'first' : 'third')} style={{
            padding: '4px 10px', borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: `1px solid ${BDR}`,
            background: PNL, color: T2,
          }}>
            {camMode === 'third' ? '3rd Person' : '1st Person'}
          </button>
        </div>

        {/* Controls */}
        {!running && !missionDone && (
          <button onClick={handleLaunch} style={{
            padding: '7px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: ACC, color: '#fff', border: 'none',
            boxShadow: `0 2px 12px ${ACC}50`,
          }}>▶ Launch Mission</button>
        )}
        {running && (
          <button onClick={handleStop} style={{
            padding: '7px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: '#1f1010', color: RED, border: `1px solid ${RED}`,
          }}>■ Abort</button>
        )}
        {missionDone && (
          <button onClick={handleStop} style={{
            padding: '7px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: PNL, color: GRN, border: `1px solid ${GRN}`,
          }}>↺ Reset</button>
        )}
      </div>

      {/* ── Main layout ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* ─── LEFT COL: 3D view + telemetry + keyboard ─── */}
        <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${BDR}`, padding: '8px 10px', gap: 6 }}>

          {/* 3D Robot view */}
          <div style={{ position: 'relative', flex: 1, minHeight: 200, borderRadius: 8, overflow: 'hidden', border: `1px solid ${BDR}` }}>
            <RobotScene3D walking={walking} anomalyActive={anomalyActive} camMode={camMode} />
            {camMode === 'first' && (
              <FPHudOverlay anomalyActive={anomalyActive} driveMode={driveMode} heading={robotPos.hdg} />
            )}
            {/* Camera mode label */}
            <div style={{
              position: 'absolute', top: 8, left: 8, background: 'rgba(6,21,40,0.8)',
              border: `1px solid ${BDR}`, borderRadius: 4, padding: '2px 7px',
              fontSize: 8, color: T2, pointerEvents: 'none',
            }}>
              {camMode === 'third' ? '3RD PERSON' : '1ST PERSON'} · [C] to toggle
            </div>
            {/* Robot ID */}
            <div style={{
              position: 'absolute', bottom: 8, right: 8, background: 'rgba(6,21,40,0.85)',
              border: `1px solid ${BDR}`, borderRadius: 4, padding: '3px 8px',
              fontSize: 8, color: ACC, fontWeight: 700, pointerEvents: 'none',
            }}>
              GO2-UNIT-01 · {driveMode.toUpperCase()}
            </div>
          </div>

          {/* Telemetry */}
          <TelemetryRow battery={battery} signal={signal} speed={walking ? 0.8 + Math.random() * 0.4 : 0} heading={robotPos.hdg} cpu={cpu} step={step} />

          {/* Keyboard pad */}
          <div style={{ background: PNL, border: `1px solid ${BDR}`, borderRadius: 8, padding: '8px 10px', flexShrink: 0 }}>
            <div style={{ fontSize: 8, color: T3, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              Manual Control · [M] to {driveMode === 'manual' ? 'exit' : 'engage'}
            </div>
            <KeyboardPad keysHeld={keysHeld} driveMode={driveMode} />
          </div>
        </div>

        {/* ─── CENTER COL: Patrol map + steps + ticker ─── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 10px', gap: 6, minWidth: 0 }}>

          {/* Patrol map */}
          <PatrolMap step={step} robotX={displayPos.x} robotY={displayPos.y} anomalyActive={anomalyActive} running={running} />

          {/* Mission step progress */}
          <div style={{ background: PNL, border: `1px solid ${BDR}`, borderRadius: 8, padding: '6px 10px', flexShrink: 0 }}>
            <div style={{ fontSize: 8, color: T3, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Mission Progress</div>
            <MissionStepBar step={step} />
          </div>

          {/* Alert ticker */}
          <div style={{ background: PNL, border: `1px solid ${BDR}`, borderRadius: 8, padding: '6px 10px', flex: 1, minHeight: 80, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ fontSize: 8, color: T3, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6, flexShrink: 0 }}>
              Live Activity Log
              {alerts.filter(a => a.sev === 'CRIT' || a.sev === 'HIGH').length > 0 && (
                <span style={{ marginLeft: 8, background: RED, color: '#fff', borderRadius: 8, padding: '1px 5px', fontSize: 8 }}>
                  {alerts.filter(a => a.sev === 'CRIT' || a.sev === 'HIGH').length} alerts
                </span>
              )}
            </div>
            <AlertTicker alerts={alerts} />
          </div>
        </div>

        {/* ─── RIGHT COL: Sensors + health ─── */}
        <div style={{ width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${BDR}`, padding: '8px 10px', gap: 6, overflowY: 'auto' }}>

          {/* Thermal */}
          <div style={{ background: PNL, border: `1px solid ${anomalyActive ? RED + '60' : BDR}`, borderRadius: 8, padding: '8px 10px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 8, color: T3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>PTZ Thermal Camera</span>
              <span style={{ fontSize: 8, color: anomalyActive ? RED : GRN, fontWeight: 700 }}>{anomalyActive ? '● ANOMALY' : '● NOMINAL'}</span>
            </div>
            <div style={{ height: 160 }}>
              <ThermalPanel grid={thermalGrid} active={anomalyActive} />
            </div>
          </div>

          {/* Acoustic */}
          <div style={{ background: PNL, border: `1px solid ${anomalyActive ? RED + '60' : BDR}`, borderRadius: 8, padding: '8px 10px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 8, color: T3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Acoustic Intelligence</span>
              <span style={{ fontSize: 8, color: anomalyActive ? RED : GRN, fontWeight: 700 }}>{anomalyActive ? '● PD DETECTED' : '● QUIET'}</span>
            </div>
            <AcousticPanel bars={acousticBars} active={anomalyActive} />
          </div>

          {/* EMI */}
          <div style={{ background: PNL, border: `1px solid ${anomalyActive ? RED + '50' : BDR}`, borderRadius: 8, padding: '8px 10px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 8, color: T3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>EM Field · µT</span>
              <span style={{ fontSize: 8, color: anomalyActive ? RED : GRN, fontWeight: 700 }}>{anomalyActive ? '● SPIKE' : '● NORMAL'}</span>
            </div>
            <EMIPanel history={emiHistory} active={anomalyActive} />
          </div>

          {/* Vibration + Ground Potential quick stats */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <div style={{ flex: 1, background: PNL, border: `1px solid ${anomalyActive ? AMB + '60' : BDR}`, borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 7, color: T3, textTransform: 'uppercase', marginBottom: 4 }}>Vibration</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: anomalyActive ? AMB : GRN }}>
                {anomalyActive ? '67%' : '14%'}
              </div>
              <div style={{ height: 4, background: '#0d1e35', borderRadius: 2, marginTop: 4 }}>
                <div style={{ height: '100%', width: anomalyActive ? '67%' : '14%', background: anomalyActive ? AMB : GRN, borderRadius: 2, transition: 'width 0.8s ease' }} />
              </div>
              <div style={{ fontSize: 7, color: T3, marginTop: 2 }}>vs baseline</div>
            </div>
            <div style={{ flex: 1, background: PNL, border: `1px solid ${anomalyActive ? RED + '50' : BDR}`, borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 7, color: T3, textTransform: 'uppercase', marginBottom: 4 }}>Ground Pot.</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: anomalyActive ? RED : GRN }}>
                {anomalyActive ? '0.8V' : '0.0V'}
              </div>
              <div style={{ fontSize: 7, color: anomalyActive ? RED : T3, marginTop: 4, fontWeight: anomalyActive ? 700 : 400 }}>
                {anomalyActive ? '⚠ STEP-TOUCH' : 'SAFE'}
              </div>
            </div>
          </div>

          {/* Transformer health gauge */}
          <div style={{ background: PNL, border: `1px solid ${healthScore < 4 ? RED + '70' : BDR}`, borderRadius: 8, padding: '8px 10px', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 8, color: T3, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Transformer T2 — Health</span>
            </div>
            <HealthGauge score={healthScore} />

            {/* AI output cards */}
            {anomalyActive && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                {[
                  { label: 'Failure Risk',    value: healthScore < 4 ? 'HIGH ↑' : 'MED', color: healthScore < 4 ? RED : AMB },
                  { label: 'Fault Type',      value: 'Loose Connection + Insulation', color: T1 },
                  { label: 'Recommended Crew', value: 'Protection Specialist',          color: ACC },
                  { label: 'Entry Status',    value: healthScore < 4 ? 'RESTRICTED' : 'CAUTION', color: healthScore < 4 ? RED : AMB },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#030e1e', borderRadius: 4, padding: '3px 7px' }}>
                    <span style={{ fontSize: 8, color: T3 }}>{r.label}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: r.color }}>{r.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mission complete banner */}
          {missionDone && (
            <div style={{ background: '#021a10', border: `1px solid ${GRN}`, borderRadius: 8, padding: '10px 12px', flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: GRN, fontWeight: 800, marginBottom: 4 }}>✓ Mission Complete</div>
              <div style={{ fontSize: 9, color: T2, lineHeight: 1.6 }}>
                Report uploaded to GridOS/SCADA<br />
                Work order WO-2024-0847 created<br />
                Hazard zone active · Crew notified<br />
                Phase-0 duration: 02:10
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
