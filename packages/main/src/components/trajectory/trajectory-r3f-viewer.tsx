"use client";

/**
 * Interactive Three.js viewer for field trajectory.
 * Renders verified view-model coordinates only — no trajectory mathematics.
 */

import { Canvas, useThree } from "@react-three/fiber";
import { Grid, Line, OrbitControls, Sphere } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

import {
  toSceneCoordinates,
  verticalScaleFactor,
  verticalScaleLabel,
  type TrajectoryMarkerPoint,
  type TrajectoryPathPoint,
  type TrajectoryVerticalScaleMode,
  type TrajectoryViewModel,
} from "@/domain";

type HoveredMarker = TrajectoryMarkerPoint;

function pathToVectors(
  path: readonly TrajectoryPathPoint[],
  model: TrajectoryViewModel,
  verticalScale: number,
): THREE.Vector3[] {
  return path.map((point) => {
    const scene = toSceneCoordinates(point, model.bounds, verticalScale);
    return new THREE.Vector3(scene.x, scene.y, scene.z);
  });
}

function FitCamera({
  model,
  verticalScale,
}: {
  model: TrajectoryViewModel;
  verticalScale: number;
}) {
  const { camera } = useThree();
  useEffect(() => {
    const span = Math.max(model.bounds.spanM, 1);
    // Three.js cameras are intentionally mutable scene objects.
    camera.position.set(span * 0.9, span * 0.7, span * 0.9);
    Object.assign(camera, { near: 0.1, far: span * 50 });
    camera.updateProjectionMatrix();
  }, [camera, model.bounds.spanM, verticalScale]);
  return null;
}

function MarkerMesh({
  marker,
  model,
  verticalScale,
  color,
  radius,
  emissive,
  onHover,
}: {
  marker: TrajectoryMarkerPoint;
  model: TrajectoryViewModel;
  verticalScale: number;
  color: string;
  radius: number;
  emissive?: string;
  onHover: (marker: HoveredMarker | null) => void;
}) {
  const scene = toSceneCoordinates(marker, model.bounds, verticalScale);
  return (
    <mesh
      position={[scene.x, scene.y, scene.z]}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHover(marker);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        onHover(null);
        document.body.style.cursor = "auto";
      }}
    >
      <sphereGeometry args={[radius, 16, 16]} />
      <meshStandardMaterial color={color} emissive={emissive} />
    </mesh>
  );
}

function TrajectoryScene({
  model,
  verticalScaleMode,
  orbitLocked,
  onHoverMarker,
}: {
  model: TrajectoryViewModel;
  verticalScaleMode: TrajectoryVerticalScaleMode;
  orbitLocked: boolean;
  onHoverMarker: (marker: HoveredMarker | null) => void;
}) {
  const verticalScale = verticalScaleFactor(verticalScaleMode);
  const actual = useMemo(
    () => pathToVectors(model.actualPath, model, verticalScale),
    [model, verticalScale],
  );
  const projected = useMemo(
    () =>
      pathToVectors(
        model.projectedContinuationPath ?? [],
        model,
        verticalScale,
      ),
    [model, verticalScale],
  );
  const curved = useMemo(
    () =>
      pathToVectors(model.curvedRecoveryPath ?? [], model, verticalScale),
    [model, verticalScale],
  );
  const direct =
    model.directToTargetLine === undefined
      ? null
      : pathToVectors(
          [model.directToTargetLine.from, model.directToTargetLine.to],
          model,
          verticalScale,
        );
  const miss =
    model.missVector === undefined
      ? null
      : pathToVectors(
          [model.missVector.from, model.missVector.to],
          model,
          verticalScale,
        );
  const closest =
    model.closestApproachPoint === undefined
      ? null
      : toSceneCoordinates(
          model.closestApproachPoint,
          model.bounds,
          verticalScale,
        );
  const targetRadius = model.target?.radiusM ?? 0;
  const targetCentre = model.target
    ? toSceneCoordinates(model.target, model.bounds, verticalScale)
    : null;
  const collar = model.markers.find((marker) => marker.kind === "COLLAR");
  const collarScene = collar
    ? toSceneCoordinates(collar, model.bounds, verticalScale)
    : null;
  const latest = model.markers.find(
    (marker) => marker.kind === "SELECTED_SURVEY",
  );
  const surveyMarkers = model.markers.filter(
    (marker) => marker.kind === "SURVEY_STATION",
  );
  const stationRadius = Math.max(model.bounds.spanM * 0.008, 0.4);
  const latestRadius = Math.max(model.bounds.spanM * 0.014, 0.7);
  const collarSize = Math.max(model.bounds.spanM * 0.018, 0.9);
  const axisLen = Math.max(model.bounds.spanM * 0.25, 10);

  return (
    <>
      <color attach="background" args={["#eef3f8"]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[40, 80, 20]} intensity={0.9} />
      <Grid
        args={[model.bounds.spanM * 2, model.bounds.spanM * 2]}
        cellSize={Math.max(model.bounds.spanM / 20, 1)}
        sectionSize={Math.max(model.bounds.spanM / 5, 5)}
        fadeDistance={model.bounds.spanM * 4}
        cellColor="#cbd6e2"
        sectionColor="#94a3b8"
        position={[0, -model.bounds.spanM * 0.01, 0]}
      />
      <axesHelper args={[axisLen]} />

      {actual.length > 1 ? (
        <Line points={actual} color="#1f6feb" lineWidth={3} />
      ) : null}
      {projected.length > 1 ? (
        <Line
          points={projected}
          color="#94a3b8"
          lineWidth={1.5}
          dashed
          dashSize={2}
          gapSize={1.5}
        />
      ) : null}
      {curved.length > 1 ? (
        <Line
          points={curved}
          color="#b86e00"
          lineWidth={2.5}
          dashed
          dashSize={3}
          gapSize={2}
        />
      ) : null}
      {direct && direct.length > 1 ? (
        <Line points={direct} color="#b86e00" lineWidth={2} />
      ) : null}
      {miss && miss.length > 1 ? (
        <Line
          points={miss}
          color="#d33c45"
          lineWidth={1.5}
          dashed
          dashSize={1}
          gapSize={1}
        />
      ) : null}

      {collarScene && collar ? (
        <mesh
          position={[collarScene.x, collarScene.y, collarScene.z]}
          onPointerOver={(event) => {
            event.stopPropagation();
            onHoverMarker(collar);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={(event) => {
            event.stopPropagation();
            onHoverMarker(null);
            document.body.style.cursor = "auto";
          }}
        >
          <boxGeometry args={[collarSize, collarSize, collarSize]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      ) : null}

      {surveyMarkers.map((marker) => (
        <MarkerMesh
          key={`${marker.sourceId ?? marker.measuredDepthM}-${marker.eastingM}`}
          marker={marker}
          model={model}
          verticalScale={verticalScale}
          color="#1e4a8a"
          radius={stationRadius}
          onHover={onHoverMarker}
        />
      ))}

      {latest ? (
        <MarkerMesh
          marker={latest}
          model={model}
          verticalScale={verticalScale}
          color="#d33c45"
          radius={latestRadius}
          emissive="#7f1d1d"
          onHover={onHoverMarker}
        />
      ) : null}

      {closest ? (
        <mesh position={[closest.x, closest.y, closest.z]}>
          <boxGeometry args={[1.2, 1.2, 1.2]} />
          <meshStandardMaterial color="#ea580c" />
        </mesh>
      ) : null}

      {targetCentre && targetRadius > 0 ? (
        <Sphere
          args={[targetRadius, 32, 32]}
          position={[targetCentre.x, targetCentre.y, targetCentre.z]}
        >
          <meshStandardMaterial
            color="#b86e00"
            transparent
            opacity={0.28}
            wireframe={false}
          />
        </Sphere>
      ) : null}
      {targetCentre && targetRadius > 0 ? (
        <Sphere
          args={[targetRadius, 24, 16]}
          position={[targetCentre.x, targetCentre.y, targetCentre.z]}
        >
          <meshBasicMaterial
            color="#b86e00"
            wireframe
            transparent
            opacity={0.55}
          />
        </Sphere>
      ) : null}

      <OrbitControls
        makeDefault
        enablePan={!orbitLocked}
        enableZoom={!orbitLocked}
        enableRotate={!orbitLocked}
      />
      <FitCamera model={model} verticalScale={verticalScale} />
    </>
  );
}

function formatHoverDegrees(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}°`;
}

function HoverTooltip({ marker }: { marker: HoveredMarker }) {
  return (
    <div
      className="pointer-events-none absolute left-3 bottom-3 max-w-xs rounded-md bg-white/95 px-3 py-2 text-xs text-[var(--tl-ink)] shadow-sm"
      data-testid="trajectory-r3f-hover-tooltip"
    >
      <p className="font-semibold">{marker.label}</p>
      <p className="mt-1 tabular-nums text-[var(--tl-ink-muted)]">
        MD {marker.measuredDepthM.toFixed(1)} m
      </p>
      <p className="tabular-nums text-[var(--tl-ink-muted)]">
        Dip / Az {formatHoverDegrees(marker.dipDegrees)} /{" "}
        {formatHoverDegrees(marker.azimuthDegrees)}
      </p>
      <p className="tabular-nums text-[var(--tl-ink-muted)]">
        E / N / RL {marker.eastingM.toFixed(1)} / {marker.northingM.toFixed(1)}{" "}
        / {marker.rlM.toFixed(1)}
      </p>
    </div>
  );
}

export function TrajectoryR3FViewer({
  model,
  verticalScaleMode = "EQUAL",
}: {
  model: TrajectoryViewModel;
  verticalScaleMode?: TrajectoryVerticalScaleMode;
}) {
  const [orbitLocked, setOrbitLocked] = useState(false);
  const [hovered, setHovered] = useState<HoveredMarker | null>(null);
  const hasCurved = (model.curvedRecoveryPath?.length ?? 0) > 1;
  const hasProjected = (model.projectedContinuationPath?.length ?? 0) > 1;
  const hasMiss = model.missVector !== undefined;

  return (
    <div
      className="relative h-[32rem] overflow-hidden rounded-[var(--tl-radius-md)] border border-[var(--tl-border)]"
      data-testid="trajectory-r3f-viewer"
    >
      <Canvas camera={{ position: [40, 30, 40], fov: 50 }}>
        <TrajectoryScene
          model={model}
          verticalScaleMode={verticalScaleMode}
          orbitLocked={orbitLocked}
          onHoverMarker={setHovered}
        />
      </Canvas>

      <div className="pointer-events-none absolute left-3 top-3 space-y-1 rounded-md bg-white/90 px-2 py-1.5 text-xs text-[var(--tl-ink)] shadow-sm">
        <p className="font-semibold">3D · East / North / RL</p>
        <p>Vertical scale {verticalScaleLabel(verticalScaleMode)}</p>
        <p className="text-[var(--tl-ink-muted)]">N = +Z · E = +X · RL = +Y</p>
      </div>

      <div
        className="pointer-events-none absolute right-3 top-3 space-y-1 rounded-md bg-white/90 px-2 py-1.5 text-xs text-[var(--tl-ink)] shadow-sm"
        data-testid="trajectory-r3f-legend"
      >
        <p className="font-semibold">Key</p>
        <p>
          <span className="mr-1 inline-block h-2 w-2 bg-[#0f172a]" /> Collar
        </p>
        <p>
          <span className="mr-1 inline-block h-0.5 w-3 bg-[#1f6feb]" /> Actual
        </p>
        {hasProjected ? (
          <p>
            <span className="mr-1 inline-block h-0.5 w-3 border-t border-dashed border-[#94a3b8]" />{" "}
            Current direction
          </p>
        ) : null}
        {hasCurved ? (
          <p>
            <span className="mr-1 inline-block h-0.5 w-3 border-t border-dashed border-[#b86e00]" />{" "}
            Recommended recovery
          </p>
        ) : null}
        <p>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#d33c45]" />{" "}
          Latest Survey
        </p>
        <p>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#b86e00]/40" />{" "}
          Target
        </p>
        {hasMiss ? (
          <p>
            <span className="mr-1 inline-block h-0.5 w-3 border-t border-dashed border-[#d33c45]" />{" "}
            Projected miss
          </p>
        ) : null}
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        <button
          type="button"
          className="rounded-md bg-white/95 px-3 py-1.5 text-xs font-semibold text-[var(--tl-ink)] shadow-sm"
          onClick={() => setOrbitLocked((value) => !value)}
          data-testid="trajectory-r3f-orbit-lock"
          aria-pressed={orbitLocked}
        >
          {orbitLocked ? "Unlock view" : "Lock view"}
        </button>
        <span className="rounded-md bg-white/85 px-2 py-1 text-xs text-[var(--tl-ink-muted)] shadow-sm">
          {orbitLocked ? "View locked" : "Orbit · pan · zoom"}
        </span>
      </div>

      {hovered ? <HoverTooltip marker={hovered} /> : null}
    </div>
  );
}
