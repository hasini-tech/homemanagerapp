import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, Search, Trash2, Plus, Settings, MessageCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  KuluEntry,
  loadEntries,
  saveEntries,
  getBrotherPhone,
  setBrotherPhone,
  formatINR,
  toCSV,
  buildWhatsAppUrl,
} from "@/lib/kulu-storage";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

async function fetchEntriesFromDb(): Promise<KuluEntry[]> {
  const response = await fetch("/api/entries");
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to load entries from the server (${response.status}): ${text}`);
  }
  return (await response.json()) as KuluEntry[];
}

async function saveEntryToDb(entry: KuluEntry): Promise<KuluEntry> {
  const response = await fetch("/api/entries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to save entry to the server (${response.status}): ${text}`);
  }
  return (await response.json()) as KuluEntry;
}

async function deleteEntryFromDb(id: string): Promise<void> {
  const response = await fetch(`/api/entries/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to delete entry from the server (${response.status}): ${text}`);
  }
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kulu Manager · குலு பதிவேடு" },
      {
        name: "description",
        content: "Easy monthly Kulu collection tracker with WhatsApp sharing.",
      },
      { property: "og:title", content: "Kulu Manager" },
      { property: "og:description", content: "Easy monthly Kulu collection tracker." },
    ],
  }),
  component: Index,
});

function Index() {
  const [entries, setEntries] = useState<KuluEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [phone, setPhone] = useState("");
  const [search, setSearch] = useState("");
  const [brotherPhone, setBrotherPhoneState] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallAvailable, setIsInstallAvailable] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setIsInstallAvailable(true);
    };

    const installedHandler = () => {
      setInstallPrompt(null);
      setIsInstallAvailable(false);
      toast.success("App installed");
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const serverEntries = await fetchEntriesFromDb();
        if (isMounted) setEntries(serverEntries);
      } catch (error) {
        console.error("Failed to load server entries", error);
        if (isMounted) setEntries(loadEntries());
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    setBrotherPhoneState(getBrotherPhone());

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      toast.success("Install accepted");
    } else {
      toast("Install cancelled");
    }
    setInstallPrompt(null);
    setIsInstallAvailable(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? entries.filter((e) => e.name.toLowerCase().includes(q) || (e.phone ?? "").includes(q))
      : entries;
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [entries, search]);

  const monthlyTotal = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    return entries.filter((e) => e.date.startsWith(ym)).reduce((sum, e) => sum + e.amount, 0);
  }, [entries]);

  const allTotal = useMemo(() => entries.reduce((s, e) => s + e.amount, 0), [entries]);

  function persist(next: KuluEntry[]) {
    setEntries(next);
    saveEntries(next);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!name.trim()) return toast.error("பெயர் தேவை · Name required");
    if (!amt || amt <= 0) return toast.error("சரியான தொகை · Valid amount needed");
    if (!date) return toast.error("தேதி தேவை · Date required");

    const entry: KuluEntry = {
      id: crypto.randomUUID(),
      name: name.trim(),
      amount: amt,
      date,
      phone: phone.trim() || undefined,
      createdAt: Date.now(),
    };

    try {
      const saved = await saveEntryToDb(entry);
      persist([saved, ...entries]);
      toast.success("சேர்க்கப்பட்டது · Saved");
    } catch (error) {
      persist([entry, ...entries]);
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to save entry to server", error);
      toast.error(`DB save failed. Saved locally. ${message}`);
    }

    // WhatsApp message
    if (brotherPhone) {
      const msg = `🪙 புதிய குலு பதிவு / New Kulu Entry\n\nபெயர் / Name: ${entry.name}\nதொகை / Amount: ${formatINR(entry.amount)}\nதேதி / Date: ${entry.date}${entry.phone ? `\nஃபோன் / Phone: ${entry.phone}` : ""}`;
      window.open(buildWhatsAppUrl(brotherPhone, msg), "_blank");
    } else {
      toast("அண்ணன் எண் அமைக்கவில்லை · Brother's number not set", {
        description: "Open settings to add it.",
      });
    }

    setName("");
    setAmount("");
    setPhone("");
    setDate(new Date().toISOString().slice(0, 10));
  }

  async function handleDelete(id: string) {
    const nextEntries = entries.filter((e) => e.id !== id);

    try {
      await deleteEntryFromDb(id);
      persist(nextEntries);
      toast.success("நீக்கப்பட்டது · Deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Delete entry failed", error);
      toast.error(`Server delete failed. ${message}`);
    }
  }

  function handleExport() {
    if (!entries.length) return toast.error("ஏதும் இல்லை · No entries");
    const blob = new Blob([toCSV(entries)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kulu-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatDate(value: string) {
    const [year, month, day] = value.split("-");
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  function saveSettings() {
    setBrotherPhone(brotherPhone);
    setSettingsOpen(false);
    toast.success("சேமிக்கப்பட்டது · Settings saved");
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="bg-primary text-primary-foreground px-4 py-5 shadow-md">
        <div className="max-w-2xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold leading-tight">குலு பதிவேடு</h1>
            <p className="text-sm opacity-90">Kulu Manager</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {isInstallAvailable ? (
              <Button size="lg" variant="secondary" onClick={handleInstall} className="h-12">
                <Download className="h-5 w-5" />
                Install App
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground sm:text-sm">
                Use browser menu to install on mobile
              </p>
            )}
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button size="lg" variant="secondary" className="h-12 w-12 p-0 rounded-full">
                  <Settings className="h-6 w-6" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>அமைப்புகள் · Settings</DialogTitle>
                  <DialogDescription>
                    Add the WhatsApp number used for sharing new entries.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <Label htmlFor="bro" className="text-base">
                    அண்ணன் WhatsApp எண் · Brother's WhatsApp
                  </Label>
                  <Input
                    id="bro"
                    inputMode="tel"
                    placeholder="+919876543210"
                    className="h-14 text-lg"
                    value={brotherPhone}
                    onChange={(e) => setBrotherPhoneState(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Include country code (e.g. +91 for India).
                  </p>
                </div>
                <DialogFooter>
                  <Button size="lg" onClick={saveSettings} className="w-full h-12 text-base">
                    சேமி · Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* Totals */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-accent text-accent-foreground border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm opacity-90">
                <Wallet className="h-4 w-4" /> இந்த மாதம்
              </div>
              <div className="text-2xl font-bold mt-1">{formatINR(monthlyTotal)}</div>
              <div className="text-xs opacity-80">This month</div>
            </CardContent>
          </Card>
          <Card className="bg-secondary border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4" /> மொத்தம்
              </div>
              <div className="text-2xl font-bold mt-1">{formatINR(allTotal)}</div>
              <div className="text-xs text-muted-foreground">All time</div>
            </CardContent>
          </Card>
        </div>

        {/* Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">புதிய பதிவு · New Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-base">
                  பெயர் · Name
                </Label>
                <Input
                  id="name"
                  className="h-14 text-lg"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="உதா: ராஜா"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-base">
                  தொகை · Amount (₹)
                </Label>
                <Input
                  id="amount"
                  type="number"
                  inputMode="numeric"
                  className="h-14 text-lg"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date" className="text-base">
                  தேதி · Date
                </Label>
                <Input
                  id="date"
                  type="date"
                  className="h-14 text-lg"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-base">
                  ஃபோன் (விருப்பம்) · Phone (optional)
                </Label>
                <Input
                  id="phone"
                  inputMode="tel"
                  className="h-14 text-lg"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                />
              </div>
              <Button type="submit" size="lg" className="w-full h-14 text-lg font-semibold gap-2">
                <Plus className="h-5 w-5" />
                சேர் & WhatsApp அனுப்பு · Add & Send
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg">பதிவுகள் · Entries</CardTitle>
              <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5">
                <Download className="h-4 w-4" /> CSV
              </Button>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="தேடு · Search by name or phone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-12 pl-9 text-base"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>பதிவுகள் இல்லை · No entries yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kulu Name</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-12 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-semibold">
                        <div className="max-w-40 truncate">{e.name}</div>
                        {e.phone ? (
                          <div className="text-xs font-normal text-muted-foreground">{e.phone}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {formatINR(e.amount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(e.date)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(e.id)}
                          className="h-9 w-9 text-destructive"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
