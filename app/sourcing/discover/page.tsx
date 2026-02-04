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
  // Tech & Software
  { label: "SaaS & Software", codes: ["62011", "62012", "62020", "62030", "62090"], group: "Tech" },
  { label: "AI & Machine Learning", codes: ["62011", "62012", "72190", "72200"], group: "Tech" },
  { label: "Data & Cloud", codes: ["63110", "63120", "63910", "63990"], group: "Tech" },
  { label: "Cybersecurity", codes: ["62020", "62090", "63110"], group: "Tech" },

  // Finance & Insurance
  { label: "Fintech", codes: ["64209", "64303", "64921", "64999", "66110", "66190", "66300"], group: "Finance" },
  { label: "InsurTech", codes: ["65110", "65120", "65201", "65202"], group: "Finance" },

  // Health & Science
  { label: "HealthTech & BioTech", codes: ["72110", "72190", "86210", "86220", "86230"], group: "Health" },
  { label: "FitnessTech & Wellness", codes: ["93130", "93110", "96040", "86900"], group: "Health" },

  // Consumer & Retail
  { label: "E-commerce & Marketplaces", codes: ["47910", "47990", "63120"], group: "Consumer" },
  { label: "Consumer Tech", codes: ["62011", "62012", "63120", "59111", "59120"], group: "Consumer" },
  { label: "FashionTech & Retail", codes: ["14110", "14120", "14130", "46420", "47710"], group: "Consumer" },
  { label: "FoodTech & AgriTech", codes: ["10110", "10200", "10310", "01110", "01500"], group: "Consumer" },

  // Enterprise & Services
  { label: "PropTech", codes: ["68100", "68201", "68202", "68209", "68310"], group: "Enterprise" },
  { label: "EdTech", codes: ["85421", "85422", "85590", "85600"], group: "Enterprise" },
  { label: "HR Tech", codes: ["78100", "78200", "78300", "82990"], group: "Enterprise" },
  { label: "LegalTech", codes: ["69101", "69102", "69109"], group: "Enterprise" },
  { label: "Logistics & Supply Chain", codes: ["49410", "52100", "52210", "52290"], group: "Enterprise" },

  // Sustainability & Energy
  { label: "CleanTech & Sustainability", codes: ["35110", "35120", "38110", "38320", "39000"], group: "Sustainability" },

  // Entertainment
  { label: "Gaming & Entertainment", codes: ["58210", "59111", "59120", "62011"], group: "Entertainment" },
];

const BUSINESS_MODELS = [
  { label: "B2B", description: "Business-to-Business" },
  { label: "B2C", description: "Business-to-Consumer" },
  { label: "DTC", description: "Direct-to-Consumer" },
  { label: "Marketplace", description: "Two-sided platform" },
];

const CATEGORY_GROUPS = [
  { name: "Tech", color: "bg-blue-500/10 border-blue-500/30" },
  { name: "Finance", color: "bg-green-500/10 border-green-500/30" },
  { name: "Health", color: "bg-pink-500/10 border-pink-500/30" },
  { name: "Consumer", color: "bg-orange-500/10 border-orange-500/30" },
  { name: "Enterprise", color: "bg-purple-500/10 border-purple-500/30" },
  { name: "Sustainability", color: "bg-emerald-500/10 border-emerald-500/30" },
  { name: "Entertainment", color: "bg-yellow-500/10 border-yellow-500/30" },
];

export default function DiscoverPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [results, setResults] = useState<{
    found: number;
    added: number;
    companies: Array<{ name: string; number: string; incorporated: string }>;
  } | null>(null);
  const [enrichResults, setEnrichResults] = useState<{
    startupsProcessed: number;
    foundersEnriched: number;
    stealthDetected: number;
    companiesEnriched: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [daysBack, setDaysBack] = useState("30");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["SaaS & Software", "AI & Machine Learning", "Fintech"]);
  const [selectedBusinessModels, setSelectedBusinessModels] = useState<string[]>([]);

  const settings = useQuery(api.settings.get);
  const runAutoSourcing = useAction(api.autoSourcing.runAutoSourcing);
  const enrichDiscoveredStartups = useAction(api.autoSourcing.enrichDiscoveredStartups);

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

  const handleEnrichStartups = async () => {
    if (!settings?.exaApiKey) {
      setError("Please configure your Exa.ai API key in Settings first.");
      return;
    }

    setIsEnriching(true);
    setError(null);
    setEnrichResults(null);

    try {
      const result = await enrichDiscoveredStartups({
        exaApiKey: settings.exaApiKey,
        limit: 10,
      });
      setEnrichResults(result);
    } catch (err) {
      console.error("Enrichment error:", err);
      setError(err instanceof Error ? err.message : "An error occurred during enrichment");
    } finally {
      setIsEnriching(false);
    }
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

          {/* Industry Categories - Grouped */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Industry Verticals</Label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCategories(SIC_CODE_CATEGORIES.map(c => c.label))}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCategories([])}
                >
                  Clear
                </Button>
              </div>
            </div>

            {CATEGORY_GROUPS.map((group) => {
              const groupCategories = SIC_CODE_CATEGORIES.filter(c => c.group === group.name);
              if (groupCategories.length === 0) return null;

              return (
                <div key={group.name} className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">{group.name}</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {groupCategories.map((category) => (
                      <div
                        key={category.label}
                        className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors text-sm ${
                          selectedCategories.includes(category.label)
                            ? `border-primary bg-primary/10`
                            : `${group.color} hover:border-primary/50`
                        }`}
                        onClick={() => toggleCategory(category.label)}
                      >
                        <Checkbox
                          checked={selectedCategories.includes(category.label)}
                          onCheckedChange={() => toggleCategory(category.label)}
                        />
                        <span className="font-medium truncate">{category.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Business Model Filter */}
          <div className="space-y-3">
            <Label>Business Model (Optional)</Label>
            <div className="flex flex-wrap gap-2">
              {BUSINESS_MODELS.map((model) => (
                <Badge
                  key={model.label}
                  variant={selectedBusinessModels.includes(model.label) ? "default" : "outline"}
                  className="cursor-pointer px-3 py-1"
                  onClick={() => {
                    setSelectedBusinessModels(prev =>
                      prev.includes(model.label)
                        ? prev.filter(m => m !== model.label)
                        : [...prev, model.label]
                    );
                  }}
                >
                  {model.label}
                  <span className="ml-1 text-xs opacity-70">({model.description})</span>
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Business model is inferred from company data and LinkedIn enrichment
            </p>
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

      {/* LinkedIn Enrichment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconBrandLinkedin className="h-5 w-5" />
            LinkedIn Enrichment
            {settings?.exaApiKey && (
              <Badge variant="secondary" className="ml-2">
                <IconCheck className="h-3 w-3 mr-1" />
                Configured
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Enrich founder profiles with LinkedIn data, detect stealth mode, and calculate founder scores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings?.exaApiKey ? (
            <>
              <p className="text-sm text-muted-foreground">
                Enrichment will search LinkedIn for founder profiles, detect stealth signals,
                score founders based on top universities (Oxford, Cambridge, Stanford, etc.)
                and high-growth company experience (Google, Stripe, Revolut, etc.).
              </p>
              <Button
                onClick={handleEnrichStartups}
                disabled={isEnriching}
              >
                {isEnriching ? (
                  <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <IconSparkles className="h-4 w-4 mr-2" />
                )}
                {isEnriching ? "Enriching Profiles..." : "Enrich Discovered Startups"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                To automatically enrich founder profiles with LinkedIn data (education, work history),
                you&apos;ll need an Exa.ai API key. This allows scoring founders based on top-tier
                universities and high-growth company experience.
              </p>
              <Button variant="outline" asChild>
                <a href="https://exa.ai" target="_blank" rel="noopener noreferrer">
                  Get Exa.ai API Key
                </a>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Enrichment Results */}
      {enrichResults && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconCheck className="h-5 w-5 text-green-500" />
              Enrichment Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-background rounded-lg">
                <p className="text-2xl font-bold">{enrichResults.startupsProcessed}</p>
                <p className="text-sm text-muted-foreground">Startups Processed</p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg">
                <p className="text-2xl font-bold">{enrichResults.foundersEnriched}</p>
                <p className="text-sm text-muted-foreground">Founders Enriched</p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg">
                <p className="text-2xl font-bold text-amber-500">{enrichResults.stealthDetected}</p>
                <p className="text-sm text-muted-foreground">Stealth Detected</p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg">
                <p className="text-2xl font-bold">{enrichResults.companiesEnriched}</p>
                <p className="text-sm text-muted-foreground">Companies Info Found</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              View enriched founders and their scores in the Founders section.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
