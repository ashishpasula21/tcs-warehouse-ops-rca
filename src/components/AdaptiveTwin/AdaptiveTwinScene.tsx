import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useSimulationStore } from '../../store/simulationStore';

// ─── Layout ───────────────────────────────────────────────────────────────────
export const RACK_X0   = -20;
export const RACK_X1   =  14;
export const RACK_SPAN = RACK_X1 - RACK_X0;    // 34
export const BAYS      =  8;
export const BAY_W     = RACK_SPAN / BAYS;     // 4.25
export const LEVELS    =  6;
export const LEVEL_H   =  2.2;
export const RACK_H    = LEVELS * LEVEL_H;     // 13.2

export const AISLE_Z      = [-8,  8] as const;
export const RACK_INNER_Z = [-4, +4] as const;
export const RACK_OUTER_Z = [-12,+12] as const;

// Receiving side
export const RECV_IO_X    = RACK_X0 - 2;   // -22  ASRS recv station
export const RECV_DOCK_X  = -40;            // dock wall x (outer face at -40.375)
// rot=π: trailer dock-face = truckX+1. At RECV_TRUCK_DOCKED=-41.4 → face at -40.4 (flush with outer wall face)
const RECV_TRUCK_DOCKED   = -41.4;

// Shipping side
export const SHIP_IO_X    = RACK_X1 + 2;   // 16  ASRS ship station / belt start
const CONV_END_X          = 26;             // belt end
const PAL_X_OFF           = 29;            // palletizer centre
const ARM_REACH           = 3;             // arm tip reach (left=26=belt, right=32=pallet)
const PALLET_STAGE_X      = PAL_X_OFF + ARM_REACH; // 32
const FORKLIFT_PARK_X     = 36;
const FORKLIFT_LOAD_X     = 44;            // inside outbound truck trailer
export const SHIP_DOCK_X  = 50;            // dock wall x (outer face at +50.375)
// rot=0: trailer dock-face = truckX-1. At SHIP_TRUCK_DOCKED=51.4 → face at 50.4 (flush with outer wall face)
const SHIP_TRUCK_DOCKED   = 51.4;

// Cardboard box colors matching Warehouse Ops
const SKU_COLORS = [
  '#c8924a','#b87c38','#d4a462','#bf8430',
  '#c8924a','#d4a462','#bf8430','#b87c38',
];
const MAX_BELT = 4;
const MIN_GAP  = 2.8;

// ─── Shared per-aisle coordination state (read/written in useFrame) ────────────
interface AisleState {
  inboundDocked:    boolean;
  outboundDocked:   boolean;
  palletReady:      boolean;
  craneDeposit:     boolean;
  inboundBoxCount:  number;
  outboundBoxCount: number;
  shelf: Record<string, boolean>;
  shelfDirty: boolean;
  // Toggled by forklift when it lifts the staged pallet — AisleShipping clears stack visuals
  palletLiftTrigger: boolean;
}

// ─── Lighting ─────────────────────────────────────────────────────────────────
function Lighting() {
  const midX = (RACK_X0 + RACK_X1) / 2;
  return (
    <>
      <ambientLight intensity={3.8} color="#e8ecf4" />
      <directionalLight position={[30,60,40]}   intensity={2.2} color="#ffffff" />
      <directionalLight position={[-40,30,-30]}  intensity={1.3} color="#dde8f8" />
      <directionalLight position={[0,20,0]}      intensity={0.9} color="#f0f4ff" />
      {[-14, midX, RACK_X1 - 4].map((x, i) =>
        AISLE_Z.map(z => (
          <pointLight key={`${i}-${z}`} position={[x,14,z]}
            intensity={3.4} color="#fff4e0" distance={52} decay={1.2} />
        ))
      )}
      <pointLight position={[RECV_DOCK_X+8,12,0]} intensity={3.0} color="#fff4e0" distance={50} decay={1.2} />
      <pointLight position={[SHIP_DOCK_X-8,12,0]} intensity={3.0} color="#fff4e0" distance={50} decay={1.2} />
    </>
  );
}

// ─── Floor ────────────────────────────────────────────────────────────────────
function Floor() {
  return (
    <group>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.01,0]}>
        <planeGeometry args={[130,60]} />
        <meshStandardMaterial color="#cfd4da" roughness={0.93} />
      </mesh>
      {AISLE_Z.map(z => (
        <mesh key={z} rotation={[-Math.PI/2,0,0]}
              position={[(RACK_X0+RACK_X1)/2,0,z]}
              {...({ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 } as any)}>
          <planeGeometry args={[RACK_SPAN+2,8.5]} />
          <meshStandardMaterial color="#bfc5cc" roughness={0.95} />
        </mesh>
      ))}
      {AISLE_Z.flatMap(z=>[-4.2,4.2].map(dz=>(
        <mesh key={`${z}-${dz}`} rotation={[-Math.PI/2,0,0]}
              position={[(RACK_X0+RACK_X1)/2,0.003,z+dz]}
              {...({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } as any)}>
          <planeGeometry args={[RACK_SPAN+2,0.20]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      )))}
      {[RECV_DOCK_X+9, SHIP_DOCK_X-10].map((cx,i)=>
        AISLE_Z.map(z=>(
          <mesh key={`${i}-${z}`} rotation={[-Math.PI/2,0,0]}
                position={[cx,0.001,z]}
                {...({ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 } as any)}>
            <planeGeometry args={[18,6]} />
            <meshStandardMaterial color="#c8cdd4" roughness={0.92} />
          </mesh>
        ))
      )}
      {AISLE_Z.map(z=>(
        <mesh key={z} rotation={[-Math.PI/2,0,0]}
              position={[(SHIP_IO_X+CONV_END_X)/2+4,0.001,z]}
              {...({ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 } as any)}>
          <planeGeometry args={[SHIP_DOCK_X-SHIP_IO_X,5]} />
          <meshStandardMaterial color="#bfc5cc" roughness={0.92} />
        </mesh>
      ))}
      {Array.from({length:18},(_,i)=>(
        <mesh key={i} rotation={[-Math.PI/2,0,0]} position={[-60+(i+1)*7,0.002,0]}>
          <planeGeometry args={[0.05,60]} />
          <meshBasicMaterial color="#b8bec6" />
        </mesh>
      ))}
    </group>
  );
}

// ─── Rack wall ────────────────────────────────────────────────────────────────
// Warehouse Ops wireframe rack style: orange beams, steel uprights, cardboard boxes, no back panel
function RackWall({zPos,flip}:{zPos:number;flip:boolean}) {
  const dz = flip ? -0.28 : 0.28; // box offset toward aisle face
  return (
    <group>
      {/* Upright posts at each bay boundary — matches Warehouse Ops style */}
      {Array.from({length:BAYS+1},(_,i)=>{
        const bx = RACK_X0 + i*BAY_W;
        return (
          <mesh key={i} position={[bx, RACK_H/2, zPos]}>
            <boxGeometry args={[0.14, RACK_H+0.3, 0.14]} />
            <meshStandardMaterial color="#6e6e6e" metalness={0.7} roughness={0.3} />
          </mesh>
        );
      })}
      {/* Horizontal level beams running full span — orange-rust, matches Warehouse Ops */}
      {Array.from({length:LEVELS+1},(_,l)=>(
        <mesh key={l} position={[(RACK_X0+RACK_X1)/2, l*LEVEL_H, zPos]}>
          <boxGeometry args={[RACK_SPAN+0.1, 0.10, 0.10]} />
          <meshStandardMaterial color="#c04a00" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {/* Cardboard boxes per slot (outer static walls, ~70% fill) */}
      {Array.from({length:LEVELS},(_,l)=>
        Array.from({length:BAYS},(_,b)=>{
          if((l*7+b*3)%5===0) return null;
          return (
            <mesh key={`${l}-${b}`}
                  position={[RACK_X0+(b+0.5)*BAY_W, l*LEVEL_H+LEVEL_H/2, zPos+dz]}>
              <boxGeometry args={[BAY_W-0.38, LEVEL_H-0.28, 0.58]} />
              <meshStandardMaterial color={SKU_COLORS[(l*3+b*5)%SKU_COLORS.length]} roughness={0.88} />
            </mesh>
          );
        })
      )}
    </group>
  );
}

// ─── Conveyor structure (static) ──────────────────────────────────────────────
function ConveyorStructure({zPos,atScenario}:{zPos:number;atScenario:string|null}) {
  const len = CONV_END_X - SHIP_IO_X;
  const midX = SHIP_IO_X + len/2;
  return (
    <group position={[0,1.08,zPos]}>
      <mesh position={[midX,0,0]}>
        <boxGeometry args={[len,0.18,1.55]} />
        <meshStandardMaterial color="#374151" roughness={0.92} />
      </mesh>
      {Array.from({length:Math.floor(len)},(_,i)=>(
        <mesh key={i} position={[SHIP_IO_X+i+0.5,0.10,0]}>
          <boxGeometry args={[0.80,0.024,1.42]} />
          <meshStandardMaterial color="#1f2937" roughness={1} />
        </mesh>
      ))}
      {!atScenario&&(
        <mesh position={[midX,0.112,0]}>
          <boxGeometry args={[len*0.28,0.028,1.44]} />
          <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.35} transparent opacity={0.45} />
        </mesh>
      )}
      {[SHIP_IO_X+2,midX,CONV_END_X-2].map((lx,i)=>(
        <mesh key={i} position={[lx,-0.55,0]}>
          <boxGeometry args={[0.18,0.74,1.6]} />
          <meshStandardMaterial color="#6b7280" roughness={0.88} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Dock wall ────────────────────────────────────────────────────────────────
function DockWall({side}:{side:'recv'|'ship'}) {
  // recv: wall at RECV_DOCK_X, trucks back in from -x. Outward (toward truck) = -x.
  // ship: wall at SHIP_DOCK_X, trucks back in from +x. Outward (toward truck) = +x.
  const xC   = side==='recv' ? RECV_DOCK_X : SHIP_DOCK_X;
  const dOut = side==='recv' ? -1 : 1;

  const WALL_H = 10.5; const WALL_T = 0.75;
  const DOOR_W = 5.6;  const DOOR_H = 4.7;   // slightly larger than truck trailer
  const HOOD_D = 1.6;  const HOOD_T = 0.28;  // dock shelter depth + frame thickness
  const MID_W  = AISLE_Z[1]*2 - DOOR_W;      // wall between the two bays ≈ 10.4

  return (
    <group position={[xC, 0, 0]}>
      {/* ── Continuous wall: 3 solid panels (beside/between openings) ── */}
      <mesh position={[0, WALL_H/2, -(AISLE_Z[1] + DOOR_W/2 + 3.5)/1]}>
        <boxGeometry args={[WALL_T, WALL_H, 7]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.88} />
      </mesh>
      <mesh position={[0, WALL_H/2, 0]}>
        <boxGeometry args={[WALL_T, WALL_H, MID_W]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.88} />
      </mesh>
      <mesh position={[0, WALL_H/2, +(AISLE_Z[1] + DOOR_W/2 + 3.5)/1]}>
        <boxGeometry args={[WALL_T, WALL_H, 7]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.88} />
      </mesh>
      {/* Above-door header panels */}
      {AISLE_Z.map(z=>(
        <mesh key={z} position={[0, DOOR_H+(WALL_H-DOOR_H)/2, z]}>
          <boxGeometry args={[WALL_T, WALL_H-DOOR_H, DOOR_W+WALL_T]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.88} />
        </mesh>
      ))}
      {/* Base slab / curb */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[WALL_T+0.1, 0.4, 30]} />
        <meshStandardMaterial color="#475569" roughness={0.92} />
      </mesh>

      {/* ── Per-bay dock infrastructure ── */}
      {AISLE_Z.map(z=>(
        <group key={z} position={[0, 0, z]}>
          {/* Dark door opening face — both exterior AND interior so visible from both sides */}
          <mesh position={[dOut*(WALL_T/2-0.02), DOOR_H/2, 0]}>
            <boxGeometry args={[0.04, DOOR_H, DOOR_W]} />
            <meshStandardMaterial color="#111827" roughness={1} />
          </mesh>
          <mesh position={[-dOut*(WALL_T/2-0.02), DOOR_H/2, 0]}>
            <boxGeometry args={[0.04, DOOR_H, DOOR_W]} />
            <meshStandardMaterial color="#1e293b" roughness={0.95} />
          </mesh>
          {/* Interior door frame (visible from inside warehouse) */}
          {/* Sides of frame */}
          {([-1,1] as const).map(s=>(
            <mesh key={s} position={[-dOut*(WALL_T/2), DOOR_H/2, s*(DOOR_W/2+0.22)]}>
              <boxGeometry args={[WALL_T, DOOR_H, 0.44]} />
              <meshStandardMaterial color="#64748b" roughness={0.85} />
            </mesh>
          ))}
          {/* Header of frame */}
          <mesh position={[-dOut*(WALL_T/2), DOOR_H+0.22, 0]}>
            <boxGeometry args={[WALL_T, 0.44, DOOR_W+0.88]} />
            <meshStandardMaterial color="#64748b" roughness={0.85} />
          </mesh>

          {/* Dock shelter hood — extends outward from wall, frames truck trailer */}
          {/* Top beam */}
          <mesh position={[dOut*(WALL_T/2+HOOD_D/2), DOOR_H+HOOD_T/2, 0]}>
            <boxGeometry args={[HOOD_D, HOOD_T, DOOR_W+HOOD_T*2]} />
            <meshStandardMaterial color="#64748b" roughness={0.72} metalness={0.2} />
          </mesh>
          {/* Side beams */}
          {([-1,1] as const).map(s=>(
            <mesh key={s} position={[dOut*(WALL_T/2+HOOD_D/2), DOOR_H/2, s*(DOOR_W/2+HOOD_T/2)]}>
              <boxGeometry args={[HOOD_D, DOOR_H, HOOD_T]} />
              <meshStandardMaterial color="#64748b" roughness={0.72} metalness={0.2} />
            </mesh>
          ))}
          {/* Hood corner supports (vertical at outer edge) */}
          {([-1,1] as const).map(s=>(
            <mesh key={s} position={[dOut*(WALL_T/2+HOOD_D), DOOR_H/2, s*(DOOR_W/2+HOOD_T/2)]}>
              <boxGeometry args={[0.12, DOOR_H+HOOD_T, HOOD_T]} />
              <meshStandardMaterial color="#475569" roughness={0.78} metalness={0.3} />
            </mesh>
          ))}

          {/* Dock bumpers — yellow rubber pads on exterior wall face */}
          {([-1,1] as const).map(s=>(
            <mesh key={s} position={[dOut*(WALL_T/2+0.14), 0.9, s*(DOOR_W/2-0.7)]}>
              <boxGeometry args={[0.28, 0.7, 0.36]} />
              <meshStandardMaterial color="#f59e0b" roughness={0.55} />
            </mesh>
          ))}

          {/* Dock leveler plate — spans both sides of wall, visible from interior */}
          <mesh position={[0, 0.07, 0]}>
            <boxGeometry args={[2.8, 0.14, DOOR_W*0.88]} />
            <meshStandardMaterial color="#374151" roughness={0.78} metalness={0.3} />
          </mesh>
          {/* Interior dock approach stripe (visible from inside) */}
          <mesh position={[-dOut*1.5, 0.003, 0]} rotation={[Math.PI/2,0,0]}>
            <planeGeometry args={[0.12, DOOR_W*0.85]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.9} />
          </mesh>

          {/* Dock light — green LED bar above door */}
          <mesh position={[dOut*(WALL_T/2+0.14), DOOR_H+HOOD_T+0.28, 0]}>
            <boxGeometry args={[0.18, 0.2, 1.4]} />
            <meshStandardMaterial color="#22c55e" roughness={0.4} emissive="#22c55e" emissiveIntensity={0.6} />
          </mesh>

          {/* Bay number plate */}
          <mesh position={[dOut*(WALL_T/2+0.18), DOOR_H+HOOD_T+0.82, 0]}>
            <boxGeometry args={[0.12, 0.28, 0.65]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>

          {/* Approach stripe on floor (yellow painted line) */}
          <mesh position={[dOut*(WALL_T/2+0.9), 0.002, 0]} rotation={[Math.PI/2,0,0]}>
            <planeGeometry args={[0.12, DOOR_W*0.9]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.9} />
          </mesh>
          <mesh position={[dOut*(WALL_T/2+1.4), 0.002, 0]} rotation={[Math.PI/2,0,0]}>
            <planeGeometry args={[0.12, DOOR_W*0.9]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Truck mesh ───────────────────────────────────────────────────────────────
// Local x: trailer back=-10, trailer front=-1, cab=0.3..2.9
// rotation=0 → cab faces +x (into building), trailer toward -x (wall)
function TruckMesh({color='#94a3b8'}:{color?:string}) {
  return (
    <group>
      <mesh position={[-5.5,2.2,0]}>
        <boxGeometry args={[9.0,3.8,5.0]} />
        <meshStandardMaterial color={color} roughness={0.82} />
      </mesh>
      <mesh position={[-1.02,2.2,0]}>
        <boxGeometry args={[0.05,3.8,5.0]} />
        <meshStandardMaterial color="#475569" roughness={1} />
      </mesh>
      <mesh position={[1.6,2.0,0]}>
        <boxGeometry args={[2.6,3.4,5.0]} />
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.1} />
      </mesh>
      <mesh position={[2.86,2.6,0]}>
        <boxGeometry args={[0.06,1.6,3.6]} />
        <meshStandardMaterial color="#7dd3fc" roughness={0.1} metalness={0.6} transparent opacity={0.7} />
      </mesh>
      {/* Wheels: truck travels in x, axle in z → rotation=[PI/2,0,0] */}
      {[-7.5,-4.5,0.8,1.8].flatMap(wx=>
        [-2.6,2.6].map(wz=>(
          <mesh key={`${wx}-${wz}`} position={[wx,0.55,wz]} rotation={[Math.PI/2,0,0]}>
            <cylinderGeometry args={[0.55,0.55,0.55,14]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>
        ))
      )}
    </group>
  );
}

// ─── Inbound truck ────────────────────────────────────────────────────────────
// rotation=0: cab faces +x (inside building), trailer back at truckX-10
// Docked: truckX = RECV_TRUCK_DOCKED = -30 → trailer back at -40 = dock wall ✓
type TPhase = 'approach'|'docked'|'depart'|'reset';
function InboundTruck({zPos,color,stateRef}:{zPos:number;color:string;stateRef:React.MutableRefObject<AisleState>}) {
  const g   = useRef<THREE.Group>(null);
  const ph  = useRef<TPhase>('reset');
  const tx  = useRef(RECV_TRUCK_DOCKED-38);
  const tmr = useRef(Math.random()*5);

  // Approach: truck appears just outside the dock, backs in. Depart: drives 6 units out and vanishes.
  const RECV_APPEAR_X = RECV_DOCK_X - 14;  // short approach distance
  const RECV_VANISH_X = RECV_DOCK_X - 7;   // hide once truck clears dock hood

  useFrame((_,dt)=>{
    if(!g.current) return;
    const ds=Math.min(dt,0.05);
    tmr.current+=ds;
    if(ph.current==='approach'){
      g.current.visible=true;
      tx.current+=(RECV_TRUCK_DOCKED-tx.current)*Math.min(3.5*ds,0.95);
      if(Math.abs(tx.current-RECV_TRUCK_DOCKED)<0.12){ ph.current='docked'; tmr.current=0; }
    } else if(ph.current==='docked'){
      stateRef.current.inboundDocked=true;
      if(stateRef.current.inboundBoxCount>=4){
        ph.current='depart'; tmr.current=0;
        stateRef.current.inboundDocked=false;
        stateRef.current.inboundBoxCount=0;
      }
    } else if(ph.current==='depart'){
      tx.current-=8*ds;
      if(tx.current<RECV_VANISH_X) g.current.visible=false; // disappear off-screen
      if(tx.current<RECV_APPEAR_X-2){ ph.current='reset'; tmr.current=0; }
    } else {
      stateRef.current.inboundDocked=false;
      g.current.visible=false;
      if(tmr.current>6){ ph.current='approach'; tx.current=RECV_APPEAR_X; }
    }
    g.current.position.x=tx.current;
  });

  return (
    <group ref={g} position={[RECV_APPEAR_X,0,zPos]} rotation={[0,Math.PI,0]} visible={false}>
      <TruckMesh color={color} />
    </group>
  );
}

// ─── Outbound truck ───────────────────────────────────────────────────────────
// rotation=π: cab faces -x (inside building toward shipping area), trailer back at truckX+10
// Docked: truckX = SHIP_TRUCK_DOCKED = 40 → trailer back at 50 = dock wall ✓
function OutboundTruck({zPos,color,stateRef}:{zPos:number;color:string;stateRef:React.MutableRefObject<AisleState>}) {
  const g   = useRef<THREE.Group>(null);
  const ph  = useRef<TPhase>('reset');
  const tx  = useRef(SHIP_TRUCK_DOCKED+42);
  const tmr = useRef(Math.random()*6+2);

  const SHIP_APPEAR_X = SHIP_DOCK_X + 14;  // short approach distance
  const SHIP_VANISH_X = SHIP_DOCK_X + 7;   // hide once truck clears dock hood

  useFrame((_,dt)=>{
    if(!g.current) return;
    const ds=Math.min(dt,0.05);
    tmr.current+=ds;
    if(ph.current==='approach'){
      g.current.visible=true;
      tx.current+=(SHIP_TRUCK_DOCKED-tx.current)*Math.min(3.5*ds,0.95);
      if(Math.abs(tx.current-SHIP_TRUCK_DOCKED)<0.12){ ph.current='docked'; tmr.current=0; }
    } else if(ph.current==='docked'){
      stateRef.current.outboundDocked=true;
      if(stateRef.current.outboundBoxCount>=4){
        ph.current='depart'; tmr.current=0;
        stateRef.current.outboundDocked=false;
        stateRef.current.outboundBoxCount=0;
      }
    } else if(ph.current==='depart'){
      tx.current+=8*ds;
      if(tx.current>SHIP_VANISH_X) g.current.visible=false;
      if(tx.current>SHIP_APPEAR_X+2){ ph.current='reset'; tmr.current=0; }
    } else {
      stateRef.current.outboundDocked=false;
      g.current.visible=false;
      if(tmr.current>6){ ph.current='approach'; tx.current=SHIP_APPEAR_X; }
    }
    g.current.position.x=tx.current;
  });

  return (
    <group ref={g} position={[SHIP_APPEAR_X,0,zPos]} rotation={[0,0,0]} visible={false}>
      <TruckMesh color={color} />
    </group>
  );
}

// ─── Worker (3× scale) ────────────────────────────────────────────────────────
// Only walks when inboundDocked. Carries pallet from dock area to ASRS I/O.
type WPhase = 'wait'|'walk_load'|'drop'|'walk_back';
function Worker({zPos,stateRef,delay=0}:{zPos:number;stateRef:React.MutableRefObject<AisleState>;delay?:number}) {
  const g    = useRef<THREE.Group>(null);
  const pal  = useRef<THREE.Group>(null);
  const ph   = useRef<WPhase>('wait');
  // With rot=π at RECV_TRUCK_DOCKED=-41.4: trailer inside end = -41.4+10 = -31.4
  const TRAILER_DOOR_X = RECV_TRUCK_DOCKED + 10;
  const wx   = useRef(TRAILER_DOOR_X);
  const tmr  = useRef(delay);
  const bobT = useRef(0);
  const LOAD_X = RECV_IO_X - 1;

  useFrame((_,dt)=>{
    const gr=g.current; if(!gr) return;
    const ds=Math.min(dt,0.05);
    tmr.current+=ds;
    const docked=stateRef.current.inboundDocked;

    if(ph.current==='wait'){
      if(!docked) tmr.current=0; // reset timer when truck absent so worker doesn't start mid-approach
      if(docked && tmr.current>2.0){ ph.current='walk_load'; tmr.current=0; bobT.current=0; }
    } else if(ph.current==='walk_load'){
      if(!docked){ ph.current='wait'; return; }
      bobT.current+=ds*5;
      wx.current+=(LOAD_X-wx.current)*Math.min(3.5*ds,0.95);
      if(Math.abs(wx.current-LOAD_X)<0.15){ ph.current='drop'; tmr.current=0; }
    } else if(ph.current==='drop'){
      if(tmr.current>0.9){
        stateRef.current.inboundBoxCount++;
        ph.current='walk_back'; tmr.current=0;
      }
    } else {
      bobT.current+=ds*5;
      wx.current+=(TRAILER_DOOR_X-wx.current)*Math.min(3.5*ds,0.95);
      if(Math.abs(wx.current-TRAILER_DOOR_X)<0.15){ ph.current='wait'; tmr.current=0; }
    }

    const hasPallet = ph.current==='walk_load'||ph.current==='drop';
    const bob = (ph.current==='walk_load'||ph.current==='walk_back') ? Math.abs(Math.sin(bobT.current))*0.12 : 0;
    gr.position.set(wx.current, bob, zPos);
    gr.rotation.y = ph.current==='walk_load' ? Math.PI : 0;
    if(pal.current) pal.current.visible=hasPallet;
  });

  return (
    <group ref={g} position={[TRAILER_DOOR_X,0,zPos]}>
      {/* Body */}
      <mesh position={[0,3.15,0]}>
        <boxGeometry args={[1.1,2.1,0.82]} />
        <meshStandardMaterial color="#1e40af" roughness={0.9} />
      </mesh>
      {/* Head */}
      <mesh position={[0,4.9,0]}>
        <sphereGeometry args={[0.54,8,8]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.85} />
      </mesh>
      {/* Hard hat */}
      <mesh position={[0,5.58,0]}>
        <cylinderGeometry args={[0.66,0.60,0.38,8]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.75} />
      </mesh>
      {/* Legs */}
      {[-0.30,0.30].map((xo,i)=>(
        <mesh key={i} position={[xo,1.12,0]}>
          <boxGeometry args={[0.44,1.64,0.72]} />
          <meshStandardMaterial color="#374151" roughness={0.9} />
        </mesh>
      ))}
      {/* Feet */}
      {[-0.30,0.30].map((xo,i)=>(
        <mesh key={i} position={[xo,0.20,0.15]}>
          <boxGeometry args={[0.38,0.30,0.72]} />
          <meshStandardMaterial color="#1e293b" roughness={0.85} />
        </mesh>
      ))}
      {/* Carried pallet */}
      <group ref={pal} position={[1.6,2.2,0]}>
        <mesh position={[0,0.08,0]}>
          <boxGeometry args={[2.5,0.36,2.2]} />
          <meshStandardMaterial color="#92400e" roughness={0.9} />
        </mesh>
        {[0,1,2].map(i=>(
          <mesh key={i} position={[0,0.72+i*0.78,0]}>
            <boxGeometry args={[2.2,0.65,2.0]} />
            <meshStandardMaterial color={SKU_COLORS[(i+2)%SKU_COLORS.length]} roughness={0.87} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ─── ASRS Crane — one per aisle, alternating put-away / retrieval cycle ────────
// Cycle: recv_approach → recv_pick → putaway_travel → putaway_deposit
//      → retrieve_travel → retrieve_pick → ship_travel → ship_deposit → repeat
type CPhase = 'recv_approach'|'recv_pick'|'putaway_travel'|'putaway_deposit'
             |'retrieve_travel'|'retrieve_pick'|'ship_travel'|'ship_deposit';

function ASRSCrane({zPos,stateRef,speedMult=1}:{zPos:number;stateRef:React.MutableRefObject<AisleState>;speedMult?:number}) {
  const craneRef = useRef<THREE.Group>(null);
  const liftRef  = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.Mesh>(null);

  const cx   = useRef(0);                  // world x of crane
  const ly   = useRef(0);                  // lift y
  const tx   = useRef(RECV_IO_X as number);
  const ty   = useRef(0);
  const ph        = useRef<CPhase>('recv_approach');
  const tmr       = useRef(0);
  const col       = useRef('#16a34a');
  const activeBay = useRef(0);
  const activeLvl = useRef(0);

  useFrame((_,dt)=>{
    const crane=craneRef.current; const lift=liftRef.current;
    if(!crane||!lift) return;
    const ds=Math.min(dt*speedMult,0.05);

    cx.current+=(tx.current-cx.current)*Math.min(9*ds,0.95);
    ly.current+=(ty.current-ly.current)*Math.min(7*ds,0.95);
    crane.position.x=cx.current;
    lift.position.y=ly.current;

    const atX=Math.abs(cx.current-tx.current)<0.15;
    const atY=Math.abs(ly.current-ty.current)<0.12;
    tmr.current+=ds;

    const randPutBay   = ()=> Math.floor(Math.random()*4);      // bays 0-3 (left half)
    const randRetrBay  = ()=> 4+Math.floor(Math.random()*4);    // bays 4-7 (right half)
    const randLevel    = ()=> Math.floor(Math.random()*LEVELS);

    if(ph.current==='recv_approach'){
      col.current='#16a34a';
      tx.current=RECV_IO_X; ty.current=0;
      if(atX&&atY&&stateRef.current.inboundDocked){ ph.current='recv_pick'; tmr.current=0; }
    } else if(ph.current==='recv_pick'){
      col.current='#d97706';
      if(tmr.current>0.9){
        const b=randPutBay(); const l=randLevel();
        activeBay.current=b; activeLvl.current=l;
        tx.current=RACK_X0+(b+0.5)*BAY_W; ty.current=l*LEVEL_H;
        ph.current='putaway_travel'; tmr.current=0;
      }
    } else if(ph.current==='putaway_travel'){
      col.current='#3b82f6';
      if(atX&&atY){ ph.current='putaway_deposit'; tmr.current=0; }
    } else if(ph.current==='putaway_deposit'){
      col.current='#7c3aed';
      if(tmr.current>0.7){
        // Mark this slot as occupied (box stored)
        stateRef.current.shelf[`${activeBay.current}-${activeLvl.current}`]=true;
        stateRef.current.shelfDirty=!stateRef.current.shelfDirty;
        const b=randRetrBay(); const l=randLevel();
        activeBay.current=b; activeLvl.current=l;
        tx.current=RACK_X0+(b+0.5)*BAY_W; ty.current=l*LEVEL_H;
        ph.current='retrieve_travel'; tmr.current=0;
      }
    } else if(ph.current==='retrieve_travel'){
      col.current='#0891b2';
      if(atX&&atY){ ph.current='retrieve_pick'; tmr.current=0; }
    } else if(ph.current==='retrieve_pick'){
      col.current='#d97706';
      if(tmr.current>0.7){
        // Mark slot as empty (box retrieved)
        stateRef.current.shelf[`${activeBay.current}-${activeLvl.current}`]=false;
        stateRef.current.shelfDirty=!stateRef.current.shelfDirty;
        tx.current=SHIP_IO_X; ty.current=0; ph.current='ship_travel'; tmr.current=0;
      }
    } else if(ph.current==='ship_travel'){
      col.current='#3b82f6';
      if(atX&&atY){ ph.current='ship_deposit'; tmr.current=0; }
    } else if(ph.current==='ship_deposit'){
      col.current='#16a34a';
      if(tmr.current>0.6){
        stateRef.current.craneDeposit=true;
        ph.current='recv_approach'; tmr.current=0;
      }
    }

    if(lightRef.current){
      const m=lightRef.current.material as THREE.MeshStandardMaterial;
      m.color.set(col.current); m.emissive.set(col.current);
    }
  });

  const railLen = SHIP_IO_X - RECV_IO_X + 2;
  const railCX  = (RECV_IO_X + SHIP_IO_X) / 2;

  return (
    <group position={[0,0,zPos]}>
      {/* Guide rail (static) */}
      <mesh position={[railCX,RACK_H+0.55,0]}>
        <boxGeometry args={[railLen,0.20,0.20]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Moving crane */}
      <group ref={craneRef} position={[0,0,0]}>
        <mesh position={[0,RACK_H+0.45,0]}>
          <boxGeometry args={[1.55,0.36,10.5]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.55} roughness={0.35} />
        </mesh>
        <mesh ref={lightRef} position={[0,RACK_H+0.82,0]}>
          <sphereGeometry args={[0.18,10,10]} />
          <meshStandardMaterial color="#16a34a" emissive="#16a34a" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0,RACK_H/2,0]}>
          <boxGeometry args={[0.18,RACK_H+0.38,0.18]} />
          <meshStandardMaterial color="#d97706" metalness={0.55} roughness={0.45} />
        </mesh>
        <group ref={liftRef}>
          <mesh>
            <boxGeometry args={[1.05,0.48,1.05]} />
            <meshStandardMaterial color="#92400e" metalness={0.5} roughness={0.4} />
          </mesh>
          {[-0.30,0.30].map((xo,i)=>(
            <mesh key={i} position={[xo,-0.34,0]}>
              <boxGeometry args={[0.11,0.13,0.88]} />
              <meshStandardMaterial color="#78350f" roughness={0.7} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

// ─── Forklift ─────────────────────────────────────────────────────────────────
// Parks at FORKLIFT_PARK_X. When pallet ready + outbound truck docked:
// drive to pallet → lift forks → drive into truck → lower → return
type FkPhase='idle'|'drive_to_pal'|'lift'|'drive_to_truck'|'lower'|'drive_back';
function Forklift({zPos,stateRef}:{zPos:number;stateRef:React.MutableRefObject<AisleState>}) {
  const g       = useRef<THREE.Group>(null);
  const forksRef = useRef<THREE.Group>(null);
  const palRef  = useRef<THREE.Mesh>(null);
  const ph      = useRef<FkPhase>('idle');
  const fx      = useRef(FORKLIFT_PARK_X);
  const forksY  = useRef(0);
  const tmr     = useRef(0);

  useFrame((_,dt)=>{
    const gr=g.current; const fk=forksRef.current;
    if(!gr||!fk) return;
    const ds=Math.min(dt,0.05);
    tmr.current+=ds;

    forksY.current+=(
      (ph.current==='lift'||ph.current==='drive_to_truck' ? 0.9 : 0)-forksY.current
    )*Math.min(4*ds,0.95);
    fk.position.y=forksY.current;

    // With rotation=π, forks point in -x world direction. Fork tip offset from center = 2.0 units left.
    // Pick-up: stop at PALLET_STAGE_X+2.0 so tip slides under pallet at PALLET_STAGE_X.
    // Delivery: stop at FORKLIFT_LOAD_X+2.0 so tip reaches inside trailer.
    const FORK_TIP_OFFSET = 2.0;
    const PICKUP_STOP  = PALLET_STAGE_X + FORK_TIP_OFFSET;  // 34
    const DELIVER_STOP = FORKLIFT_LOAD_X + FORK_TIP_OFFSET; // 46

    if(ph.current==='idle'){
      if(stateRef.current.palletReady&&stateRef.current.outboundDocked){
        ph.current='drive_to_pal'; tmr.current=0;
      }
    } else if(ph.current==='drive_to_pal'){
      fx.current+=(PICKUP_STOP-fx.current)*Math.min(5*ds,0.95);
      if(Math.abs(fx.current-PICKUP_STOP)<0.12){ ph.current='lift'; tmr.current=0; }
    } else if(ph.current==='lift'){
      if(tmr.current>0.9){
        stateRef.current.palletReady=false;
        // Signal AisleShipping to hide the stack meshes
        stateRef.current.palletLiftTrigger=!stateRef.current.palletLiftTrigger;
        if(palRef.current) palRef.current.visible=true;
        ph.current='drive_to_truck'; tmr.current=0;
      }
    } else if(ph.current==='drive_to_truck'){
      fx.current+=(DELIVER_STOP-fx.current)*Math.min(5*ds,0.95);
      if(Math.abs(fx.current-DELIVER_STOP)<0.12){ ph.current='lower'; tmr.current=0; }
    } else if(ph.current==='lower'){
      // Hide immediately as forks lower into the truck (don't wait)
      if(palRef.current) palRef.current.visible=false;
      if(tmr.current>0.8){
        stateRef.current.outboundBoxCount++;
        ph.current='drive_back'; tmr.current=0;
      }
    } else if(ph.current==='drive_back'){
      fx.current+=(FORKLIFT_PARK_X-fx.current)*Math.min(5*ds,0.95);
      if(Math.abs(fx.current-FORKLIFT_PARK_X)<0.12){ ph.current='idle'; tmr.current=0; }
    }

    gr.position.x=fx.current;
  });

  return (
    // rotation=π: forks face -x (toward palletizer), counterweight faces +x (toward truck)
    <group ref={g} position={[FORKLIFT_PARK_X,0,zPos]} rotation={[0,Math.PI,0]}>
      {/* Body */}
      <mesh position={[0,0.95,0]}>
        <boxGeometry args={[1.4,1.3,1.4]} />
        <meshStandardMaterial color="#d97706" roughness={0.72} />
      </mesh>
      {/* Cab/overhead guard */}
      <mesh position={[0,1.95,0]}>
        <boxGeometry args={[1.4,0.10,1.4]} />
        <meshStandardMaterial color="#92400e" roughness={0.75} />
      </mesh>
      {/* Counterweight */}
      <mesh position={[-0.9,0.65,0]}>
        <boxGeometry args={[0.38,0.8,1.2]} />
        <meshStandardMaterial color="#374151" roughness={0.85} />
      </mesh>
      {/* Wheels */}
      {[-0.5,0.5].flatMap(xo=>[-0.65,0.65].map(zo=>(
        <mesh key={`${xo}-${zo}`} position={[xo,0.28,zo]} rotation={[0,0,Math.PI/2]}>
          <cylinderGeometry args={[0.28,0.28,0.28,10]} />
          <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
      )))}
      {/* Mast (vertical) */}
      <mesh position={[0.78,1.2,0]}>
        <boxGeometry args={[0.18,2.4,0.85]} />
        <meshStandardMaterial color="#6b7280" roughness={0.78} metalness={0.3} />
      </mesh>
      {/* Fork carriage (moves vertically) */}
      <group ref={forksRef} position={[0.9,0.22,0]}>
        {[-0.38,0.38].map((zo,i)=>(
          <mesh key={i} position={[1.1,0,zo]}>
            <boxGeometry args={[2.2,0.10,0.20]} />
            <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.45} />
          </mesh>
        ))}
        {/* Lifted pallet (only visible when carrying) */}
        <mesh ref={palRef} position={[0.8,0.22,0]} visible={false}>
          <boxGeometry args={[1.6,0.18,1.6]} />
          <meshStandardMaterial color="#92400e" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

// ─── Belt items + palletizer arm (per aisle) ──────────────────────────────────
const BELT_LEN   = CONV_END_X - SHIP_IO_X;
const ARM_BASE_Y = 2.72;
const GRIP_DY    = -0.95;
type PalPhase = 'wait'|'face_pickup'|'grab'|'face_pallet'|'place'|'return_home';
const PALLET_FULL = 3;

function AisleShipping({zPos,atScenario,stateRef}:{zPos:number;atScenario:string|null;stateRef:React.MutableRefObject<AisleState>}) {
  const itemRefs  = useRef<(THREE.Mesh|null)[]>(Array(MAX_BELT).fill(null));
  const heldRef   = useRef<THREE.Mesh>(null);
  const armRef    = useRef<THREE.Group>(null);
  const stackRefs = useRef<(THREE.Mesh|null)[]>(Array(6).fill(null));

  const beltX    = useRef<number[]>(Array(MAX_BELT).fill(-1));
  const waiting  = useRef<boolean[]>(Array(MAX_BELT).fill(false));
  const bColors  = useRef<string[]>(Array(MAX_BELT).fill(SKU_COLORS[0]));
  const spawnT   = useRef(1.5+Math.random()*2);

  const palRot   = useRef(Math.PI);
  const palPh    = useRef<PalPhase>('wait');
  const palTmr   = useRef(0);
  const heldIdx  = useRef(-1);
  const heldCol  = useRef('#1d4ed8');
  const heldVis  = useRef(false);
  const stackCnt = useRef(0);
  const lastLiftTrigger = useRef<boolean>(false);

  useFrame((_,dt)=>{
    const ds=Math.min(dt,0.05);
    const active=stateRef.current.outboundDocked;

    // When forklift picks up the staged pallet, clear all stack visuals
    if(stateRef.current.palletLiftTrigger!==lastLiftTrigger.current){
      lastLiftTrigger.current=stateRef.current.palletLiftTrigger;
      stackRefs.current.forEach(m=>m&&(m.visible=false));
      stackCnt.current=0;
    }
    const beltSpd=atScenario==='at-conveyor-fix'?5.0:3.0;
    const palSpd =atScenario==='at-palletizer-cal'?2.2:1.0;

    // Spawn from crane deposit signal
    if(active && stateRef.current.craneDeposit){
      stateRef.current.craneDeposit=false;
      const fi=beltX.current.findIndex(x=>x<0);
      if(fi!==-1){
        const tooClose=beltX.current.some(x=>x>=0&&x<MIN_GAP);
        if(!tooClose){
          beltX.current[fi]=0; waiting.current[fi]=false;
          bColors.current[fi]=SKU_COLORS[Math.floor(Math.random()*SKU_COLORS.length)];
        }
      }
    }
    if(!active) stateRef.current.craneDeposit=false;

    // Advance belt items
    for(let i=0;i<MAX_BELT;i++){
      if(beltX.current[i]<0||waiting.current[i]) continue;
      const inJam=!atScenario&&beltX.current[i]>BELT_LEN*0.4&&beltX.current[i]<BELT_LEN*0.65;
      beltX.current[i]+=(inJam?beltSpd*0.12:beltSpd)*ds;
      if(beltX.current[i]>=BELT_LEN-0.35){ beltX.current[i]=BELT_LEN-0.35; waiting.current[i]=true; }
    }

    // Sync meshes
    for(let i=0;i<MAX_BELT;i++){
      const m=itemRefs.current[i]; if(!m) continue;
      if(beltX.current[i]<0||(waiting.current[i]&&heldIdx.current===i)){ m.visible=false; continue; }
      m.visible=active;
      m.position.set(SHIP_IO_X+beltX.current[i],1.08+0.31,zPos);
      (m.material as THREE.MeshStandardMaterial).color.set(bColors.current[i]);
    }

    // Palletizer arm
    palTmr.current+=ds;
    const arm=armRef.current; if(!arm) return;

    let dR=palRot.current-arm.rotation.y;
    while(dR>Math.PI) dR-=2*Math.PI; while(dR<-Math.PI) dR+=2*Math.PI;
    arm.rotation.y+=dR*Math.min(2.0*palSpd*ds,0.95);
    const armOk=Math.abs(dR)<0.04;

    if(!active){ palTmr.current=0; return; }

    if(palPh.current==='wait'){
      const wi=waiting.current.findIndex((w,i)=>w&&heldIdx.current===-1&&beltX.current[i]>=0);
      if(wi!==-1){ palPh.current='face_pickup'; palRot.current=Math.PI; palTmr.current=0; }
    } else if(palPh.current==='face_pickup'){
      if(armOk){
        palPh.current='grab'; palTmr.current=0;
        const wi=waiting.current.findIndex((w,i)=>w&&beltX.current[i]>=0);
        if(wi!==-1){ heldIdx.current=wi; heldCol.current=bColors.current[wi]; heldVis.current=true; }
      }
    } else if(palPh.current==='grab'){
      if(palTmr.current>0.38){ palPh.current='face_pallet'; palRot.current=0; palTmr.current=0; }
    } else if(palPh.current==='face_pallet'){
      if(armOk){ palPh.current='place'; palTmr.current=0; }
    } else if(palPh.current==='place'){
      if(palTmr.current>0.32){
        heldVis.current=false;
        if(heldIdx.current!==-1){ beltX.current[heldIdx.current]=-1; waiting.current[heldIdx.current]=false; heldIdx.current=-1; }
        const slot=stackCnt.current%PALLET_FULL;
        const sm=stackRefs.current[slot];
        if(sm){ sm.visible=true; (sm.material as THREE.MeshStandardMaterial).color.set(heldCol.current); }
        stackCnt.current++;
        if(stackCnt.current%PALLET_FULL===0){
          stateRef.current.palletReady=true;
          // Reset counter so next pallet starts from slot 0 after forklift lifts
        }
        palPh.current='return_home'; palRot.current=Math.PI; palTmr.current=0;
      }
    } else if(palPh.current==='return_home'){
      if(armOk){ palPh.current='wait'; palTmr.current=0; }
    }

    const held=heldRef.current;
    if(held){
      held.visible=heldVis.current&&active;
      if(heldVis.current){
        const r=arm.rotation.y;
        held.position.set(PAL_X_OFF+ARM_REACH*Math.cos(r), ARM_BASE_Y+GRIP_DY, zPos-ARM_REACH*Math.sin(r));
        (held.material as THREE.MeshStandardMaterial).color.set(heldCol.current);
      }
    }
  });

  return (
    <>
      {Array.from({length:MAX_BELT},(_,i)=>(
        <mesh key={i} ref={el=>{itemRefs.current[i]=el;}} visible={false} position={[-999,0,0]}>
          <boxGeometry args={[0.78,0.56,1.1]} />
          <meshStandardMaterial color={SKU_COLORS[i%SKU_COLORS.length]} roughness={0.85} />
        </mesh>
      ))}
      {/* Palletizer base */}
      <group position={[PAL_X_OFF,0,zPos]}>
        <mesh position={[0,0.38,0]}><cylinderGeometry args={[1.0,1.2,0.72,14]} /><meshStandardMaterial color="#374151" metalness={0.6} roughness={0.35} /></mesh>
        <mesh position={[0,1.5,0]}><boxGeometry args={[1.1,2.0,1.1]} /><meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.38} /></mesh>
      </group>
      {/* Palletizer arm */}
      <group position={[PAL_X_OFF,ARM_BASE_Y,zPos]}>
        <group ref={armRef} rotation={[0,Math.PI,0]}>
          <mesh position={[1.1,0,0]}><boxGeometry args={[2.2,0.22,0.22]} /><meshStandardMaterial color="#0891b2" metalness={0.7} roughness={0.28} /></mesh>
          <mesh position={[2.2,0,0]}><sphereGeometry args={[0.15,8,8]} /><meshStandardMaterial color="#0369a1" metalness={0.7} roughness={0.3} /></mesh>
          <mesh position={[2.35,-0.4,0]} rotation={[0,0,Math.PI/5]}><boxGeometry args={[0.18,0.84,0.18]} /><meshStandardMaterial color="#0369a1" metalness={0.65} roughness={0.32} /></mesh>
          <mesh position={[2.5,-0.9,0]}><boxGeometry args={[0.52,0.16,0.60]} /><meshStandardMaterial color="#075985" metalness={0.78} roughness={0.22} /></mesh>
        </group>
      </group>
      {/* Held item */}
      <mesh ref={heldRef} visible={false} position={[-999,0,0]}>
        <boxGeometry args={[0.78,0.56,1.1]} /><meshStandardMaterial color="#1d4ed8" roughness={0.85} />
      </mesh>
      {/* Pallet base */}
      <group position={[PALLET_STAGE_X,0,zPos]}>
        <mesh position={[0,0.10,0]}><boxGeometry args={[1.6,0.18,1.6]} /><meshStandardMaterial color="#92400e" roughness={0.9} /></mesh>
        {Array.from({length:6},(_,i)=>(
          <mesh key={i} ref={el=>{stackRefs.current[i]=el;}} position={[0,0.38+i*0.58,0]} visible={false}>
            <boxGeometry args={[1.42,0.48,1.30]} /><meshStandardMaterial color={SKU_COLORS[i%SKU_COLORS.length]} roughness={0.84} />
          </mesh>
        ))}
      </group>
    </>
  );
}

// ─── Live rack wall (aisle-facing, boxes appear/disappear) ───────────────────
function RackWallLive({zPos,flip,stateRef}:{zPos:number;flip:boolean;stateRef:React.MutableRefObject<AisleState>}) {
  const xC   = (RACK_X0+RACK_X1)/2;
  const dz   = flip ? -0.32 : 0.32;
  // One ref per bay×level slot
  const slotRefs = useRef<(THREE.Mesh|null)[]>(Array(BAYS*LEVELS).fill(null));
  const lastDirty = useRef<boolean>(false);

  useFrame(()=>{
    if(stateRef.current.shelfDirty===lastDirty.current) return;
    lastDirty.current=stateRef.current.shelfDirty;
    const shelf=stateRef.current.shelf;
    slotRefs.current.forEach((m,idx)=>{
      if(!m) return;
      const b=Math.floor(idx/LEVELS); const l=idx%LEVELS;
      m.visible=!!shelf[`${b}-${l}`];
    });
  });

  return (
    <group>
      {/* Upright posts — Warehouse Ops wireframe style */}
      {Array.from({length:BAYS+1},(_,i)=>{
        const bx = RACK_X0 + i*BAY_W;
        return (
          <mesh key={i} position={[bx, RACK_H/2, zPos]}>
            <boxGeometry args={[0.14, RACK_H+0.3, 0.14]} />
            <meshStandardMaterial color="#6e6e6e" metalness={0.7} roughness={0.3} />
          </mesh>
        );
      })}
      {/* Horizontal level beams — orange-rust, matches Warehouse Ops */}
      {Array.from({length:LEVELS+1},(_,l)=>(
        <mesh key={l} position={[(RACK_X0+RACK_X1)/2, l*LEVEL_H, zPos]}>
          <boxGeometry args={[RACK_SPAN+0.1, 0.10, 0.10]} />
          <meshStandardMaterial color="#c04a00" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {/* Per-slot box (visibility driven by shelf state) */}
      {Array.from({length:BAYS},(_,b)=>
        Array.from({length:LEVELS},(_,l)=>{
          const idx=b*LEVELS+l;
          const color=SKU_COLORS[(l*3+b*5)%SKU_COLORS.length];
          const initVisible=!!stateRef.current.shelf[`${b}-${l}`];
          const dz = flip ? -0.28 : 0.28;
          return (
            <mesh key={idx}
                  ref={el=>{slotRefs.current[idx]=el;}}
                  position={[RACK_X0+(b+0.5)*BAY_W, l*LEVEL_H+LEVEL_H/2, zPos+dz]}
                  visible={initVisible}>
              <boxGeometry args={[BAY_W-0.38, LEVEL_H-0.28, 0.58]} />
              <meshStandardMaterial color={color} roughness={0.88} />
            </mesh>
          );
        })
      )}
    </group>
  );
}

// ─── Per-aisle coordinator ────────────────────────────────────────────────────
function AisleSystem({aisleZ,recvColor,shipColor,delay=0}:{aisleZ:number;recvColor:string;shipColor:string;delay?:number}) {
  const { atScenario } = useSimulationStore();
  // Build initial shelf — retrieval zone (bays 4-7) starts 80% full, put-away zone (0-3) starts 30% full
  const initShelf: Record<string,boolean> = {};
  for(let b=0;b<BAYS;b++) for(let l=0;l<LEVELS;l++){
    const full = b>=4 ? (b*7+l*3)%5!==0 : (b*3+l*7)%4===0;
    initShelf[`${b}-${l}`] = full;
  }
  const stateRef = useRef<AisleState>({
    inboundDocked:false, outboundDocked:false, palletReady:false,
    craneDeposit:false, inboundBoxCount:0, outboundBoxCount:0,
    shelf: initShelf, shelfDirty:false, palletLiftTrigger:false,
  });
  const spd = atScenario==='at-mission-seq' ? 1.55 : 1;
  // Each aisle owns its inner rack wall (live) — aisleZ<0 uses +4 inner, aisleZ>0 uses -4 inner
  const innerZ = aisleZ < 0 ? RACK_INNER_Z[0] : RACK_INNER_Z[1];
  const innerFlip = aisleZ < 0 ? false : true;
  return (
    <>
      <RackWallLive zPos={innerZ} flip={innerFlip} stateRef={stateRef} />
      <InboundTruck  zPos={aisleZ} color={recvColor} stateRef={stateRef} />
      <OutboundTruck zPos={aisleZ} color={shipColor}  stateRef={stateRef} />
      <Worker        zPos={aisleZ} stateRef={stateRef} delay={delay} />
      <ASRSCrane     zPos={aisleZ} stateRef={stateRef} speedMult={spd} />
      <ConveyorStructure zPos={aisleZ} atScenario={atScenario} />
      <AisleShipping zPos={aisleZ} atScenario={atScenario} stateRef={stateRef} />
      <Forklift      zPos={aisleZ} stateRef={stateRef} />
    </>
  );
}

// ─── Scene ────────────────────────────────────────────────────────────────────
function SceneContents() {
  return (
    <>
      <color attach="background" args={['#b8ccd8']} />
      <fog attach="fog" args={['#b8ccd8',130,240]} />
      <Lighting />
      <Floor />
      {/* Outer rack walls — static (no ASRS activity on outer face) */}
      <RackWall zPos={RACK_OUTER_Z[0]} flip={true}  />
      <RackWall zPos={RACK_OUTER_Z[1]} flip={false} />
      {/* Inner rack walls are rendered live inside each AisleSystem */}
      <DockWall side="recv" />
      <DockWall side="ship" />
      <AisleSystem aisleZ={AISLE_Z[0]} recvColor="#dc6b19" shipColor="#1d4ed8" delay={0}   />
      <AisleSystem aisleZ={AISLE_Z[1]} recvColor="#b45309" shipColor="#1e40af" delay={4.5} />
      <OrbitControls target={[0,5,0]} minDistance={22} maxDistance={130}
        minPolarAngle={0.12} maxPolarAngle={Math.PI/2.05} />
    </>
  );
}

export function AdaptiveTwinScene() {
  return (
    <Canvas
      camera={{ position: [-4, 28, 62], fov: 62 }}
      gl={{ antialias:true, alpha:false, logarithmicDepthBuffer:true }}
      style={{ width:'100%', height:'100%' }}
    >
      <SceneContents />
    </Canvas>
  );
}
