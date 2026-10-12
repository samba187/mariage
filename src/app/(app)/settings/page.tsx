"use client";

import { useState } from "react";
import { useHousehold, type HouseholdSettings } from "@/hooks/use-household";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Household, RoomShape } from "@/types/database";
import { Copy, Check, Bell, BellOff, Share2, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";

/**
 * Monté avec `key={household.id}` : l'état part des valeurs enregistrées sans
 * effet de synchronisation, et la saisie en cours n'est pas écrasée par les
 * mises à jour temps réel du foyer.
 */
/**
 * Dimension de la salle, enregistrée seulement à la sortie du champ : une
 * saisie en cours (champ vidé, « 8 » avant « 800 ») ne doit pas redessiner le
 * plan avec une salle minuscule.
 */
function RoomDimensionInput({
  id,
  value,
  min,
  onCommit,
}: {
  id: string;
  value: number;
  min: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    // Valeur modifiée ailleurs (autre appareil) : on resynchronise le champ.
    setLastValue(value);
    setDraft(String(value));
  }

  function commit() {
    const parsed = Math.round(Number(draft));
    const next = Number.isFinite(parsed) && parsed > 0 ? Math.min(3000, Math.max(min, parsed)) : value;
    setDraft(String(next));
    if (next !== value) onCommit(next);
  }

  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      min={min}
      max={3000}
      step={50}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

function WeddingInfoForm({
  household,
  onSave,
}: {
  household: Household;
  onSave: (input: HouseholdSettings) => Promise<void>;
}) {
  const [name, setName] = useState(household.name ?? "");
  const [weddingDate, setWeddingDate] = useState(household.wedding_date ?? "");
  const [partner1, setPartner1] = useState(household.partner1_name ?? "");
  const [partner2, setPartner2] = useState(household.partner2_name ?? "");
  const [budget, setBudget] = useState(
    household.budget_target != null ? String(household.budget_target) : ""
  );
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      name: name.trim() || null,
      wedding_date: weddingDate || null,
      partner1_name: partner1.trim() || null,
      partner2_name: partner2.trim() || null,
      budget_target: budget ? Number(budget) : null,
    });
    setSaving(false);
    toast.success("Paramètres enregistrés");
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="s-name">Nom du mariage</Label>
        <Input
          id="s-name"
          placeholder="Mariage de Julie & Tom"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="s-p1">Prénom du premier conjoint</Label>
          <Input id="s-p1" value={partner1} onChange={(e) => setPartner1(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-p2">Prénom du second conjoint</Label>
          <Input id="s-p2" value={partner2} onChange={(e) => setPartner2(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="s-date">Date du mariage</Label>
          <Input
            id="s-date"
            type="date"
            value={weddingDate}
            onChange={(e) => setWeddingDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-budget">Budget cible (€)</Label>
          <Input
            id="s-budget"
            type="number"
            min={0}
            step="100"
            placeholder="20000"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="size-4 animate-spin" />}
        Enregistrer
      </Button>
    </form>
  );
}

export default function SettingsPage() {
  const { household, updateHousehold } = useHousehold();
  const { supported, subscribed, busy, subscribe, unsubscribe } = usePushNotifications(household?.id);
  const [copied, setCopied] = useState(false);

  if (!household) return null;

  const inviteUrl =
    typeof window !== "undefined" ? `${window.location.origin}/join/${household.invite_code}` : "";

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Lien copié");
    } catch {
      toast.error("Copie impossible, sélectionnez le lien manuellement.");
    }
  }

  async function shareInvite() {
    if (!navigator.share) {
      copyInvite();
      return;
    }
    try {
      await navigator.share({
        title: "Notre organisation de mariage",
        text: "Rejoins-moi pour organiser le mariage :",
        url: inviteUrl,
      });
    } catch {
      // partage annulé
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Le mariage</CardTitle>
        </CardHeader>
        <CardContent>
          <WeddingInfoForm key={household.id} household={household} onSave={updateHousehold} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accès à deux</CardTitle>
          <CardDescription>
            Lien à ouvrir sur l&apos;autre téléphone pour partager les mêmes données.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input readOnly value={inviteUrl} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button type="button" variant="outline" size="icon" onClick={copyInvite} className="shrink-0">
              {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <Button type="button" variant="secondary" onClick={shareInvite} className="w-full gap-2">
            <Share2 className="size-4" />
            Envoyer le lien
          </Button>
          <p className="text-xs text-muted-foreground">
            Code d&apos;invitation : <span className="font-mono font-semibold">{household.invite_code}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rappels</CardTitle>
          <CardDescription>
            Notification à J-14, J-7, la veille et le jour même de chaque versement non payé.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!supported ? (
            <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
              Notifications indisponibles ici. Sur iPhone : installer l&apos;app sur l&apos;écran
              d&apos;accueil, puis rouvrir cette page.
            </p>
          ) : subscribed ? (
            <Button type="button" variant="outline" onClick={unsubscribe} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <BellOff className="size-4" />}
              Désactiver sur cet appareil
            </Button>
          ) : (
            <Button type="button" onClick={subscribe} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
              Activer les rappels sur cet appareil
            </Button>
          )}
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Smartphone className="mt-0.5 size-3.5 shrink-0" />
            À activer sur chaque appareil, même app fermée.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Salle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="s-shape">Forme de la salle</Label>
            <Select
              value={household.room_shape}
              onValueChange={(v) => updateHousehold({ room_shape: v as RoomShape })}
            >
              <SelectTrigger id="s-shape" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rectangle">Rectangle</SelectItem>
                <SelectItem value="square">Carrée</SelectItem>
                <SelectItem value="free">Forme libre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="s-w">Largeur</Label>
              <RoomDimensionInput
                id="s-w"
                min={400}
                value={household.room_width}
                onCommit={(v) => updateHousehold({ room_width: v })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-h">Hauteur</Label>
              <RoomDimensionInput
                id="s-h"
                min={300}
                value={household.room_height}
                onCommit={(v) => updateHousehold({ room_height: v })}
              />
            </div>
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground">
            Seule la proportion compte. Les tables et invités déjà placés sont conservés : une table qui
            sortirait de la salle est ramenée au bord.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
