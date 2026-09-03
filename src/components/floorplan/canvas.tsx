"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Circle, Group, Text } from "react-konva";
import type Konva from "konva";
import { toast } from "sonner";
import type { Guest, Household, Landmark, WeddingTable } from "@/types/database";
import {
  getSeatPositions,
  ROUND_TABLE_RADIUS,
  RECT_TABLE_WIDTH,
  RECT_TABLE_HEIGHT,
  SEAT_RADIUS,
  SEAT_GAP,
} from "@/lib/floorplan-geometry";

const LANDMARK_STYLE: Record<Landmark["type"], { fill: string; stroke: string; emoji: string }> = {
  dance_floor: { fill: "#f3e8ff", stroke: "#c084fc", emoji: "💃" },
  dj: { fill: "#dbeafe", stroke: "#60a5fa", emoji: "🎧" },
  entrance: { fill: "#dcfce7", stroke: "#4ade80", emoji: "🚪" },
  buffet: { fill: "#fef3c7", stroke: "#fbbf24", emoji: "🍽️" },
};

interface FloorplanCanvasProps {
  household: Household;
  tables: WeddingTable[];
  guests: Guest[];
  selectedGuestId: string | null;
  zoom: number;
  onAssignSeat: (guestId: string, tableId: string, seatIndex: number) => void;
  onUnassignGuest: (guestId: string) => void;
  onTableDragEnd: (tableId: string, x: number, y: number) => void;
  onTableResize: (tableId: string, scale: number) => void;
  onLandmarkDragEnd: (landmarkId: string, x: number, y: number) => void;
  onLandmarkResize: (landmarkId: string, w: number, h: number) => void;
  onLandmarkRemove: (landmarkId: string) => void;
}

function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.max(320, Math.floor(w)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

export function FloorplanCanvas({
  household,
  tables,
  guests,
  selectedGuestId,
  zoom,
  onAssignSeat,
  onUnassignGuest,
  onTableDragEnd,
  onTableResize,
  onLandmarkDragEnd,
  onLandmarkResize,
  onLandmarkRemove,
}: FloorplanCanvasProps) {
  const { ref: wrapperRef, width: containerWidth } = useContainerWidth();
  const stageRef = useRef<Konva.Stage>(null);
  const [resizingLandmark, setResizingLandmark] = useState<{ id: string; w: number; h: number } | null>(null);
  const [resizingTable, setResizingTable] = useState<{ id: string; scale: number } | null>(null);

  const roomWidth = household.room_shape === "square" ? Math.min(household.room_width, household.room_height) : household.room_width;
  const roomHeight = household.room_shape === "square" ? Math.min(household.room_width, household.room_height) : household.room_height;

  const stageWidth = Math.floor(containerWidth * zoom);
  const scale = stageWidth / household.room_width;
  const stageHeight = Math.floor(household.room_height * scale);

  const guestBySeat = useMemo(() => {
    const map = new Map<string, Guest>();
    for (const g of guests) {
      if (g.table_id && g.seat_index != null) map.set(`${g.table_id}|${g.seat_index}`, g);
    }
    return map;
  }, [guests]);

  function handleSeatClick(tableId: string, seatIndex: number) {
    const occupant = guestBySeat.get(`${tableId}|${seatIndex}`);
    if (occupant) {
      onUnassignGuest(occupant.id);
      return;
    }
    if (!selectedGuestId) {
      toast.info("Sélectionnez d'abord un invité dans la liste à gauche.");
      return;
    }
    onAssignSeat(selectedGuestId, tableId, seatIndex);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const guestId = e.dataTransfer.getData("text/guest-id");
    const stage = stageRef.current;
    if (!guestId || !stage) return;

    stage.setPointersPositions(e.nativeEvent as unknown as MouseEvent);
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const shape = stage.getIntersection(pos);
    const name = shape?.name() ?? "";
    if (!name.startsWith("seat|")) {
      toast.info("Déposez l'invité directement sur une chaise.");
      return;
    }
    const [, tableId, seatIndexStr] = name.split("|");
    const seatIndex = Number(seatIndexStr);
    const occupant = guestBySeat.get(`${tableId}|${seatIndex}`);
    if (occupant) {
      toast.error("Cette chaise est déjà occupée.");
      return;
    }
    onAssignSeat(guestId, tableId, seatIndex);
  }

  return (
    <div
      ref={wrapperRef}
      className="relative w-full overflow-auto rounded-lg border bg-[repeating-linear-gradient(45deg,theme(colors.muted.DEFAULT)_0,theme(colors.muted.DEFAULT)_1px,transparent_1px,transparent_16px)] bg-muted/20"
      style={{ height: "min(70vh, 640px)" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <Stage ref={stageRef} width={stageWidth} height={stageHeight} scaleX={scale} scaleY={scale}>
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

            return (
              <Group
                key={lm.id}
                x={lm.pos_x}
                y={lm.pos_y}
                draggable
                onDragEnd={(e) => onLandmarkDragEnd(lm.id, e.target.x(), e.target.y())}
              >
                <Rect width={w} height={h} fill={style.fill} stroke={style.stroke} strokeWidth={1.5} cornerRadius={8} dash={[4, 4]} />
                <Text text={style.emoji} fontSize={18} width={w} align="center" y={h / 2 - 22} />
                <Text text={lm.label} fontSize={11} fill="#57534e" width={w} align="center" y={h / 2 - 2} fontStyle="600" />

                <Group
                  x={w - 9}
                  y={-9}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    onLandmarkRemove(lm.id);
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true;
                    onLandmarkRemove(lm.id);
                  }}
                >
                  <Circle radius={9} fill="#ffffff" stroke={style.stroke} strokeWidth={1.5} />
                  <Text text="×" fontSize={14} fill="#78716c" width={18} height={18} offsetX={9} offsetY={10} align="center" verticalAlign="middle" listening={false} />
                </Group>

                {/* Poignée de redimensionnement (coin bas-droit) */}
                <Circle
                  x={w}
                  y={h}
                  radius={9}
                  fill="#ffffff"
                  stroke={style.stroke}
                  strokeWidth={1.5}
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
              </Group>
            );
          })}

          {tables.map((table) => {
            const seats = getSeatPositions(table.type, table.capacity);
            const seatedCount = seats.filter((s) => guestBySeat.has(`${table.id}|${s.index}`)).length;
            const full = seatedCount >= table.capacity;

            const scale = resizingTable?.id === table.id ? resizingTable.scale : (table.scale ?? 1);
            const halfW =
              table.type === "round"
                ? ROUND_TABLE_RADIUS + SEAT_GAP + SEAT_RADIUS
                : RECT_TABLE_WIDTH / 2 + SEAT_GAP + SEAT_RADIUS;
            const halfH =
              table.type === "round"
                ? ROUND_TABLE_RADIUS + SEAT_GAP + SEAT_RADIUS
                : RECT_TABLE_HEIGHT / 2 + SEAT_GAP + SEAT_RADIUS;

            return (
              <Group
                key={table.id}
                x={table.pos_x}
                y={table.pos_y}
                draggable
                onDragEnd={(e) => onTableDragEnd(table.id, e.target.x(), e.target.y())}
              >
                <Group scaleX={scale} scaleY={scale}>
                {table.type === "round" ? (
                  <Circle radius={ROUND_TABLE_RADIUS} fill="#fde8ea" stroke={full ? "#e11d48" : "#fb7185"} strokeWidth={2} />
                ) : (
                  <Rect
                    width={RECT_TABLE_WIDTH}
                    height={RECT_TABLE_HEIGHT}
                    offsetX={RECT_TABLE_WIDTH / 2}
                    offsetY={RECT_TABLE_HEIGHT / 2}
                    fill="#fde8ea"
                    stroke={full ? "#e11d48" : "#fb7185"}
                    strokeWidth={2}
                    cornerRadius={6}
                  />
                )}

                <Text
                  text={table.name}
                  fontSize={12}
                  fontStyle="600"
                  fill="#44403c"
                  width={140}
                  offsetX={70}
                  align="center"
                  y={-6}
                />
                <Text
                  text={`${seatedCount}/${table.capacity}`}
                  fontSize={10}
                  fill={full ? "#e11d48" : "#78716c"}
                  width={140}
                  offsetX={70}
                  align="center"
                  y={8}
                />

                {seats.map((seat) => {
                  const occupant = guestBySeat.get(`${table.id}|${seat.index}`);
                  return (
                    <Group key={seat.index} x={seat.x} y={seat.y}>
                      <Circle
                        name={`seat|${table.id}|${seat.index}`}
                        radius={SEAT_RADIUS}
                        fill={occupant ? "#e11d48" : "#ffffff"}
                        stroke={occupant ? "#e11d48" : selectedGuestId ? "#fb7185" : "#d6d3d1"}
                        strokeWidth={1.5}
                        onClick={() => handleSeatClick(table.id, seat.index)}
                        onTap={() => handleSeatClick(table.id, seat.index)}
                      />
                      {occupant && (
                        <Text
                          text={occupant.first_name.charAt(0).toUpperCase()}
                          fontSize={11}
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
                    </Group>
                  );
                })}
                </Group>

                {/* Poignée de redimensionnement de la table */}
                <Circle
                  x={halfW * scale}
                  y={halfH * scale}
                  radius={9}
                  fill="#ffffff"
                  stroke="#fb7185"
                  strokeWidth={1.5}
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
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
