"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useHousehold } from "@/hooks/use-household";
import { useGuests } from "@/hooks/use-guests";
import { useTables } from "@/hooks/use-tables";
import { Toolbar } from "@/components/floorplan/toolbar";
import { UnplacedGuestsPanel } from "@/components/floorplan/unplaced-guests-panel";
import { TablesList } from "@/components/floorplan/tables-list";
import { Skeleton } from "@/components/ui/skeleton";
import type { Landmark, RoomShape } from "@/types/database";
import { toast } from "sonner";

const FloorplanCanvas = dynamic(() => import("@/components/floorplan/canvas").then((m) => m.FloorplanCanvas), {
  ssr: false,
  loading: () => <Skeleton className="w-full rounded-lg" style={{ height: "min(70vh, 640px)" }} />,
});

export default function FloorplanPage() {
  const { household, updateHousehold } = useHousehold();
  const { guests, loading: guestsLoading, updateGuest } = useGuests(household?.id);
  const { tables, loading: tablesLoading, addTable, updateTable, deleteTable } = useTables(household?.id);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const unplacedGuests = guests.filter((g) => g.rsvp === "confirmed" && !g.table_id);

  function findGuest(id: string) {
    return guests.find((g) => g.id === id);
  }

  async function handleAssignSeat(guestId: string, tableId: string, seatIndex: number) {
    await updateGuest(guestId, { table_id: tableId, seat_index: seatIndex });
    setSelectedGuestId(null);
    const guest = findGuest(guestId);
    if (guest) toast.success(`${guest.first_name} placé(e)`);
  }

  async function handleUnassignGuest(guestId: string) {
    const guest = findGuest(guestId);
    await updateGuest(guestId, { table_id: null, seat_index: null });
    if (guest) toast.success(`${guest.first_name} retiré(e) de la table`);
  }

  function handleAddLandmark(landmark: Landmark) {
    if (!household) return;
    updateHousehold({ landmarks: [...household.landmarks, landmark] });
  }

  function handleLandmarkDragEnd(landmarkId: string, x: number, y: number) {
    if (!household) return;
    updateHousehold({
      landmarks: household.landmarks.map((l) => (l.id === landmarkId ? { ...l, pos_x: x, pos_y: y } : l)),
    });
  }

  function handleLandmarkResize(landmarkId: string, w: number, h: number) {
    if (!household) return;
    updateHousehold({
      landmarks: household.landmarks.map((l) => (l.id === landmarkId ? { ...l, w, h } : l)),
    });
  }

  function handleLandmarkRemove(landmarkId: string) {
    if (!household) return;
    updateHousehold({ landmarks: household.landmarks.filter((l) => l.id !== landmarkId) });
  }

  function handleRoomShapeChange(shape: RoomShape) {
    updateHousehold({ room_shape: shape });
  }

  if (!household) return null;

  const loading = guestsLoading || tablesLoading;

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b p-4 md:p-6 md:pb-0">
        <h1 className="text-2xl font-semibold tracking-tight">Plan de salle</h1>
      </div>

      <Toolbar
        roomShape={household.room_shape}
        onRoomShapeChange={handleRoomShapeChange}
        onAddLandmark={handleAddLandmark}
        onAddTable={(input) => addTable(input).then(() => undefined)}
        nextTableNumber={tables.length + 1}
        zoom={zoom}
        onZoomChange={setZoom}
        landmarkCount={household.landmarks.length}
      />

      {/* Pas de hauteur ni d'overflow figés ici : sur mobile, le panneau
          invités passe sous le plan et doit rester atteignable en défilant
          la page. Une hauteur bloquée + overflow-hidden le rendait invisible
          et impossible à faire défiler. */}
      <div className="flex flex-1 flex-col gap-4 p-4 md:flex-row md:p-6">
        <div className="min-w-0 flex-1">
          {loading ? (
            <Skeleton className="w-full rounded-lg" style={{ height: "min(70vh, 640px)" }} />
          ) : (
            <FloorplanCanvas
              household={household}
              tables={tables}
              guests={guests}
              selectedGuestId={selectedGuestId}
              zoom={zoom}
              onAssignSeat={handleAssignSeat}
              onUnassignGuest={handleUnassignGuest}
              onTableDragEnd={(id, x, y) => updateTable(id, { pos_x: x, pos_y: y })}
              onTableResize={(id, scale) => updateTable(id, { scale })}
              onLandmarkDragEnd={handleLandmarkDragEnd}
              onLandmarkResize={handleLandmarkResize}
              onLandmarkRemove={handleLandmarkRemove}
            />
          )}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-4 md:w-72">
          <div>
            <h2 className="mb-2 text-sm font-semibold">Invités non placés ({unplacedGuests.length})</h2>
            <UnplacedGuestsPanel guests={unplacedGuests} selectedGuestId={selectedGuestId} onSelect={setSelectedGuestId} />
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold">Tables ({tables.length})</h2>
            <TablesList
              tables={tables}
              guests={guests}
              onUpdateTable={updateTable}
              onDeleteTable={deleteTable}
              onUnassignGuest={handleUnassignGuest}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
