"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Guest } from "@/types/database";
import { useHousehold } from "@/hooks/use-household";
import { sideLabel } from "@/lib/guest-side";
import { Users, UserCheck, UserX, Clock3 } from "lucide-react";

export function GuestCounters({ guests }: { guests: Guest[] }) {
  const { household } = useHousehold();
  const side1 = guests.filter((g) => g.side === "partner1").length;
  const side2 = guests.filter((g) => g.side === "partner2").length;
  const noSide = guests.length - side1 - side2;
  const confirmed = guests.filter((g) => g.rsvp === "confirmed");
  const pending = guests.filter((g) => g.rsvp === "pending");
  const declined = guests.filter((g) => g.rsvp === "declined");
  const adults = confirmed.filter((g) => g.type === "adult").length;
  const children = confirmed.filter((g) => g.type === "child").length;
  const babies = confirmed.filter((g) => g.type === "baby").length;

  const cards = [
    {
      label: "Confirmés",
      value: confirmed.length,
      sub: `${adults} adultes · ${children} enfants${babies ? ` · ${babies} bébés` : ""}`,
      icon: UserCheck,
      color: "text-emerald-600 bg-emerald-100",
    },
    {
      label: "En attente",
      value: pending.length,
      icon: Clock3,
      color: "text-amber-600 bg-amber-100",
    },
    {
      label: "Déclinés",
      value: declined.length,
      icon: UserX,
      color: "text-muted-foreground bg-muted",
    },
    {
      label: "Total invités",
      value: guests.length,
      sub: `${side1} ${sideLabel(household, "partner1")} · ${side2} ${sideLabel(household, "partner2")}${
        noSide ? ` · ${noSide} non précisé` : ""
      }`,
      icon: Users,
      color: "text-rose-600 bg-rose-100",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
            <div className={`flex size-8 items-center justify-center rounded-full ${c.color}`}>
              <c.icon className="size-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{c.value}</p>
            {c.sub && <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
