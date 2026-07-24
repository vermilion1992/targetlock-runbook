"use client";

/**
 * Interactive Three.js viewer for field trajectory.
 * Renders verified view-model coordinates only — no trajectory mathematics.
 */

import { Canvas, useThree } from "@react-three/fiber";
import { Grid, Line, OrbitControls, Sphere } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

import {
  toSceneCoordinates,
  verticalScaleFactor,
  verticalScaleLabel,
  type TrajectoryPathPoint,
  type TrajectoryVerticalScaleMode,
  type TrajectoryViewModel,
} from "@/domain";

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

function TrajectoryScene({
  model,
  verticalScaleMode,
}: {
  model: TrajectoryViewModel;
  verticalScaleMode: TrajectoryVerticalScaleMode;
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
  const latest = model.markers.find((marker) => marker.kind === "SELECTED_SURVEY");
  const latestScene = latest
    ? toSceneCoordinates(latest, model.bounds, verticalScale)
    : null;
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

      {model.markers
        .filter((marker) => marker.kind === "SURVEY_STATION")
        .map((marker) => {
          const scene = toSceneCoordinates(marker, model.bounds, verticalScale);
          return (
            <mesh
              key={`${marker.sourceId ?? marker.measuredDepthM}-${marker.eastingM}`}
              position={[scene.x, scene.y, scene.z]}
            >
              <sphereGeometry args={[Math.max(model.bounds.spanM * 0.008, 0.4), 12, 12]} />
              <meshStandardMaterial color="#1e4a8a" />
            </mesh>
          );
        })}

      {latestScene ? (
        <mesh position={[latestScene.x, latestScene.y, latestScene.z]}>
          <sphereGeometry
            args={[Math.max(model.bounds.spanM * 0.014, 0.7), 16, 16]}
          />
          <meshStandardMaterial color="#d33c45" emissive="#7f1d1d" />
        </mesh>
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
          <meshBasicMaterial color="#b86e00" wireframe transparent opacity={0.55} />
        </Sphere>
      ) : null}

      <OrbitControls makeDefault enablePan enableZoom enableRotate />
      <FitCamera model={model} verticalScale={verticalScale} />
    </>
  );
}

export function TrajectoryR3FViewer({
  model,
  verticalScaleMode = "EQUAL",
}: {
  model: TrajectoryViewModel;
  verticalScaleMode?: TrajectoryVerticalScaleMode;
}) {
  return (
    <div
      className="relative h-[28rem] overflow-hidden rounded-[var(--tl-radius-md)] border border-[var(--tl-border)]"
      data-testid="trajectory-r3f-viewer"
    >
      <Canvas camera={{ position: [40, 30, 40], fov: 50 }}>
        <TrajectoryScene model={model} verticalScaleMode={verticalScaleMode} />
      </Canvas>
      <div className="pointer-events-none absolute left-3 top-3 space-y-1 rounded-md bg-white/85 px-2 py-1 text-xs text-[var(--tl-ink)] shadow-sm">
        <p className="font-semibold">3D · East / North / RL</p>
        <p>Vertical scale {verticalScaleLabel(verticalScaleMode)} (labelled)</p>
        <p>N = +Z · E = +X · RL = +Y</p>
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-white/85 px-2 py-1 text-xs text-[var(--tl-ink-muted)] shadow-sm">
        Orbit · pan · zoom · fit on load
      </div>
    </div>
  );
}
