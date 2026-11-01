"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Circle, Group, Text } from "react-konva";
import Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { Button } from "@/components/ui/button";
import type { Guest, Household, Landmark, WeddingTable } from "@/types/database";
import {
  getRectTableWidth,
  getSeatPositions,
  getTableFootprint,
  ROUND_TABLE_RADIUS,
  RECT_TABLE_HEIGHT,
  SEAT_RADIUS,
} from "@/lib/floorplan-geometry";
import { Maximize, Minus, Plus } from "lucide-react";

const LANDMARK_STYLE: Record<Landmark["type"], { fill: string; stroke: string; emoji: string }> = {
  dance_floor: { fill: "#f3e8ff", stroke: "#c084fc", emoji: "💃" },
  dj: { fill: "#dbeafe", stroke: "#60a5fa", emoji: "🎧" },
  entrance: { fill: "#dcfce7", stroke: "#4ade80", emoji: "🚪" },
  buffet: { fill: "#fef3c7", stroke: "#fbbf24", emoji: "🍽️" },
};

/** Zoom à partir duquel les prénoms s'affichent à côté des chaises. */
const NAMES_MIN_SCALE = 0.75;
const ZOOM_STEP = 1.35;

export type FloorplanMode = "place" | "edit";

interface View {
  x: number;
  y: number;
  scale: number;
}

interface FloorplanCanvasProps {
  household: Household;
  tables: WeddingTable[];
  guests: Guest[];
  mode: FloorplanMode;
  selectedGuestId: string | null;
  /** Table touchée ; seatIndex est renseigné si le doigt était sur une chaise. */
  onTableTap: (tableId: string, seatIndex: number | null) => void;
  onDropGuest: (guestId: string, tableId: string, seatIndex: number | null) => void;
  onTableDragEnd: (tableId: string, x: number, y: number) => void;
  onTableResize: (tableId: string, scale: number) => void;
  onLandmarkDragEnd: (landmarkId: string, x: number, y: number) => void;
  onLandmarkResize: (landmarkId: string, w: number, h: number) => void;
  onLandmarkRemove: (landmarkId: string) => void;
}

function useContainerSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, ...size };
}

/** Lit « seat|<tableId>|<index> » sur la forme touchée. */
function seatFromTarget(target: Konva.Node): { tableId: string; seatIndex: number } | null {
  const name = target.name();
  if (!name.startsWith("seat|")) return null;
  const [, tableId, index] = name.split("|");
  return { tableId, seatIndex: Number(index) };
}

export function FloorplanCanvas({
  household,
  tables,
  guests,
  mode,
  selectedGuestId,
  onTableTap,
  onDropGuest,
  onTableDragEnd,
  onTableResize,
  onLandmarkDragEnd,
  onLandmarkResize,
  onLandmarkRemove,
}: FloorplanCanvasProps) {
  const { ref: wrapperRef, width, height } = useContainerSize();
  const stageRef = useRef<Konva.Stage>(null);
  const [resizingLandmark, setResizingLandmark] = useState<{ id: string; w: number; h: number } | null>(null);
  const [resizingTable, setResizingTable] = useState<{ id: string; scale: number } | null>(null);
  const editing = mode === "edit";
  // Élément sélectionné en mode disposition : lui seul affiche ses poignées.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const roomW = household.room_width;
  const roomH = household.room_height;
  const roomWidth = household.room_shape === "square" ? Math.min(roomW, roomH) : roomW;
  const roomHeight = household.room_shape === "square" ? Math.min(roomW, roomH) : roomH;

  // ---------------------------------------------------------------------------
  // Vue (zoom + déplacement). Pendant un geste, la scène est modifiée
  // directement (fluide, sans rendu React) ; l'état est mis à jour à la fin.
  // ---------------------------------------------------------------------------

  // Après une réduction de la salle, un élément peut se retrouver hors du plan :
  // on l'affiche au bord pour qu'il reste visible et déplaçable.
  const clampX = (x: number) => Math.min(Math.max(x, 0), Math.max(roomW - 40, 0));
  const clampY = (y: number) => Math.min(Math.max(y, 0), Math.max(roomH - 40, 0));

  // Emprise de tout ce qui est dessiné (salle + tables qui débordent + repères).
  // Recalculée quand on ajoute ou retire un élément, pas à chaque déplacement :
  // sinon le cadre changerait de hauteur et la vue sauterait pendant qu'on
  // arrange la salle.
  const bounds = useMemo(() => {
    let minX = 0;
    let minY = 0;
    let maxX = roomWidth;
    let maxY = roomHeight;
    for (const t of tables) {
      const fp = getTableFootprint(t.type, t.capacity);
      const halfW = (fp.width / 2) * (t.scale ?? 1) + 12;
      const halfH = (fp.height / 2) * (t.scale ?? 1) + 12;
      const x = clampX(t.pos_x);
      const y = clampY(t.pos_y);
      minX = Math.min(minX, x - halfW);
      minY = Math.min(minY, y - halfH);
      maxX = Math.max(maxX, x + halfW);
      maxY = Math.max(maxY, y + halfH);
    }
    for (const lm of household.landmarks) {
      maxX = Math.max(maxX, clampX(lm.pos_x) + lm.w);
      maxY = Math.max(maxY, clampY(lm.pos_y) + lm.h);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- volontairement figé pendant les déplacements (voir plus haut)
  }, [roomWidth, roomHeight, tables.length, household.landmarks.length]);

  // Le cadre prend la proportion du plan : pas de grande bande vide au-dessus
  // et en dessous d'une salle tout en longueur.
  const frameHeight = width ? Math.max(260, Math.round((width * bounds.height) / bounds.width)) : 0;

  const fitView = useCallback((): View | null => {
    if (!width || !height) return null;
    const margin = 10;
    const scale = Math.min((width - margin * 2) / bounds.width, (height - margin * 2) / bounds.height);
    return {
      scale,
      x: (width - bounds.width * scale) / 2 - bounds.x * scale,
      y: (height - bounds.height * scale) / 2 - bounds.y * scale,
    };
  }, [width, height, bounds]);

  const [view, setView] = useState<View | null>(null);
  const fitKey = `${width}x${height}|${bounds.x},${bounds.y},${bounds.width},${bounds.height}`;
  const [lastFitKey, setLastFitKey] = useState("");
  if (fitKey !== lastFitKey && width && height) {
    // Nouvelle taille d'écran, de salle ou nouvel élément : on recadre sur tout le plan.
    setLastFitKey(fitKey);
    setView(fitView());
  }

  const minScale = (fitView()?.scale ?? 0.2) * 0.6;
  const maxScale = Math.max(3, minScale * 12);
  const clampScale = useCallback(
    (s: number) => Math.min(maxScale, Math.max(minScale, s)),
    [minScale, maxScale]
  );

  const commitView = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    setView({ x: stage.x(), y: stage.y(), scale: stage.scaleX() });
  }, []);

  /** Zoome en gardant fixe le point (px, py) de l'écran. */
  const zoomAt = useCallback(
    (nextScale: number, px: number, py: number, commit = true) => {
      const stage = stageRef.current;
      if (!stage) return;
      const old = stage.scaleX();
      const scale = clampScale(nextScale);
      const pointTo = { x: (px - stage.x()) / old, y: (py - stage.y()) / old };
      stage.scale({ x: scale, y: scale });
      stage.position({ x: px - pointTo.x * scale, y: py - pointTo.y * scale });
      stage.batchDraw();
      if (commit) commitView();
    },
    [clampScale, commitView]
  );

  function zoomButton(factor: number) {
    const stage = stageRef.current;
    if (!stage) return;
    zoomAt(stage.scaleX() * factor, width / 2, height / 2);
  }

  function handleWheel(e: KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;
    // Pincement sur pavé tactile = wheel + ctrlKey : on zoome plus finement.
    const intensity = e.evt.ctrlKey ? 0.01 : 0.0015;
    zoomAt(stage.scaleX() * Math.exp(-e.evt.deltaY * intensity), pointer.x, pointer.y);
  }

  // ---------------------------------------------------------------------------
  // Gestes : un doigt (ou la souris) déplace la vue, deux doigts zooment.
  // Gérés à la main plutôt qu'avec le glisser de Konva, qui ne sait pas
  // passer proprement d'un doigt à deux.
  // ---------------------------------------------------------------------------
  type Point = { x: number; y: number };
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<
    | { kind: "pan"; start: Point; origin: Point; moved: boolean }
    | { kind: "pinch"; dist: number; center: Point }
    | null
  >(null);
  // Après un déplacement ou un pincement, Konva verrait un « tap » sur la
  // table restée sous le doigt : on l'ignore.
  const suppressTap = useRef(false);
  const suppressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isGhostTap = () => suppressTap.current;
  function suppressTapsFor(ms: number | null) {
    clearTimeout(suppressTimer.current);
    suppressTap.current = true;
    if (ms !== null) suppressTimer.current = setTimeout(() => (suppressTap.current = false), ms);
  }

  function localPoint(e: React.PointerEvent): Point {
    const rect = wrapperRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function pinchMetrics(): { dist: number; center: Point } {
    const [a, b] = [...pointers.current.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  }

  function handlePointerDown(e: React.PointerEvent) {
    const stage = stageRef.current;
    // Les boutons de zoom posés sur le plan gèrent leurs propres clics.
    if (!stage || !(e.target instanceof HTMLCanvasElement)) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const p = localPoint(e);
    pointers.current.set(e.pointerId, p);

    if (pointers.current.size === 1) {
      // Sur un élément déplaçable (mode « disposition »), c'est lui qui bouge.
      const shape = stage.getIntersection(p);
      const onDraggable = shape?.findAncestor((n: Konva.Node) => n.draggable(), true);
      gesture.current = onDraggable ? null : { kind: "pan", start: p, origin: stage.position(), moved: false };
    } else if (pointers.current.size === 2) {
      // Le deuxième doigt arrête tout glisser en cours (table, repère).
      Konva.DD._dragElements.forEach((elem) => elem.node.stopDrag());
      gesture.current = { kind: "pinch", ...pinchMetrics() };
      suppressTapsFor(null);
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    const stage = stageRef.current;
    if (!stage) return;
    const p = localPoint(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;

    if (g?.kind === "pan") {
      const dx = p.x - g.start.x;
      const dy = p.y - g.start.y;
      if (!g.moved && Math.hypot(dx, dy) < 6) return;
      g.moved = true;
      stage.position({ x: g.origin.x + dx, y: g.origin.y + dy });
      stage.batchDraw();
    } else if (g?.kind === "pinch" && pointers.current.size >= 2) {
      const { dist, center } = pinchMetrics();
      const old = stage.scaleX();
      const next = clampScale(old * (dist / (g.dist || dist)));
      const pointTo = { x: (g.center.x - stage.x()) / old, y: (g.center.y - stage.y()) / old };
      stage.scale({ x: next, y: next });
      stage.position({ x: center.x - pointTo.x * next, y: center.y - pointTo.y * next });
      stage.batchDraw();
      gesture.current = { kind: "pinch", dist, center };
    }
  }

  function handlePointerEnd(e: React.PointerEvent) {
    if (!pointers.current.delete(e.pointerId)) return;
    const g = gesture.current;
    if (g?.kind === "pinch") {
      commitView();
      suppressTapsFor(350);
      // Le doigt restant ne reprend pas un déplacement en cours de route.
      gesture.current = null;
    } else if (g?.kind === "pan" && g.moved) {
      commitView();
      suppressTapsFor(300);
    }
    if (pointers.current.size === 0) gesture.current = null;
  }

  // ---------------------------------------------------------------------------

  const guestBySeat = useMemo(() => {
    const map = new Map<string, Guest>();
    for (const g of guests) {
      if (g.table_id && g.seat_index != null) map.set(`${g.table_id}|${g.seat_index}`, g);
    }
    return map;
  }, [guests]);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const guestId = e.dataTransfer.getData("text/guest-id");
    const stage = stageRef.current;
    if (!guestId || !stage) return;

    stage.setPointersPositions(e.nativeEvent as unknown as MouseEvent);
    const pos = stage.getPointerPosition();
    const shape = pos ? stage.getIntersection(pos) : null;
    if (!shape) return;
    const seat = seatFromTarget(shape);
    if (seat) {
      onDropGuest(guestId, seat.tableId, seat.seatIndex);
      return;
    }
    const tableGroup = shape.findAncestor(".table");
    if (tableGroup) onDropGuest(guestId, tableGroup.id(), null);
  }

  const scale = view?.scale ?? 1;
  const showNames = scale >= NAMES_MIN_SCALE;
  // Poignées de taille constante à l'écran, assez grosses pour un doigt.
  const handleRadius = 13 / scale;

  return (
    <div
      ref={wrapperRef}
      className="relative w-full touch-none overflow-hidden rounded-lg border bg-muted/30"
      style={{ height: frameHeight ? `min(72svh, ${frameHeight}px)` : "60svh" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
    >
      {view && (
        <Stage
          ref={stageRef}
          width={width}
          height={height}
          x={view.x}
          y={view.y}
          scaleX={view.scale}
          scaleY={view.scale}
          onWheel={handleWheel}
          onClick={() => setSelectedId(null)}
          onTap={() => {
            if (!isGhostTap()) setSelectedId(null);
          }}
        >
          <Layer>
            <Rect
              x={0}
              y={0}
              width={roomWidth}
              height={roomHeight}
              fill="#ffffff"
              stroke="#d6d3d1"
              strokeWidth={2}
              dash={household.room_shape === "free" ? [10, 6] : undefined}
              cornerRadius={8}
            />

            {household.landmarks.map((lm) => {
              const style = LANDMARK_STYLE[lm.type];
              // Pendant le redimensionnement, la taille suit la poignée sans
              // attendre l'aller-retour serveur.
              const w = resizingLandmark?.id === lm.id ? resizingLandmark.w : lm.w;
              const h = resizingLandmark?.id === lm.id ? resizingLandmark.h : lm.h;
              const selected = editing && selectedId === lm.id;
              const select = (e: KonvaEventObject<Event>) => {
                e.cancelBubble = true;
                if (editing && !isGhostTap()) setSelectedId(lm.id);
              };

              return (
                <Group
                  key={lm.id}
                  x={clampX(lm.pos_x)}
                  y={clampY(lm.pos_y)}
                  draggable={editing}
                  dragDistance={6}
                  onDragStart={() => setSelectedId(lm.id)}
                  onDragEnd={(e) => {
                    e.cancelBubble = true;
                    onLandmarkDragEnd(lm.id, e.target.x(), e.target.y());
                  }}
                  onClick={select}
                  onTap={select}
                >
                  <Rect width={w} height={h} fill={style.fill} stroke={style.stroke} strokeWidth={1.5} cornerRadius={8} dash={[4, 4]} />
                  <Text text={style.emoji} fontSize={18} width={w} align="center" y={h / 2 - 22} listening={false} />
                  <Text text={lm.label} fontSize={11} fill="#57534e" width={w} align="center" y={h / 2 - 2} fontStyle="600" listening={false} />

                  {selected && (
                    <>
                      <Group
                        x={w}
                        y={0}
                        onClick={(e) => {
                          e.cancelBubble = true;
                          onLandmarkRemove(lm.id);
                        }}
                        onTap={(e) => {
                          e.cancelBubble = true;
                          if (!isGhostTap()) onLandmarkRemove(lm.id);
                        }}
                      >
                        <Circle radius={handleRadius} fill="#ffffff" stroke={style.stroke} strokeWidth={1.5 / scale} />
                        <Text
                          text="×"
                          fontSize={handleRadius * 1.5}
                          fill="#78716c"
                          width={handleRadius * 2}
                          height={handleRadius * 2}
                          offsetX={handleRadius}
                          offsetY={handleRadius * 1.05}
                          align="center"
                          verticalAlign="middle"
                          listening={false}
                        />
                      </Group>

                      {/* Poignée de redimensionnement (coin bas-droit) */}
                      <Circle
                        x={w}
                        y={h}
                        radius={handleRadius}
                        fill="#ffffff"
                        stroke={style.stroke}
                        strokeWidth={1.5 / scale}
                        draggable
                        onDragStart={(e) => {
                          e.cancelBubble = true;
                        }}
                        onDragMove={(e) => {
                          e.cancelBubble = true;
                          setResizingLandmark({
                            id: lm.id,
                            w: Math.max(50, Math.round(e.target.x())),
                            h: Math.max(36, Math.round(e.target.y())),
                          });
                        }}
                        onDragEnd={(e) => {
                          e.cancelBubble = true;
                          const nw = Math.max(50, Math.round(e.target.x()));
                          const nh = Math.max(36, Math.round(e.target.y()));
                          setResizingLandmark(null);
                          onLandmarkResize(lm.id, nw, nh);
                        }}
                      />
                    </>
                  )}
                </Group>
              );
            })}

            {tables.map((table) => {
              const seats = getSeatPositions(table.type, table.capacity);
              const seatedCount = seats.filter((s) => guestBySeat.has(`${table.id}|${s.index}`)).length;
              const full = seatedCount >= table.capacity;

              const tableScale = resizingTable?.id === table.id ? resizingTable.scale : (table.scale ?? 1);
              const rectWidth = getRectTableWidth(table.capacity);
              const footprint = getTableFootprint(table.type, table.capacity);
              const halfW = footprint.width / 2;
              const halfH = footprint.height / 2;
              const selected = editing && selectedId === table.id;

              function tap(e: KonvaEventObject<Event>) {
                e.cancelBubble = true;
                if (isGhostTap()) return;
                if (editing) {
                  setSelectedId(table.id);
                  return;
                }
                const seat = seatFromTarget(e.target);
                onTableTap(table.id, seat ? seat.seatIndex : null);
              }

              return (
                <Group
                  key={table.id}
                  id={table.id}
                  name="table"
                  x={clampX(table.pos_x)}
                  y={clampY(table.pos_y)}
                  draggable={editing}
                  dragDistance={6}
                  onDragStart={() => setSelectedId(table.id)}
                  onDragEnd={(e) => {
                    e.cancelBubble = true;
                    onTableDragEnd(table.id, e.target.x(), e.target.y());
                  }}
                  onClick={tap}
                  onTap={tap}
                >
                  <Group scaleX={tableScale} scaleY={tableScale}>
                    {/* Zone de toucher élargie : toute l'emprise de la table, chaises comprises. */}
                    <Rect
                      x={-halfW}
                      y={-halfH}
                      width={halfW * 2}
                      height={halfH * 2}
                      fill="transparent"
                    />
                    {table.type === "round" ? (
                      <Circle radius={ROUND_TABLE_RADIUS} fill="#fde8ea" stroke={full ? "#e11d48" : "#fb7185"} strokeWidth={2} />
                    ) : (
                      <Rect
                        width={rectWidth}
                        height={RECT_TABLE_HEIGHT}
                        offsetX={rectWidth / 2}
                        offsetY={RECT_TABLE_HEIGHT / 2}
                        fill="#fde8ea"
                        stroke={full ? "#e11d48" : "#fb7185"}
                        strokeWidth={2}
                        cornerRadius={6}
                      />
                    )}

                    <Text
                      text={table.name}
                      fontSize={13}
                      fontStyle="600"
                      fill="#44403c"
                      width={ROUND_TABLE_RADIUS * 2 - 6}
                      offsetX={ROUND_TABLE_RADIUS - 3}
                      align="center"
                      y={-9}
                      wrap="none"
                      ellipsis
                      listening={false}
                    />
                    <Text
                      text={`${seatedCount}/${table.capacity}`}
                      fontSize={11}
                      fill={full ? "#e11d48" : "#78716c"}
                      width={80}
                      offsetX={40}
                      align="center"
                      y={7}
                      listening={false}
                    />

                    {seats.map((seat) => {
                      const occupant = guestBySeat.get(`${table.id}|${seat.index}`);
                      // Prénom posé à l'extérieur de la chaise : sur le côté pour les
                      // chaises latérales, au-dessus ou en dessous sinon.
                      const len = Math.hypot(seat.x, seat.y) || 1;
                      const ux = seat.x / len;
                      const uy = seat.y / len;
                      const sideways = Math.abs(ux) > 0.6;
                      const label = sideways
                        ? { x: Math.sign(ux) * (SEAT_RADIUS + 3), y: -5 + uy * 4, align: ux > 0 ? "left" : "right", offsetX: ux > 0 ? 0 : 70 }
                        : { x: 0, y: Math.sign(uy) * (SEAT_RADIUS + 7) - 5, align: "center", offsetX: 35 };
                      return (
                        <Group key={seat.index} x={seat.x} y={seat.y}>
                          <Circle
                            name={`seat|${table.id}|${seat.index}`}
                            radius={SEAT_RADIUS}
                            fill={occupant ? "#e11d48" : "#ffffff"}
                            stroke={occupant ? "#e11d48" : selectedGuestId ? "#fb7185" : "#d6d3d1"}
                            strokeWidth={1.5}
                          />
                          {occupant && (
                            <Text
                              text={occupant.first_name.charAt(0).toUpperCase()}
                              fontSize={12}
                              fontStyle="600"
                              fill="#ffffff"
                              width={SEAT_RADIUS * 2}
                              height={SEAT_RADIUS * 2}
                              offsetX={SEAT_RADIUS}
                              offsetY={SEAT_RADIUS - 1}
                              align="center"
                              verticalAlign="middle"
                              listening={false}
                            />
                          )}
                          {occupant && showNames && (
                            <Text
                              x={label.x}
                              y={label.y}
                              text={occupant.first_name}
                              fontSize={9}
                              fill="#44403c"
                              width={70}
                              offsetX={label.offsetX}
                              align={label.align}
                              wrap="none"
                              ellipsis
                              listening={false}
                            />
                          )}
                        </Group>
                      );
                    })}
                  </Group>

                  {selected && (
                    <Rect
                      x={-halfW * tableScale - 4 / scale}
                      y={-halfH * tableScale - 4 / scale}
                      width={halfW * 2 * tableScale + 8 / scale}
                      height={halfH * 2 * tableScale + 8 / scale}
                      stroke="#fb7185"
                      strokeWidth={1.5 / scale}
                      dash={[6 / scale, 4 / scale]}
                      cornerRadius={8 / scale}
                      listening={false}
                    />
                  )}

                  {/* Poignée de redimensionnement de la table */}
                  {selected && (
                    <Circle
                      x={halfW * tableScale}
                      y={halfH * tableScale}
                      radius={handleRadius}
                      fill="#ffffff"
                      stroke="#fb7185"
                      strokeWidth={1.5 / scale}
                      draggable
                      onDragStart={(e) => {
                        e.cancelBubble = true;
                      }}
                      onDragMove={(e) => {
                        e.cancelBubble = true;
                        const next = (e.target.x() / halfW + e.target.y() / halfH) / 2;
                        setResizingTable({ id: table.id, scale: Math.min(2.5, Math.max(0.5, next)) });
                      }}
                      onDragEnd={(e) => {
                        e.cancelBubble = true;
                        const next = (e.target.x() / halfW + e.target.y() / halfH) / 2;
                        const clamped = Math.min(2.5, Math.max(0.5, next));
                        setResizingTable(null);
                        onTableResize(table.id, Number(clamped.toFixed(2)));
                      }}
                      onClick={(e) => {
                        e.cancelBubble = true;
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true;
                      }}
                    />
                  )}
                </Group>
              );
            })}
          </Layer>
        </Stage>
      )}

      <div className="absolute right-2 bottom-2 flex flex-col gap-1.5">
        <Button size="icon" variant="outline" className="size-10 bg-background/95 shadow-sm" onClick={() => zoomButton(ZOOM_STEP)} aria-label="Zoomer">
          <Plus className="size-5" />
        </Button>
        <Button size="icon" variant="outline" className="size-10 bg-background/95 shadow-sm" onClick={() => zoomButton(1 / ZOOM_STEP)} aria-label="Dézoomer">
          <Minus className="size-5" />
        </Button>
        <Button size="icon" variant="outline" className="size-10 bg-background/95 shadow-sm" onClick={() => setView(fitView())} aria-label="Voir toute la salle">
          <Maximize className="size-4" />
        </Button>
      </div>
    </div>
  );
}
