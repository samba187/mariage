import type { Guest, Household, WeddingTable } from "@/types/database";
import { formatDate } from "@/lib/format";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const GAP = 8;
const COL_W = (PAGE_W - 2 * MARGIN - GAP) / 2;
const LINE_H = 5.5;
const HEADER_H = 8;
const BLOCK_GAP = 6;

const guestName = (g: Guest) => `${g.first_name} ${g.last_name}`.trim();

/** Génère et télécharge un PDF : chaque table avec ses invités, puis les non placés. */
export async function exportTablesPdf(household: Household, tables: WeddingTable[], guests: Guest[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const sortedTables = [...tables].sort((a, b) =>
    a.name.localeCompare(b.name, "fr", { numeric: true, sensitivity: "base" })
  );
  const byTable = new Map<string, Guest[]>();
  for (const g of guests) {
    if (!g.table_id) continue;
    const list = byTable.get(g.table_id) ?? [];
    list.push(g);
    byTable.set(g.table_id, list);
  }
  const unplaced = guests
    .filter((g) => !g.table_id)
    .sort((a, b) => guestName(a).localeCompare(guestName(b), "fr", { sensitivity: "base" }));

  // En-tête de la première page
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Plan de table", MARGIN, MARGIN + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  const placedCount = guests.length - unplaced.length;
  const subtitle = [
    household.name,
    household.wedding_date ? formatDate(household.wedding_date) : null,
    `${sortedTables.length} tables · ${placedCount} invités placés`,
  ]
    .filter(Boolean)
    .join("  ·  ");
  doc.text(subtitle, MARGIN, MARGIN + 11);
  doc.setTextColor(0);

  // Haut de la zone utile : sous l'en-tête en page 1, à la marge ensuite.
  let pageTop = MARGIN + 20;
  let col = 0;
  let y = pageTop;

  function nextColumn() {
    if (col === 0) {
      col = 1;
    } else {
      doc.addPage();
      col = 0;
      pageTop = MARGIN;
    }
    y = pageTop;
  }

  /** Bloc titre + lignes ; découpé sur plusieurs colonnes s'il est trop long. */
  function block(title: string, lines: string[]) {
    let remaining = lines.length ? lines : ["—"];
    let first = true;
    while (remaining.length) {
      const room = Math.floor((PAGE_H - MARGIN - y - HEADER_H) / LINE_H);
      // Pas la place pour le titre et au moins deux lignes : colonne suivante.
      if (room < Math.min(2, remaining.length)) {
        nextColumn();
        continue;
      }
      const chunk = remaining.slice(0, room);
      remaining = remaining.slice(room);
      const x = MARGIN + col * (COL_W + GAP);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(first ? title : `${title} (suite)`, x, y + 5);
      doc.setDrawColor(200);
      doc.line(x, y + HEADER_H - 1, x + COL_W, y + HEADER_H - 1);
      y += HEADER_H;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (const line of chunk) {
        doc.text(doc.splitTextToSize(line, COL_W)[0], x, y + 4);
        y += LINE_H;
      }
      y += BLOCK_GAP;
      first = false;
      if (remaining.length) nextColumn();
    }
  }

  for (const table of sortedTables) {
    const seated = (byTable.get(table.id) ?? []).sort(
      (a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0)
    );
    block(
      `${table.name}  —  ${seated.length}/${table.capacity}`,
      seated.map((g, i) => `${i + 1}. ${guestName(g)}`)
    );
  }

  if (unplaced.length) {
    block(`Invités non placés (${unplaced.length})`, unplaced.map(guestName));
  }

  // Numéros de page
  const total = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(140);
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.text(`${p} / ${total}`, PAGE_W - MARGIN, PAGE_H - 8, { align: "right" });
  }

  doc.save("plan-de-table.pdf");
}
