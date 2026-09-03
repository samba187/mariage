"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useHousehold } from "@/hooks/use-household";
import { useVendors } from "@/hooks/use-vendors";
import { useGuests } from "@/hooks/use-guests";
import { useDueReminders } from "@/hooks/use-due-reminders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DueDateLabel } from "@/components/vendors/due-date-label";
import { formatEUR, formatDate } from "@/lib/format";
import { paidAmount, remainingAmount, dueUrgency, sortedUpcoming, daysUntil } from "@/lib/vendor-status";
import { Wallet, CheckCircle2, Clock, Users, ArrowRight, CalendarHeart, AlertTriangle } from "lucide-react";

export default function DashboardPage() {
  const { household } = useHousehold();
  const { vendors, payments, paymentsFor, loading } = useVendors(household?.id);
  const { guests } = useGuests(household?.id);

  const weddingDate = household?.wedding_date ?? null;

  useDueReminders(payments, weddingDate);

  const totals = useMemo(() => {
    let engaged = 0;
    let paid = 0;
    let remaining = 0;
    for (const v of vendors) {
      const p = paymentsFor(v.id);
      engaged += Number(v.total_amount);
      paid += paidAmount(p);
      remaining += remainingAmount(v, p);
    }
    return { engaged, paid, remaining };
  }, [vendors, paymentsFor]);

  const vendorName = (vendorId: string) => vendors.find((v) => v.id === vendorId)?.name ?? "—";

  const upcoming = useMemo(() => sortedUpcoming(payments, weddingDate).slice(0, 6), [payments, weddingDate]);
  const overdueCount = payments.filter((p) => dueUrgency(p, weddingDate) === "overdue").length;

  const confirmed = guests.filter((g) => g.rsvp === "confirmed");
  const daysToWedding = weddingDate ? daysUntil(weddingDate) : null;
  const budgetTarget = household?.budget_target ? Number(household.budget_target) : null;

  const cards = [
    {
      label: "Budget engagé",
      value: formatEUR(totals.engaged),
      sub: budgetTarget ? `sur un objectif de ${formatEUR(budgetTarget)}` : undefined,
      icon: Wallet,
      color: "text-blue-600 bg-blue-100",
    },
    {
      label: "Déjà versé",
      value: formatEUR(totals.paid),
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-100",
    },
    {
      label: "Reste à payer",
      value: formatEUR(totals.remaining),
      icon: Clock,
      color: "text-amber-600 bg-amber-100",
    },
    {
      label: "Invités confirmés",
      value: String(confirmed.length),
      sub: `${confirmed.filter((g) => g.type === "adult").length} adultes · ${confirmed.filter((g) => g.type === "child").length} enfants`,
      icon: Users,
      color: "text-rose-600 bg-rose-100",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        {weddingDate && daysToWedding !== null && (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarHeart className="size-4 text-rose-500" />
            {daysToWedding > 0
              ? `J-${daysToWedding} · ${formatDate(weddingDate)}`
              : daysToWedding === 0
                ? "C'est aujourd'hui !"
                : `${formatDate(weddingDate)}`}
          </p>
        )}
      </div>

      {!weddingDate && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-4">
          <p className="text-sm text-muted-foreground">Date du mariage non renseignée.</p>
          <Button asChild size="sm" variant="outline">
            <Link href="/settings">Paramètres</Link>
          </Button>
        </div>
      )}

      {overdueCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <AlertTriangle className="size-4 shrink-0" />
          {overdueCount === 1 ? "1 versement en retard." : `${overdueCount} versements en retard.`}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                {c.sub && <p className="mt-1 truncate text-xs text-muted-foreground">{c.sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {budgetTarget && totals.engaged > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Budget engagé sur objectif</span>
              <span className={`font-medium tabular-nums ${totals.engaged > budgetTarget ? "text-rose-600" : ""}`}>
                {formatEUR(totals.engaged)} / {formatEUR(budgetTarget)}
              </span>
            </div>
            <Progress value={Math.min(100, (totals.engaged / budgetTarget) * 100)} className="h-2" />
            {totals.engaged > budgetTarget && (
              <p className="text-xs text-rose-600">
                Dépassement de {formatEUR(totals.engaged - budgetTarget)}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Prochains versements</h2>
          <Button asChild size="sm" variant="ghost" className="gap-1 text-xs">
            <Link href="/vendors">
              Tous les prestataires
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>

        {loading ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : upcoming.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aucun versement à venir.
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {upcoming.map((payment) => (
              <li key={payment.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {vendorName(payment.vendor_id)}
                    <span className="font-normal text-muted-foreground"> · {payment.label}</span>
                  </p>
                  <DueDateLabel payment={payment} weddingDate={weddingDate} />
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {formatEUR(Number(payment.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
