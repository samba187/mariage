"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { Loader2, Users, CircleAlert } from "lucide-react";
import { toast } from "sonner";

interface Preview {
  name: string | null;
  wedding_date: string | null;
}

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "invalid">("loading");
  const [displayName, setDisplayName] = useState("");
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) await supabase.auth.signInAnonymously();

    const { data, error } = await supabase.rpc("household_preview", { code }).maybeSingle();
    if (error || !data) {
      setStatus("invalid");
      return;
    }
    setPreview(data as Preview);
    setStatus("ready");
  }, [code, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- vérifie l'invitation au montage
    load();
  }, [load]);

  async function handleJoin() {
    setJoining(true);
    const { error } = await supabase.rpc("join_household_by_code", {
      code,
      member_name: displayName.trim() || null,
    });
    setJoining(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    // Permet de retrouver cet espace si la session anonyme est perdue.
    try {
      localStorage.setItem("last-invite-code", code);
    } catch {
      // stockage indisponible
    }

    toast.success("Vous avez rejoint l'espace partagé");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        {status === "loading" && (
          <CardContent className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">Vérification de l&apos;invitation...</p>
          </CardContent>
        )}

        {status === "invalid" && (
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CircleAlert className="size-8 text-rose-500" />
            <p className="text-sm font-medium">Invitation introuvable</p>
            <p className="text-xs text-muted-foreground">Ce lien n&apos;est pas valide.</p>
            <Button variant="outline" size="sm" onClick={() => router.push("/")}>
              Aller à mon espace
            </Button>
          </CardContent>
        )}

        {status === "ready" && preview && (
          <>
            <CardHeader className="items-center text-center">
              <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-rose-100">
                <Users className="size-5 text-rose-500" />
              </div>
              <CardTitle className="text-lg">{preview.name || "Organisation du mariage"}</CardTitle>
              <CardDescription>
                {preview.wedding_date
                  ? `Le ${formatDate(preview.wedding_date)}`
                  : "Invitation à rejoindre cet espace."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="j-name">Votre prénom (facultatif)</Label>
                <Input
                  id="j-name"
                  placeholder="Tom"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={handleJoin} disabled={joining}>
                {joining && <Loader2 className="size-4 animate-spin" />}
                Rejoindre cet espace
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Remplace les données actuelles de cet appareil.
              </p>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
