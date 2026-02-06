"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  IconUpload,
  IconCheck,
  IconLoader2,
  IconDownload,
  IconBuilding,
  IconCoin,
  IconTag,
  IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";

type RelationshipStrength = "weak" | "moderate" | "strong";

interface VCData {
  vcName: string;
  firmName: string;
  email?: string;
  linkedInUrl?: string;
  investmentStages?: string[];
  sectors?: string[];
  checkSize?: string;
  relationshipStrength: RelationshipStrength;
  notes?: string;
}

// Pre-seeded VC data from research
const SEED_VCS: VCData[] = [
  // Pre-Seed VCs
  {
    vcName: "Playfair Capital",
    firmName: "Playfair Capital",
    investmentStages: ["pre-seed"],
    sectors: ["software", "fintech", "healthtech", "ai"],
    checkSize: "£100k-£1.5M",
    relationshipStrength: "weak",
    notes: "78% graduation rate to Series A. Pre-seed specialists.",
  },
  {
    vcName: "SFC Capital",
    firmName: "SFC Capital",
    investmentStages: ["pre-seed", "seed"],
    sectors: ["software", "fintech", "healthtech", "ecommerce"],
    checkSize: "£100k-£300k",
    relationshipStrength: "weak",
    notes: "Most prolific early-stage UK investor. 400+ portfolio companies.",
  },
  {
    vcName: "Forward Partners",
    firmName: "Forward Partners",
    investmentStages: ["pre-seed", "seed"],
    sectors: ["software", "ecommerce", "fintech"],
    checkSize: "£100k-£500k",
    relationshipStrength: "weak",
    notes: "London-based pre-seed/seed fund.",
  },
  {
    vcName: "Creator Fund",
    firmName: "Creator Fund",
    investmentStages: ["pre-seed", "seed"],
    sectors: ["deeptech", "ai", "biotech"],
    checkSize: "£250k-£750k",
    relationshipStrength: "weak",
    notes: "Focus on scientific founders. 25+ university partnerships.",
  },
  {
    vcName: "Northstar Ventures",
    firmName: "Northstar Ventures",
    investmentStages: ["pre-seed", "seed"],
    sectors: ["software", "cleantech", "healthtech"],
    checkSize: "£100k-£500k",
    relationshipStrength: "weak",
    notes: "Newcastle-based. Regional focus on North of England.",
  },
  // Seed Stage VCs
  {
    vcName: "Seedcamp",
    firmName: "Seedcamp",
    investmentStages: ["seed", "series-a"],
    sectors: ["fintech", "saas", "ai", "software"],
    checkSize: "£250k-£4M",
    relationshipStrength: "weak",
    notes: "500+ investments. $141M Fund 6.",
  },
  {
    vcName: "Fuel Ventures",
    firmName: "Fuel Ventures",
    investmentStages: ["pre-seed", "seed"],
    sectors: ["software", "fintech", "healthtech", "ecommerce"],
    checkSize: "£100k-£2M",
    relationshipStrength: "weak",
    notes: "£100M fund. Sector agnostic.",
  },
  {
    vcName: "SuperSeed",
    firmName: "SuperSeed",
    investmentStages: ["seed"],
    sectors: ["saas", "ai", "data", "software"],
    checkSize: "£200k-£2M",
    relationshipStrength: "weak",
    notes: "B2B Software focus. AI and Data specialists.",
  },
  {
    vcName: "Passion Capital",
    firmName: "Passion Capital",
    investmentStages: ["seed"],
    sectors: ["consumer", "fintech", "software"],
    checkSize: "$100k-$1M",
    relationshipStrength: "weak",
    notes: "Early Monzo backer.",
  },
  {
    vcName: "Connect Ventures",
    firmName: "Connect Ventures",
    investmentStages: ["seed", "series-a"],
    sectors: ["software", "fintech", "consumer"],
    checkSize: "$500k-$3M",
    relationshipStrength: "weak",
    notes: "Seed to Series A focus.",
  },
  {
    vcName: "Par Equity",
    firmName: "Par Equity",
    investmentStages: ["seed", "series-a"],
    sectors: ["software", "healthtech", "deeptech"],
    checkSize: "£250k-£5M",
    relationshipStrength: "weak",
    notes: "Edinburgh-based. Scotland focus.",
  },
  {
    vcName: "Hoxton Ventures",
    firmName: "Hoxton Ventures",
    investmentStages: ["seed"],
    sectors: ["mobile", "consumer", "software"],
    checkSize: "£500k-£2M",
    relationshipStrength: "weak",
    notes: "Mobile and internet focus.",
  },
  {
    vcName: "Frontline Ventures",
    firmName: "Frontline Ventures",
    investmentStages: ["seed", "series-a"],
    sectors: ["saas", "software", "ai"],
    checkSize: "€250k-€2.5M",
    relationshipStrength: "weak",
    notes: "B2B SaaS specialists. Europe-wide.",
  },
  // Series A VCs
  {
    vcName: "Balderton Capital",
    firmName: "Balderton Capital",
    investmentStages: ["seed", "series-a", "series-b"],
    sectors: ["fintech", "healthtech", "deeptech", "software"],
    checkSize: "$1M-$10M",
    relationshipStrength: "weak",
    notes: "$1.3B raised in 2024. Largest European early-stage raise.",
  },
  {
    vcName: "Accel",
    firmName: "Accel",
    investmentStages: ["seed", "series-a"],
    sectors: ["software", "fintech", "ai", "consumer"],
    checkSize: "$1M-$20M",
    relationshipStrength: "weak",
    notes: "$650M Europe Fund 8. London office since 2000. Backed Spotify, Slack.",
  },
  {
    vcName: "MMC Ventures",
    firmName: "MMC Ventures",
    investmentStages: ["seed", "series-a"],
    sectors: ["ai", "fintech", "data", "software"],
    checkSize: "£1M-£10M",
    relationshipStrength: "weak",
    notes: "AI and data specialists.",
  },
  {
    vcName: "LocalGlobe",
    firmName: "LocalGlobe",
    investmentStages: ["pre-seed", "seed", "series-a", "series-b", "series-c"],
    sectors: ["ecommerce", "climate", "software", "fintech"],
    checkSize: "£500k-£5M",
    relationshipStrength: "weak",
    notes: "Multi-stage investor. Climate focus.",
  },
  {
    vcName: "Amadeus Capital Partners",
    firmName: "Amadeus Capital Partners",
    investmentStages: ["seed", "series-a", "series-b"],
    sectors: ["deeptech", "ai", "robotics", "software"],
    checkSize: "$1M-$10M+",
    relationshipStrength: "weak",
    notes: "Cambridge-based. University spinouts focus.",
  },
  {
    vcName: "Heartcore Capital",
    firmName: "Heartcore Capital",
    investmentStages: ["seed", "series-a"],
    sectors: ["software", "healthtech", "fintech"],
    checkSize: "$300k-$6M",
    relationshipStrength: "weak",
    notes: "Copenhagen-based. Active in UK.",
  },
  // Growth Stage VCs
  {
    vcName: "Atomico",
    firmName: "Atomico",
    investmentStages: ["series-a", "series-b", "series-c", "growth"],
    sectors: ["software", "fintech", "consumer", "ai"],
    checkSize: "$5M-$50M",
    relationshipStrength: "weak",
    notes: "$754M Growth + $485M Venture. Founded by Skype's Zennström. Backed Klarna, DeepL.",
  },
  {
    vcName: "IVP",
    firmName: "IVP",
    investmentStages: ["series-b", "series-c", "growth"],
    sectors: ["software", "fintech", "consumer"],
    checkSize: "$10M-$100M",
    relationshipStrength: "weak",
    notes: "$1.6B Europe fund. Series B/C specialists.",
  },
  {
    vcName: "Molten Ventures",
    firmName: "Molten Ventures",
    investmentStages: ["seed", "series-a", "series-b"],
    sectors: ["software", "fintech", "deeptech"],
    checkSize: "Up to $50M",
    relationshipStrength: "weak",
    notes: "LSE listed. Public VC.",
  },
  {
    vcName: "Lightspeed Venture Partners",
    firmName: "Lightspeed Venture Partners",
    investmentStages: ["seed", "series-a", "series-b", "growth"],
    sectors: ["software", "fintech", "consumer", "ai"],
    checkSize: "$1M-$100M",
    relationshipStrength: "weak",
    notes: "$25B AUM. Backed Stripe, Anthropic, Snap.",
  },
  {
    vcName: "BGF",
    firmName: "BGF",
    investmentStages: ["seed", "series-a", "series-b"],
    sectors: ["software", "consumer", "healthtech"],
    checkSize: "$5M-$12M",
    relationshipStrength: "weak",
    notes: "Purpose-led startups focus.",
  },
  {
    vcName: "Octopus Ventures",
    firmName: "Octopus Ventures",
    investmentStages: ["seed", "series-a", "series-b", "growth"],
    sectors: ["software", "fintech", "healthtech", "deeptech"],
    checkSize: "£1M-£20M",
    relationshipStrength: "weak",
    notes: "£1.9B+ AUM. Most frequent UK growth investor.",
  },
  // US VCs Active in UK
  {
    vcName: "GV (Google Ventures)",
    firmName: "GV",
    investmentStages: ["pre-seed", "seed", "series-a", "series-b", "growth"],
    sectors: ["software", "ai", "consumer", "healthtech"],
    checkSize: "$1M-$50M",
    relationshipStrength: "weak",
    notes: "Backed Monzo, Nothing, Blockchain.com.",
  },
  {
    vcName: "a16z (Andreessen Horowitz)",
    firmName: "Andreessen Horowitz",
    investmentStages: ["seed", "series-a", "series-b", "growth"],
    sectors: ["crypto", "ai", "software", "fintech"],
    checkSize: "$1M-$100M+",
    relationshipStrength: "weak",
    notes: "Major crypto and AI focus.",
  },
  {
    vcName: "Sequoia Capital",
    firmName: "Sequoia Capital",
    investmentStages: ["series-a", "series-b", "growth"],
    sectors: ["software", "fintech", "consumer", "ai"],
    checkSize: "$5M-$100M+",
    relationshipStrength: "weak",
    notes: "Has Europe team.",
  },
  {
    vcName: "Index Ventures",
    firmName: "Index Ventures",
    investmentStages: ["seed", "series-a", "series-b", "growth"],
    sectors: ["software", "fintech", "consumer", "gaming"],
    checkSize: "$1M-$100M",
    relationshipStrength: "weak",
    notes: "SF + London offices. Backed Revolut, Figma.",
  },
  // Sector Specialists
  {
    vcName: "Anthemis",
    firmName: "Anthemis",
    investmentStages: ["seed", "series-a", "series-b"],
    sectors: ["fintech", "insurtech"],
    checkSize: "£1m-£20m",
    relationshipStrength: "weak",
    notes: "Fintech specialist.",
  },
  {
    vcName: "Talis Capital",
    firmName: "Talis Capital",
    investmentStages: ["seed", "series-a"],
    sectors: ["healthtech", "software"],
    checkSize: "£1M-£5M",
    relationshipStrength: "weak",
    notes: "Healthtech focus.",
  },
  {
    vcName: "Oxford Science Enterprises",
    firmName: "Oxford Science Enterprises",
    investmentStages: ["pre-seed", "seed", "series-a"],
    sectors: ["biotech", "healthtech", "deeptech"],
    checkSize: "£500k-£10M",
    relationshipStrength: "weak",
    notes: "Oxford University spinouts.",
  },
  // Recently Raised Funds (2024-2025)
  {
    vcName: "BNVT Capital",
    firmName: "BNVT Capital",
    investmentStages: ["seed", "series-a"],
    sectors: ["impact", "climate", "software"],
    checkSize: "$1M-$10M",
    relationshipStrength: "weak",
    notes: "$150M fund. Backed by Shopify, Google, Octopus Energy founders.",
  },
  {
    vcName: "Forbion",
    firmName: "Forbion",
    investmentStages: ["series-a", "series-b", "growth"],
    sectors: ["biotech", "healthtech"],
    checkSize: "€10M-€50M",
    relationshipStrength: "weak",
    notes: "€2.1B raised 2024. Life sciences specialist.",
  },
];

export default function VCImportPage() {
  const [selectedVCs, setSelectedVCs] = useState<Set<number>>(new Set());
  const [csvData, setCsvData] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState("curated");

  const bulkImport = useMutation(api.vcConnections.bulkImport);

  const toggleVC = (index: number) => {
    setSelectedVCs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedVCs(new Set(SEED_VCS.map((_, i) => i)));
  };

  const selectNone = () => {
    setSelectedVCs(new Set());
  };

  const selectByStage = (stage: string) => {
    const indices = SEED_VCS.map((vc, i) =>
      vc.investmentStages?.includes(stage) ? i : -1
    ).filter((i) => i !== -1);
    setSelectedVCs(new Set(indices));
  };

  const handleImportCurated = async () => {
    if (selectedVCs.size === 0) return;

    setIsImporting(true);
    try {
      const vcsToImport = Array.from(selectedVCs).map((i) => SEED_VCS[i]);
      const result = await bulkImport({
        vcs: vcsToImport,
        skipDuplicates: true,
      });
      setImportResult(result);
      setSelectedVCs(new Set());
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportCSV = async () => {
    if (!csvData.trim()) return;

    setIsImporting(true);
    try {
      const lines = csvData.trim().split("\n");
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

      const vcsToImport: VCData[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || "";
        });

        if (row["vc name"] && row["firm name"]) {
          vcsToImport.push({
            vcName: row["vc name"],
            firmName: row["firm name"],
            email: row["email"] || undefined,
            linkedInUrl: row["linkedin"] || undefined,
            investmentStages: row["stages"]
              ? row["stages"].split(";").map((s) => s.trim())
              : undefined,
            sectors: row["sectors"]
              ? row["sectors"].split(";").map((s) => s.trim())
              : undefined,
            checkSize: row["check size"] || undefined,
            relationshipStrength: (row["relationship"] as RelationshipStrength) || "weak",
            notes: row["notes"] || undefined,
          });
        }
      }

      const result = await bulkImport({
        vcs: vcsToImport,
        skipDuplicates: true,
      });
      setImportResult(result);
      setCsvData("");
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template =
      "VC Name,Firm Name,Email,LinkedIn,Stages,Sectors,Check Size,Relationship,Notes\n" +
      "John Smith,Accel,john@accel.com,https://linkedin.com/in/john,seed;series-a,fintech;software,$1M-$5M,weak,Met at conference";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vc_import_template.csv";
    a.click();
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Import VCs</h1>
          <p className="text-muted-foreground">
            Add VCs to your network from our curated list or import your own
          </p>
        </div>
        <Link href="/sourcing/vcs">
          <Button variant="outline">Back to VC Network</Button>
        </Link>
      </div>

      {/* Import Result */}
      {importResult && (
        <Card className="bg-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <IconCheck className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="font-medium text-emerald-500">Import Complete</p>
                <p className="text-sm text-muted-foreground">
                  {importResult.imported} VCs imported, {importResult.skipped}{" "}
                  duplicates skipped
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => setImportResult(null)}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="curated">Curated VCs ({SEED_VCS.length})</TabsTrigger>
          <TabsTrigger value="csv">CSV Import</TabsTrigger>
        </TabsList>

        {/* Curated VCs Tab */}
        <TabsContent value="curated" className="space-y-4">
          {/* Quick Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Quick Select</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={selectNone}>
                  Clear
                </Button>
                <span className="text-muted-foreground mx-2">|</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectByStage("pre-seed")}
                >
                  Pre-Seed
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectByStage("seed")}
                >
                  Seed
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectByStage("series-a")}
                >
                  Series A
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectByStage("series-b")}
                >
                  Series B+
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* VC List */}
          <div className="grid gap-3">
            {SEED_VCS.map((vc, index) => (
              <Card
                key={index}
                className={`cursor-pointer transition-colors ${
                  selectedVCs.has(index)
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => toggleVC(index)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedVCs.has(index)}
                      onChange={() => toggleVC(index)}
                      className="h-5 w-5 mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <IconBuilding className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{vc.firmName}</span>
                        {vc.vcName !== vc.firmName && (
                          <span className="text-muted-foreground">
                            ({vc.vcName})
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {vc.investmentStages?.map((stage) => (
                          <Badge key={stage} variant="secondary">
                            {stage}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {vc.checkSize && (
                          <span className="flex items-center gap-1">
                            <IconCoin className="h-4 w-4" />
                            {vc.checkSize}
                          </span>
                        )}
                        {vc.sectors && vc.sectors.length > 0 && (
                          <span className="flex items-center gap-1">
                            <IconTag className="h-4 w-4" />
                            {vc.sectors.slice(0, 3).join(", ")}
                            {vc.sectors.length > 3 &&
                              ` +${vc.sectors.length - 3}`}
                          </span>
                        )}
                      </div>

                      {vc.notes && (
                        <p className="text-sm text-muted-foreground">
                          {vc.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Import Button */}
          <div className="sticky bottom-4 flex justify-center">
            <Card className="shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <IconUsers className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">
                      {selectedVCs.size} VCs selected
                    </span>
                  </div>
                  <Button
                    onClick={handleImportCurated}
                    disabled={selectedVCs.size === 0 || isImporting}
                  >
                    {isImporting ? (
                      <>
                        <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <IconUpload className="h-4 w-4 mr-2" />
                        Import Selected
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CSV Import Tab */}
        <TabsContent value="csv" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>CSV Import</CardTitle>
              <CardDescription>
                Upload your own VC list in CSV format
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <IconDownload className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Paste CSV Data</Label>
                <Textarea
                  placeholder="VC Name,Firm Name,Email,LinkedIn,Stages,Sectors,Check Size,Relationship,Notes"
                  value={csvData}
                  onChange={(e) => setCsvData(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Use semicolons (;) to separate multiple stages or sectors
                  within a cell
                </p>
              </div>

              <Button
                onClick={handleImportCSV}
                disabled={!csvData.trim() || isImporting}
              >
                {isImporting ? (
                  <>
                    <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <IconUpload className="h-4 w-4 mr-2" />
                    Import CSV
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
