"use client";

/**
 * Interactive Three.js viewer for field trajectory.
 * Renders verified view-model coordinates only — no trajectory mathematics.
 */

import { Canvas, useThree } from "@react-three/fiber";
import { Grid, Line, OrbitControls, Sphere } from "@react-three/drei";
import { Eye, EyeOff, Focus, Layers3, Lock, Unlock } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import {
  toSceneCoordinates,
  verticalScaleFactor,
  type TrajectoryMarkerPoint,
  type TrajectoryPathPoint,
  type TrajectoryVerticalScaleMode,
  type TrajectoryViewModel,
} from "@/domain";
import {
  resolveTrajectoryCanvasColors,
  TRAJECTORY_LIGHT_COLORS,
  type TrajectoryDrawColors,
} from "@/infrastructure/trajectory/trajectory-visual-theme";

type HoveredMarker = TrajectoryMarkerPoint;
type CameraPreset = "PERSPECTIVE" | "PLAN" | "SECTION";

interface ViewerLayers {
  readonly plan: boolean;
  readonly surveys: boolean;
  readonly projection: boolean;
  readonly recovery: boolean;
  readonly target: boolean;
}

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
  preset,
}: {
  model: TrajectoryViewModel;
  verticalScale: number;
  preset: CameraPreset;
}) {
  const { camera } = useThree();
  useEffect(() => {
    const span = Math.max(model.bounds.spanM, 1);
    if (preset === "PLAN") {
      camera.up.set(0, 0, 1);
      camera.position.set(0, span * 1.75, 0.001);
    } else if (preset === "SECTION") {
      camera.up.set(0, 1, 0);
      camera.position.set(span * 1.75, span * 0.08, 0);
    } else {
      camera.up.set(0, 1, 0);
      camera.position.set(span * 0.95, span * 0.72, span * 0.95);
    }
    camera.lookAt(0, 0, 0);
    Object.assign(camera, { near: 0.1, far: span * 50 });
    camera.updateProjectionMatrix();
  }, [camera, model.bounds.spanM, preset, verticalScale]);
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
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissive ? 0.45 : 0.12}
        metalness={0.18}
        roughness={0.32}
      />
    </mesh>
  );
}

function TrajectoryScene({
  model,
  verticalScaleMode,
  orbitLocked,
  cameraPreset,
  colors,
  layers,
  onHoverMarker,
}: {
  model: TrajectoryViewModel;
  verticalScaleMode: TrajectoryVerticalScaleMode;
  orbitLocked: boolean;
  cameraPreset: CameraPreset;
  colors: TrajectoryDrawColors;
  layers: ViewerLayers;
  onHoverMarker: (marker: HoveredMarker | null) => void;
}) {
  const verticalScale = verticalScaleFactor(verticalScaleMode);
  const planned = useMemo(
    () => pathToVectors(model.plannedPath, model, verticalScale),
    [model, verticalScale],
  );
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

  return (
    <>
      <color attach="background" args={[colors.background]} />
      <fog
        attach="fog"
        args={[colors.background, model.bounds.spanM * 1.4, model.bounds.spanM * 4]}
      />
      <ambientLight intensity={0.72} />
      <hemisphereLight
        color={colors.ink}
        groundColor={colors.background}
        intensity={0.55}
      />
      <directionalLight
        position={[40, 80, 20]}
        intensity={1.15}
        color={colors.ink}
      />
      <pointLight
        position={[-30, 20, -20]}
        intensity={0.5}
        color={colors.actual}
      />
      <Grid
        args={[model.bounds.spanM * 2, model.bounds.spanM * 2]}
        cellSize={Math.max(model.bounds.spanM / 20, 1)}
        sectionSize={Math.max(model.bounds.spanM / 5, 5)}
        fadeDistance={model.bounds.spanM * 4}
        cellColor={colors.grid}
        sectionColor={colors.muted}
        cellThickness={0.45}
        sectionThickness={0.8}
        fadeStrength={1.2}
        position={[0, -model.bounds.spanM * 0.01, 0]}
      />

      {layers.plan && planned.length > 1 ? (
        <Line
          points={planned}
          color={colors.planned}
          lineWidth={2}
          dashed
          dashSize={2.6}
          gapSize={1.8}
          transparent
          opacity={0.72}
        />
      ) : null}
      {actual.length > 1 ? (
        <Line points={actual} color={colors.actual} lineWidth={4} />
      ) : null}
      {layers.projection && projected.length > 1 ? (
        <Line
          points={projected}
          color={colors.muted}
          lineWidth={1.5}
          dashed
          dashSize={2}
          gapSize={1.5}
        />
      ) : null}
      {layers.recovery && curved.length > 1 ? (
        <Line
          points={curved}
          color={colors.target}
          lineWidth={3}
          dashed
          dashSize={3}
          gapSize={2}
        />
      ) : null}
      {layers.recovery && direct && direct.length > 1 ? (
        <Line points={direct} color={colors.target} lineWidth={2} />
      ) : null}
      {layers.projection && miss && miss.length > 1 ? (
        <Line
          points={miss}
          color={colors.selected}
          lineWidth={1.5}
          dashed
          dashSize={1}
          gapSize={1}
        />
      ) : null}

      {collarScene && collar ? (
        <group
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
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry
              args={[collarSize * 0.55, collarSize * 0.55, collarSize * 0.5, 20]}
            />
            <meshStandardMaterial
              color={colors.collar}
              emissive={colors.collar}
              emissiveIntensity={0.18}
              metalness={0.35}
              roughness={0.28}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[collarSize * 0.82, collarSize * 0.08, 10, 32]} />
            <meshBasicMaterial color={colors.collar} />
          </mesh>
        </group>
      ) : null}

      {layers.surveys
        ? surveyMarkers.map((marker) => (
        <MarkerMesh
          key={`${marker.sourceId ?? marker.measuredDepthM}-${marker.eastingM}`}
          marker={marker}
          model={model}
          verticalScale={verticalScale}
          color={colors.actual}
          radius={stationRadius}
          onHover={onHoverMarker}
        />
          ))
        : null}

      {latest ? (
        <MarkerMesh
          marker={latest}
          model={model}
          verticalScale={verticalScale}
          color={colors.selected}
          radius={latestRadius}
          emissive={colors.selected}
          onHover={onHoverMarker}
        />
      ) : null}

      {layers.projection && closest ? (
        <mesh position={[closest.x, closest.y, closest.z]}>
          <sphereGeometry args={[stationRadius * 0.9, 16, 16]} />
          <meshStandardMaterial
            color={colors.selected}
            emissive={colors.selected}
            emissiveIntensity={0.25}
          />
        </mesh>
      ) : null}

      {layers.target && targetCentre && targetRadius > 0 ? (
        <Sphere
          args={[targetRadius, 32, 32]}
          position={[targetCentre.x, targetCentre.y, targetCentre.z]}
        >
          <meshStandardMaterial
            color={colors.target}
            emissive={colors.target}
            emissiveIntensity={0.12}
            transparent
            opacity={0.16}
            wireframe={false}
            depthWrite={false}
          />
        </Sphere>
      ) : null}
      {layers.target && targetCentre && targetRadius > 0 ? (
        <Sphere
          args={[targetRadius, 24, 16]}
          position={[targetCentre.x, targetCentre.y, targetCentre.z]}
        >
          <meshBasicMaterial
            color={colors.target}
            wireframe
            transparent
            opacity={0.72}
          />
        </Sphere>
      ) : null}
      {layers.target && targetCentre ? (
        <group position={[targetCentre.x, targetCentre.y, targetCentre.z]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry
              args={[
                Math.max(targetRadius * 0.22, stationRadius),
                Math.max(targetRadius * 0.025, stationRadius * 0.09),
                10,
                36,
              ]}
            />
            <meshBasicMaterial color={colors.target} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry
              args={[
                Math.max(targetRadius * 0.22, stationRadius),
                Math.max(targetRadius * 0.025, stationRadius * 0.09),
                10,
                36,
              ]}
            />
            <meshBasicMaterial color={colors.target} />
          </mesh>
        </group>
      ) : null}

      <OrbitControls
        makeDefault
        enablePan={!orbitLocked}
        enableZoom={!orbitLocked}
        enableRotate={!orbitLocked}
      />
      <FitCamera
        model={model}
        verticalScale={verticalScale}
        preset={cameraPreset}
      />
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
      className="pointer-events-none absolute bottom-16 left-3 z-20 max-w-xs rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)]/95 px-3 py-2 text-xs text-[var(--tl-ink)] shadow-[var(--tl-shadow-md)] backdrop-blur"
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
  const rootRef = useRef<HTMLDivElement>(null);
  const [orbitLocked, setOrbitLocked] = useState(false);
  const [hovered, setHovered] = useState<HoveredMarker | null>(null);
  const [cameraPreset, setCameraPreset] =
    useState<CameraPreset>("PERSPECTIVE");
  const [colors, setColors] = useState<TrajectoryDrawColors>(
    TRAJECTORY_LIGHT_COLORS,
  );
  const [layers, setLayers] = useState<ViewerLayers>({
    plan: true,
    surveys: true,
    projection: true,
    recovery: true,
    target: true,
  });
  const hasCurved = (model.curvedRecoveryPath?.length ?? 0) > 1;
  const hasProjected = (model.projectedContinuationPath?.length ?? 0) > 1;
  const hasPlan = model.plannedPath.length > 1;

  useEffect(() => {
    const refresh = () =>
      setColors(resolveTrajectoryCanvasColors(rootRef.current));
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => observer.disconnect();
  }, []);

  function toggleLayer(layer: keyof ViewerLayers) {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }

  const layerOptions: Array<{
    key: keyof ViewerLayers;
    label: string;
    color: string;
    available: boolean;
  }> = [
    { key: "plan", label: "Plan", color: colors.planned, available: hasPlan },
    {
      key: "surveys",
      label: "Survey points",
      color: colors.actual,
      available: true,
    },
    {
      key: "projection",
      label: "Hold projection",
      color: colors.muted,
      available: hasProjected,
    },
    {
      key: "recovery",
      label: "Recovery",
      color: colors.target,
      available: hasCurved,
    },
    {
      key: "target",
      label: "Target",
      color: colors.target,
      available: Boolean(model.target),
    },
  ];

  return (
    <div
      ref={rootRef}
      className="relative h-[min(72vh,40rem)] min-h-[30rem] overflow-hidden rounded-[var(--tl-radius-lg)] border border-[var(--tl-border)] bg-[var(--tl-surface)] shadow-[var(--tl-shadow-md)]"
      data-testid="trajectory-r3f-viewer"
    >
      <Canvas
        camera={{ position: [40, 30, 40], fov: 46 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <TrajectoryScene
          model={model}
          verticalScaleMode={verticalScaleMode}
          orbitLocked={orbitLocked}
          cameraPreset={cameraPreset}
          colors={colors}
          layers={layers}
          onHoverMarker={setHovered}
        />
      </Canvas>

      <div
        className="absolute inset-x-3 top-3 z-10 flex flex-wrap items-center justify-between gap-2"
      >
        <div className="rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)]/92 px-3 py-2 shadow-[var(--tl-shadow-sm)] backdrop-blur">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em]">
            <Layers3 aria-hidden className="size-4 text-[var(--tl-primary)]" />
            Trajectory model
          </p>
          <p className="mt-0.5 text-[0.68rem] text-[var(--tl-ink-muted)]">
            Equal scale · E / N / RL
          </p>
        </div>
        <div className="flex rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)]/92 p-1 shadow-[var(--tl-shadow-sm)] backdrop-blur">
          {(["PERSPECTIVE", "PLAN", "SECTION"] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              className={`min-h-9 rounded-[var(--tl-radius-sm)] px-3 text-xs font-bold ${
                cameraPreset === preset
                  ? "bg-[var(--tl-primary)] text-white"
                  : "text-[var(--tl-ink-muted)]"
              }`}
              onClick={() => setCameraPreset(preset)}
            >
              {preset === "PERSPECTIVE" ? "3D" : preset === "PLAN" ? "Plan" : "Section"}
            </button>
          ))}
        </div>
      </div>

      <div
        className="absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-8rem)] flex-wrap gap-1.5 rounded-[var(--tl-radius-md)] border border-[var(--tl-border)] bg-[var(--tl-surface)]/92 p-1.5 shadow-[var(--tl-shadow-sm)] backdrop-blur"
        data-testid="trajectory-r3f-legend"
      >
        <span className="inline-flex min-h-8 items-center gap-2 rounded-[var(--tl-radius-sm)] px-2.5 text-xs font-bold">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: colors.actual }}
          />
          Actual
        </span>
        {layerOptions
          .filter(({ available }) => available)
          .map(({ key, label, color }) => (
            <button
              key={key}
              type="button"
              className={`inline-flex min-h-8 items-center gap-2 rounded-[var(--tl-radius-sm)] px-2.5 text-xs font-bold ${
                layers[key]
                  ? "bg-[var(--tl-surface-sunken)] text-[var(--tl-ink)]"
                  : "text-[var(--tl-ink-muted)] opacity-70"
              }`}
              onClick={() => toggleLayer(key)}
              aria-pressed={layers[key]}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              {label}
              {layers[key] ? (
                <Eye aria-hidden className="size-3" />
              ) : (
                <EyeOff aria-hidden className="size-3" />
              )}
            </button>
          ))}
      </div>

      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-2 rounded-[var(--tl-radius-sm)] border border-[var(--tl-border)] bg-[var(--tl-surface)]/95 px-3 text-xs font-bold text-[var(--tl-ink)] shadow-[var(--tl-shadow-sm)] backdrop-blur"
          onClick={() => setOrbitLocked((value) => !value)}
          data-testid="trajectory-r3f-orbit-lock"
          aria-pressed={orbitLocked}
        >
          {orbitLocked ? (
            <Lock aria-hidden className="size-3.5" />
          ) : (
            <Unlock aria-hidden className="size-3.5" />
          )}
          {orbitLocked ? "Unlock view" : "Lock view"}
        </button>
      </div>

      <div className="pointer-events-none absolute right-3 top-20 z-10 hidden rounded-full border border-[var(--tl-border)] bg-[var(--tl-surface)]/88 p-2 text-[0.65rem] font-bold text-[var(--tl-ink-muted)] shadow-[var(--tl-shadow-sm)] backdrop-blur sm:block">
        <div className="relative flex size-12 items-center justify-center">
          <span className="absolute top-0 text-[var(--tl-primary)]">N</span>
          <span className="absolute right-0">E</span>
          <Focus aria-hidden className="size-4" />
        </div>
      </div>

      {hovered ? <HoverTooltip marker={hovered} /> : null}
    </div>
  );
}
