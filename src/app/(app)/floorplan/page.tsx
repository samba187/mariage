"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useHousehold } from "@/hooks/use-household";
import { useGuests } from "@/hooks/use-guests";
import { useTables } from "@/hooks/use-tables";
import { Toolbar } from "@/components/floorplan/toolbar";
import { UnplacedGuestsPanel } from "@/components/floorplan/unplaced-guests-panel";
import { TablesList } from "@/components/floorplan/tables-list";
import { TableSeatsDialog } from "@/components/floorplan/table-seats-dialog";
import type { FloorplanMode } from "@/components/floorplan/canvas";
import { Skeleton } from "@/components/ui/skeleton";
import type { Landmark, RoomShape } from "@/types/database";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { exportTablesPdf } from "@/lib/export-tables-pdf";

const FloorplanCanvas = dynamic(() => import("@/components/floorplan/canvas").then((m) => m.FloorplanCanvas), {
  ssr: false,
  loading: () => <Skeleton className="h-[62svh] w-full rounded-lg md:h-[min(75vh,720px)]" />,
});

export default function FloorplanPage() {
  const { household, updateHousehold } = useHousehold();
  const { guests, loading: guestsLoading, updateGuest } = useGuests(household?.id);
  const { tables, loading: tablesLoading, addTable, updateTable, deleteTable } = useTables(household?.id);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [mode, setMode] = useState<FloorplanMode>("place");
  const [openSeats, setOpenSeats] = useState<{ tableId: string; seat: number | null } | null>(null);
  const [exporting, setExporting] = useState(false);

  const unplacedGuests = guests.filter((g) => !g.table_id);

  function findGuest(id: string) {
    return guests.find((g) => g.id === id);
  }

  async function handleAssignSeat(guestId: string, tableId: string, seatIndex: number) {
    await updateGuest(guestId, { table_id: tableId, seat_index: seatIndex });
    setSelectedGuestId(null);
    const guest = findGuest(guestId);
    if (guest) toast.success(`${guest.first_name} placé(e)`);
  }

  /** Place demandée si elle est libre, sinon la première libre de la table. */
  function freeSeatFor(tableId: string, wanted: number | null): number | null {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return null;
    const taken = new Set(
      guests.filter((g) => g.table_id === tableId && g.seat_index != null).map((g) => g.seat_index!)
    );
    if (wanted !== null && wanted < table.capacity && !taken.has(wanted)) return wanted;
    for (let i = 0; i < table.capacity; i++) if (!taken.has(i)) return i;
    return null;
  }

  function placeGuest(guestId: string, tableId: string, wanted: number | null) {
    const seat = freeSeatFor(tableId, wanted);
    if (seat === null) {
      toast.error("Cette table est complète.");
      return;
    }
    handleAssignSeat(guestId, tableId, seat);
  }

  function handleTableTap(tableId: string, seatIndex: number | null) {
    // Un invité choisi dans la liste : on l'assoit directement.
    if (selectedGuestId) {
      placeGuest(selectedGuestId, tableId, seatIndex);
      return;
    }
    const seatIsFree =
      seatIndex !== null && !guests.some((g) => g.table_id === tableId && g.seat_index === seatIndex);
    setOpenSeats({ tableId, seat: seatIsFree ? seatIndex : null });
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

  async function handleExport() {
    if (!household) return;
    setExporting(true);
    try {
      await exportTablesPdf(household, tables, guests);
    } catch {
      toast.error("Impossible de générer le PDF.");
    } finally {
      setExporting(false);
    }
  }

  if (!household) return null;

  const loading = guestsLoading || tablesLoading;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b p-4 md:p-6 md:pb-0">
        <h1 className="text-2xl font-semibold tracking-tight">Plan de salle</h1>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={loading || exporting}>
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
          Exporter en PDF
        </Button>
      </div>

      <Toolbar
        mode={mode}
        onModeChange={setMode}
        roomShape={household.room_shape}
        onRoomShapeChange={handleRoomShapeChange}
        onAddLandmark={handleAddLandmark}
        onAddTable={(input) => addTable(input).then(() => undefined)}
        nextTableNumber={tables.length + 1}
        landmarkCount={household.landmarks.length}
      />

      {/* Pas de hauteur ni d'overflow figés ici : sur mobile, le panneau
          invités passe sous le plan et doit rester atteignable en défilant
          la page. Une hauteur bloquée + overflow-hidden le rendait invisible
          et impossible à faire défiler. */}
      <div className="flex flex-1 flex-col gap-4 p-4 md:flex-row md:p-6">
        <div className="min-w-0 flex-1">
          {loading ? (
            <Skeleton className="h-[62svh] w-full rounded-lg md:h-[min(75vh,720px)]" />
          ) : (
            <FloorplanCanvas
              household={household}
              tables={tables}
              guests={guests}
              mode={mode}
              selectedGuestId={selectedGuestId}
              onTableTap={handleTableTap}
              onDropGuest={placeGuest}
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

      <TableSeatsDialog
        table={openSeats ? (tables.find((t) => t.id === openSeats.tableId) ?? null) : null}
        initialSeat={openSeats?.seat ?? null}
        tables={tables}
        guests={guests}
        onClose={() => setOpenSeats(null)}
        onAssign={(guestId, tableId, seat) => handleAssignSeat(guestId, tableId, seat)}
        onUnassign={handleUnassignGuest}
        onUpdateTable={updateTable}
      />
    </div>
  );
}
