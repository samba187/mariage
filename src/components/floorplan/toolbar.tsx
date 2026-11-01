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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FloorplanMode } from "@/components/floorplan/canvas";
import { cn } from "@/lib/utils";
import { Music4, Mic2, DoorOpen, UtensilsCrossed, Move, Plus, Users } from "lucide-react";

const LANDMARK_DEFS: Record<LandmarkType, { label: string; icon: typeof Music4; w: number; h: number }> = {
  dance_floor: { label: "Piste de danse", icon: Music4, w: 160, h: 100 },
  dj: { label: "Estrade / DJ", icon: Mic2, w: 100, h: 60 },
  entrance: { label: "Entrée", icon: DoorOpen, w: 70, h: 40 },
  buffet: { label: "Buffet", icon: UtensilsCrossed, w: 150, h: 55 },
};

interface ToolbarProps {
  mode: FloorplanMode;
  onModeChange: (mode: FloorplanMode) => void;
  roomShape: RoomShape;
  onRoomShapeChange: (shape: RoomShape) => void;
  onAddLandmark: (landmark: Landmark) => void;
  onAddTable: (input: TableInput) => Promise<void>;
  nextTableNumber: number;
  landmarkCount: number;
}

export function Toolbar({
  mode,
  onModeChange,
  roomShape,
  onRoomShapeChange,
  onAddLandmark,
  onAddTable,
  nextTableNumber,
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
    <div className="space-y-2 border-b bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border bg-muted/50 p-0.5" role="tablist">
          {(
            [
              { value: "place", label: "Placer les invités", icon: Users },
              { value: "edit", label: "Disposition", icon: Move },
            ] as const
          ).map((m) => (
            <button
              key={m.value}
              type="button"
              role="tab"
              aria-selected={mode === m.value}
              onClick={() => onModeChange(m.value)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
                mode === m.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              <m.icon className="size-4" />
              {m.label}
            </button>
          ))}
        </div>

        <TableDialog onSave={onAddTable} nextTableNumber={nextTableNumber} />

        {mode === "edit" && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="size-4" />
                  Repère
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {(Object.keys(LANDMARK_DEFS) as LandmarkType[]).map((type) => {
                  const def = LANDMARK_DEFS[type];
                  return (
                    <DropdownMenuItem key={type} onSelect={() => handleAddLandmark(type)}>
                      <def.icon className="size-4" />
                      {def.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

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
          </>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {mode === "place"
          ? "Touchez une table pour y placer vos invités. Glissez pour vous déplacer, pincez pour zoomer."
          : "Glissez une table ou un repère pour le déplacer. Touchez-le pour afficher sa poignée de taille (et le × pour supprimer un repère)."}
      </p>
    </div>
  );
}
