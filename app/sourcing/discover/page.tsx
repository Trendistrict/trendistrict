"use client";

import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconRocket,
  IconSearch,
  IconLoader2,
  IconBuildingSkyscraper,
  IconEye,
  IconSparkles,
  IconBrandLinkedin,
  IconRefresh,
  IconCheck,
  IconAlertCircle,
} from "@tabler/icons-react";

const SIC_CODE_CATEGORIES = [
  { label: "AI & Software", codes: ["62011", "62012", "62020", "62090"] },
  { label: "Data & Cloud", codes: ["63110", "63120"] },
  { label: "Biotech & R&D", codes: ["72110", "72190", "72200"] },
  { label: "Fintech", codes: ["64209", "64303", "64999", "66190", "66300"] },
];

export default function DiscoverPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<{
    found: number;
    added: number;
    companies: Array<{ name: string; number: string; incorporated: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [daysBack, setDaysBack] = useState("30");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["AI & Software", "Fintech"]);

  const settings = useQuery(api.settings.get);
  const runAutoSourcing = useAction(api.autoSourcing.runAutoSourcing);

  const handleRunSourcing = async () => {
    if (!settings?.companiesHouseApiKey) {
      setError("Please configure your Companies House API key in Settings first.");
      return;
    }

    setIsRunning(true);
    setError(null);
    setResults(null);

    try {
      // Get SIC codes from selected categories
      const sicCodes = SIC_CODE_CATEGORIES
        .filter((cat) => selectedCategories.includes(cat.label))
        .flatMap((cat) => cat.codes);

      const result = await runAutoSourcing({
        apiKey: settings.companiesHouseApiKey,
        daysBack: parseInt(daysBack),
        sicCodeFilter: sicCodes.length > 0 ? sicCodes : undefined,
      });

      setResults(result);
    } catch (err) {
      console.error("Sourcing error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsRunning(false);
    }
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Auto-Discovery</h1>
        <p className="text-muted-foreground">
          Automatically find newly registered UK startups in AI, fintech, and other innovative sectors
        </p>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconSearch className="h-5 w-5" />
            Sourcing Configuration
          </CardTitle>
          <CardDescription>
            Configure filters for automated startup discovery from Companies House
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Time Range */}
          <div className="space-y-2">
            <Label>Search Period</Label>
            <Select value={daysBack} onValueChange={setDaysBack}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Industry Categories */}
          <div className="space-y-3">
            <Label>Industry Sectors</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {SIC_CODE_CATEGORIES.map((category) => (
                <div
                  key={category.label}
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedCategories.includes(category.label)
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => toggleCategory(category.label)}
                >
                  <Checkbox
                    checked={selectedCategories.includes(category.label)}
                    onCheckedChange={() => toggleCategory(category.label)}
                  />
                  <span className="text-sm font-medium">{category.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Run Button */}
          <div className="flex items-center gap-4">
            <Button
              onClick={handleRunSourcing}
              disabled={isRunning || !settings?.companiesHouseApiKey}
              size="lg"
            >
              {isRunning ? (
                <IconLoader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <IconRocket className="h-5 w-5 mr-2" />
              )}
              {isRunning ? "Discovering..." : "Run Auto-Discovery"}
            </Button>
            {!settings?.companiesHouseApiKey && (
              <p className="text-sm text-amber-500">
                Configure your Companies House API key in Settings first
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <IconAlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconSparkles className="h-5 w-5" />
              Discovery Results
            </CardTitle>
            <CardDescription>
              Found {results.found} companies, added {results.added} new startups to your pipeline
            </CardDescription>
          </CardHeader>
          <CardContent>
            {results.companies.length > 0 ? (
              <div className="space-y-3">
                {results.companies.map((company) => (
                  <div
                    key={company.number}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <IconBuildingSkyscraper className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{company.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {company.number} • Incorporated {company.incorporated}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      <IconEye className="h-3 w-3 mr-1" />
                      New
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                No new companies found matching your criteria. Try adjusting the filters or time range.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How Auto-Discovery Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-bold">1</span>
                </div>
                <h4 className="font-medium">Scan Companies House</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Searches UK company filings for newly registered businesses in tech, AI, and fintech sectors
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-bold">2</span>
                </div>
                <h4 className="font-medium">Identify Founders</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Extracts director information and flags companies likely in stealth mode (&lt;90 days old)
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-bold">3</span>
                </div>
                <h4 className="font-medium">Enrich with LinkedIn</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Optionally enriches founder profiles with LinkedIn data to score education and experience
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LinkedIn Integration Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconBrandLinkedin className="h-5 w-5" />
            LinkedIn Enrichment
          </CardTitle>
          <CardDescription>
            Enhance founder profiles with LinkedIn data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            To automatically enrich founder profiles with LinkedIn data (education, work history),
            you&apos;ll need a Proxycurl API key. This allows scoring founders based on top-tier
            universities and high-growth company experience.
          </p>
          <Button variant="outline" asChild>
            <a href="https://nubela.co/proxycurl" target="_blank" rel="noopener noreferrer">
              Get Proxycurl API Key
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
