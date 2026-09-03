"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableDialog } from "@/components/floorplan/table-dialog";
import type { Landmark, LandmarkType, RoomShape } from "@/types/database";
import type { TableInput } from "@/hooks/use-tables";
import { Music4, Mic2, DoorOpen, UtensilsCrossed, ZoomIn, ZoomOut } from "lucide-react";

const LANDMARK_DEFS: Record<LandmarkType, { label: string; icon: typeof Music4; w: number; h: number }> = {
  dance_floor: { label: "Piste de danse", icon: Music4, w: 160, h: 100 },
  dj: { label: "Estrade / DJ", icon: Mic2, w: 100, h: 60 },
  entrance: { label: "Entrée", icon: DoorOpen, w: 70, h: 40 },
  buffet: { label: "Buffet", icon: UtensilsCrossed, w: 150, h: 55 },
};

interface ToolbarProps {
  roomShape: RoomShape;
  onRoomShapeChange: (shape: RoomShape) => void;
  onAddLandmark: (landmark: Landmark) => void;
  onAddTable: (input: TableInput) => Promise<void>;
  nextTableNumber: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  landmarkCount: number;
}

export function Toolbar({
  roomShape,
  onRoomShapeChange,
  onAddLandmark,
  onAddTable,
  nextTableNumber,
  zoom,
  onZoomChange,
  landmarkCount,
}: ToolbarProps) {
  function handleAddLandmark(type: LandmarkType) {
    const def = LANDMARK_DEFS[type];
    onAddLandmark({
      id: crypto.randomUUID(),
      type,
      label: def.label,
      pos_x: 60 + ((landmarkCount * 40) % 200),
      pos_y: 30 + ((landmarkCount * 30) % 150),
      w: def.w,
      h: def.h,
      rotation: 0,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-background p-3">
      <TableDialog onSave={onAddTable} nextTableNumber={nextTableNumber} />

      <div className="mx-1 h-6 w-px bg-border" />

      {(Object.keys(LANDMARK_DEFS) as LandmarkType[]).map((type) => {
        const def = LANDMARK_DEFS[type];
        return (
          <Button key={type} size="sm" variant="outline" onClick={() => handleAddLandmark(type)}>
            <def.icon className="size-4" />
            {def.label}
          </Button>
        );
      })}

      <div className="mx-1 h-6 w-px bg-border" />

      <Select value={roomShape} onValueChange={(v) => onRoomShapeChange(v as RoomShape)}>
        <SelectTrigger size="sm" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="rectangle">Salle rectangle</SelectItem>
          <SelectItem value="square">Salle carrée</SelectItem>
          <SelectItem value="free">Forme libre</SelectItem>
        </SelectContent>
      </Select>

      <div className="ml-auto flex items-center gap-1">
        <Button size="icon" variant="outline" className="size-8" onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))}>
          <ZoomOut className="size-4" />
        </Button>
        <span className="w-10 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <Button size="icon" variant="outline" className="size-8" onClick={() => onZoomChange(Math.min(1.5, zoom + 0.1))}>
          <ZoomIn className="size-4" />
        </Button>
      </div>
    </div>
  );
}
