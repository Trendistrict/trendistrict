"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
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
  IconSettings,
  IconKey,
  IconMail,
  IconBrandLinkedin,
  IconSchool,
  IconBriefcase,
  IconPlus,
  IconX,
  IconCheck,
  IconLoader2,
  IconExternalLink,
  IconSparkles,
  IconSearch,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
  const settings = useQuery(api.settings.get);
  const highGrowthCompanies = useQuery(api.settings.listHighGrowthCompanies);
  const topUniversities = useQuery(api.settings.listTopUniversities);
  const pipelineStatus = useQuery(api.backgroundJobsDb.getPipelineStatus);
  const pipelineStats = useQuery(api.startupQualificationQueries.getPipelineStats);

  const upsertSettings = useMutation(api.settings.upsert);
  const addHighGrowthCompany = useMutation(api.settings.addHighGrowthCompany);
  const removeHighGrowthCompany = useMutation(api.settings.removeHighGrowthCompany);
  const addTopUniversity = useMutation(api.settings.addTopUniversity);
  const removeTopUniversity = useMutation(api.settings.removeTopUniversity);
  const seedDefaults = useMutation(api.settings.seedDefaults);
  const runVcDiscovery = useAction(api.vcDiscovery.runVcDiscovery);
  const testCompaniesHouseApiKey = useAction(api.autoSourcing.testApiKey);
  const runAutoSourcing = useAction(api.autoSourcing.runAutoSourcing);
  const runFullPipeline = useAction(api.startupQualification.runFullPipeline);

  const [formData, setFormData] = useState({
    companiesHouseApiKey: "",
    exaApiKey: "",
    emailApiKey: "",
    emailProvider: "resend",
    emailFromAddress: "",
    emailFromName: "",
    linkedInProfileUrl: "",
    autoScoreFounders: true,
    // VC Discovery API keys
    apolloApiKey: "",
    hunterApiKey: "",
    rocketReachApiKey: "",
    zeroBouncApiKey: "",
    crunchbaseApiKey: "",
  });

  const [newCompany, setNewCompany] = useState({ name: "", category: "" });
  const [newUniversity, setNewUniversity] = useState({ name: "", tier: "tier2" as "tier1" | "tier2" | "tier3", country: "" });
  const [saving, setSaving] = useState(false);
  const [discoveryRunning, setDiscoveryRunning] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<{
    vcsFound: number;
    vcsImported: number;
    vcsFlagged: number;
    vcsSkipped: number;
  } | null>(null);
  const [testingCompaniesHouse, setTestingCompaniesHouse] = useState(false);
  const [companiesHouseTestResult, setCompaniesHouseTestResult] = useState<{
    success: boolean;
    message: string;
    basicSearchWorks: boolean;
    advancedSearchWorks: boolean;
  } | null>(null);
  const [startupDiscoveryRunning, setStartupDiscoveryRunning] = useState(false);
  const [startupDiscoveryResult, setStartupDiscoveryResult] = useState<{
    found: number;
    added: number;
  } | null>(null);
  const [fullPipelineRunning, setFullPipelineRunning] = useState(false);
  const [fullPipelineResult, setFullPipelineResult] = useState<{
    discovery: { found: number; added: number };
    enrichment: { processed: number; enriched: number };
    qualification: { processed: number; qualified: number; watchlist: number };
  } | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData({
        companiesHouseApiKey: settings.companiesHouseApiKey ?? "",
        exaApiKey: settings.exaApiKey ?? "",
        emailApiKey: settings.emailApiKey ?? "",
        emailProvider: settings.emailProvider ?? "resend",
        emailFromAddress: settings.emailFromAddress ?? "",
        emailFromName: settings.emailFromName ?? "",
        linkedInProfileUrl: settings.linkedInProfileUrl ?? "",
        autoScoreFounders: settings.autoScoreFounders ?? true,
        // VC Discovery API keys
        apolloApiKey: settings.apolloApiKey ?? "",
        hunterApiKey: settings.hunterApiKey ?? "",
        rocketReachApiKey: settings.rocketReachApiKey ?? "",
        zeroBouncApiKey: settings.zeroBouncApiKey ?? "",
        crunchbaseApiKey: settings.crunchbaseApiKey ?? "",
      });
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await upsertSettings({
        companiesHouseApiKey: formData.companiesHouseApiKey || undefined,
        exaApiKey: formData.exaApiKey || undefined,
        emailApiKey: formData.emailApiKey || undefined,
        emailProvider: formData.emailProvider || undefined,
        emailFromAddress: formData.emailFromAddress || undefined,
        emailFromName: formData.emailFromName || undefined,
        linkedInProfileUrl: formData.linkedInProfileUrl || undefined,
        autoScoreFounders: formData.autoScoreFounders,
        apolloApiKey: formData.apolloApiKey || undefined,
        hunterApiKey: formData.hunterApiKey || undefined,
        rocketReachApiKey: formData.rocketReachApiKey || undefined,
        zeroBouncApiKey: formData.zeroBouncApiKey || undefined,
        crunchbaseApiKey: formData.crunchbaseApiKey || undefined,
      });
    } catch (error) {
      console.error("Settings save failed:", error);
      alert(`Failed to save settings: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddCompany = async () => {
    if (!newCompany.name) return;
    await addHighGrowthCompany({
      companyName: newCompany.name,
      category: newCompany.category || undefined,
    });
    setNewCompany({ name: "", category: "" });
  };

  const handleAddUniversity = async () => {
    if (!newUniversity.name) return;
    await addTopUniversity({
      universityName: newUniversity.name,
      tier: newUniversity.tier,
      country: newUniversity.country || undefined,
    });
    setNewUniversity({ name: "", tier: "tier2", country: "" });
  };

  const handleTestCompaniesHouse = async () => {
    if (!formData.companiesHouseApiKey) {
      alert("Please enter a Companies House API key first");
      return;
    }

    setTestingCompaniesHouse(true);
    setCompaniesHouseTestResult(null);

    try {
      const result = await testCompaniesHouseApiKey({
        apiKey: formData.companiesHouseApiKey,
      });
      setCompaniesHouseTestResult(result);
    } catch (error) {
      console.error("API test failed:", error);
      setCompaniesHouseTestResult({
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        basicSearchWorks: false,
        advancedSearchWorks: false,
      });
    } finally {
      setTestingCompaniesHouse(false);
    }
  };

  const handleRunStartupDiscovery = async () => {
    if (!formData.companiesHouseApiKey) {
      alert("Please configure and save your Companies House API key first");
      return;
    }

    setStartupDiscoveryRunning(true);
    setStartupDiscoveryResult(null);

    try {
      // Save settings first
      await upsertSettings({
        companiesHouseApiKey: formData.companiesHouseApiKey,
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await runAutoSourcing({
        apiKey: formData.companiesHouseApiKey,
        daysBack: 30,
      });
      setStartupDiscoveryResult({
        found: result.found,
        added: result.added,
      });
    } catch (error) {
      console.error("Startup discovery failed:", error);
      alert(`Startup discovery failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setStartupDiscoveryRunning(false);
    }
  };

  const handleRunFullPipeline = async () => {
    if (!formData.companiesHouseApiKey) {
      alert("Please configure and save your Companies House API key first");
      return;
    }

    setFullPipelineRunning(true);
    setFullPipelineResult(null);

    try {
      // Save settings first
      await upsertSettings({
        companiesHouseApiKey: formData.companiesHouseApiKey,
        exaApiKey: formData.exaApiKey || undefined,
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await runFullPipeline({
        companiesHouseApiKey: formData.companiesHouseApiKey,
        exaApiKey: formData.exaApiKey || undefined,
        daysBack: 30,
      });
      setFullPipelineResult(result);
    } catch (error) {
      console.error("Full pipeline failed:", error);
      alert(`Full pipeline failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setFullPipelineRunning(false);
    }
  };

  const handleRunDiscovery = async () => {
    setDiscoveryRunning(true);
    setDiscoveryResult(null);

    try {
      // Save settings first to ensure API keys are in the database
      await upsertSettings({
        companiesHouseApiKey: formData.companiesHouseApiKey || undefined,
        exaApiKey: formData.exaApiKey || undefined,
        emailApiKey: formData.emailApiKey || undefined,
        emailProvider: formData.emailProvider || undefined,
        emailFromAddress: formData.emailFromAddress || undefined,
        emailFromName: formData.emailFromName || undefined,
        linkedInProfileUrl: formData.linkedInProfileUrl || undefined,
        autoScoreFounders: formData.autoScoreFounders,
        apolloApiKey: formData.apolloApiKey || undefined,
        hunterApiKey: formData.hunterApiKey || undefined,
        rocketReachApiKey: formData.rocketReachApiKey || undefined,
        zeroBouncApiKey: formData.zeroBouncApiKey || undefined,
        crunchbaseApiKey: formData.crunchbaseApiKey || undefined,
      });

      // Small delay to let the mutation propagate
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await runVcDiscovery({ manual: true, source: "bvca" });
      setDiscoveryResult(result);
    } catch (error) {
      console.error("Discovery failed:", error);
      alert(`Discovery failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setDiscoveryRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Configure API keys and scoring criteria
        </p>
      </div>

      <Tabs defaultValue="api" className="space-y-6">
        <TabsList>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="scoring">Scoring Criteria</TabsTrigger>
          <TabsTrigger value="email">Email Settings</TabsTrigger>
        </TabsList>

        {/* API Keys Tab */}
        <TabsContent value="api" className="space-y-6">
          {/* Pipeline Status Card */}
          <Card className="border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconSparkles className="h-5 w-5 text-primary" />
                Pipeline Status
                {pipelineStatus?.isRunning && (
                  <Badge variant="secondary" className="ml-2 gap-1">
                    <IconLoader2 className="h-3 w-3 animate-spin" />
                    Running
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Automatic startup discovery, enrichment, and qualification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{pipelineStats?.discovered ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Discovered</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{pipelineStats?.researching ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Researching</div>
                </div>
                <div className="text-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="text-2xl font-bold text-green-600">{pipelineStats?.qualified ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Qualified</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{pipelineStats?.contacted ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Contacted</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-muted-foreground">{pipelineStats?.passed ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Passed</div>
                </div>
              </div>

              {/* Tier Breakdown */}
              {pipelineStats && pipelineStats.qualified > 0 && (
                <div className="flex gap-4 text-sm border-t pt-3">
                  <span className="text-muted-foreground">Qualified by Tier:</span>
                  <span className="font-medium text-green-600">Tier A: {pipelineStats.tiers.A}</span>
                  <span className="font-medium text-blue-600">Tier B: {pipelineStats.tiers.B}</span>
                  <span className="font-medium text-yellow-600">Tier C: {pipelineStats.tiers.C}</span>
                </div>
              )}

              {/* API Keys Status */}
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                <span className="text-xs text-muted-foreground">API Keys:</span>
                {pipelineStatus?.apiKeysConfigured?.companiesHouse ? (
                  <Badge variant="secondary" className="text-xs">Companies House <IconCheck className="h-3 w-3 ml-1" /></Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Companies House <IconX className="h-3 w-3 ml-1" /></Badge>
                )}
                {pipelineStatus?.apiKeysConfigured?.exa ? (
                  <Badge variant="secondary" className="text-xs">Exa.ai <IconCheck className="h-3 w-3 ml-1" /></Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Exa.ai <IconX className="h-3 w-3 ml-1" /></Badge>
                )}
                {pipelineStatus?.apiKeysConfigured?.apollo ? (
                  <Badge variant="secondary" className="text-xs">Apollo <IconCheck className="h-3 w-3 ml-1" /></Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Apollo <IconX className="h-3 w-3 ml-1" /></Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconKey className="h-5 w-5" />
                Companies House API
              </CardTitle>
              <CardDescription>
                Required to search for UK company filings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companiesHouseApiKey">API Key</Label>
                <Input
                  id="companiesHouseApiKey"
                  type="password"
                  value={formData.companiesHouseApiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, companiesHouseApiKey: e.target.value })
                  }
                  placeholder="Enter your Companies House API key"
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{" "}
                  <a
                    href="https://developer.company-information.service.gov.uk/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Companies House Developer Hub
                    <IconExternalLink className="h-3 w-3 inline ml-1" />
                  </a>
                </p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                {formData.companiesHouseApiKey && (
                  <Badge variant="secondary" className="gap-1">
                    <IconCheck className="h-3 w-3" />
                    Configured
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestCompaniesHouse}
                  disabled={testingCompaniesHouse || !formData.companiesHouseApiKey}
                >
                  {testingCompaniesHouse ? (
                    <IconLoader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <IconSearch className="h-4 w-4 mr-1" />
                  )}
                  Test API Key
                </Button>
              </div>

              {/* Test Results */}
              {companiesHouseTestResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  companiesHouseTestResult.success ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"
                }`}>
                  <p className={companiesHouseTestResult.success ? "text-green-600" : "text-red-600"}>
                    {companiesHouseTestResult.message}
                  </p>
                  <div className="mt-2 flex gap-3 text-xs">
                    <span className={companiesHouseTestResult.basicSearchWorks ? "text-green-600" : "text-muted-foreground"}>
                      Basic Search: {companiesHouseTestResult.basicSearchWorks ? "✓" : "✗"}
                    </span>
                    <span className={companiesHouseTestResult.advancedSearchWorks ? "text-green-600" : "text-muted-foreground"}>
                      Advanced Search: {companiesHouseTestResult.advancedSearchWorks ? "✓" : "✗"}
                    </span>
                  </div>
                </div>
              )}

              {/* Run Startup Discovery */}
              <div className="pt-4 border-t mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Run Startup Discovery</p>
                    <p className="text-xs text-muted-foreground">
                      Find newly incorporated UK tech startups (last 30 days)
                    </p>
                  </div>
                  <Button
                    onClick={handleRunStartupDiscovery}
                    disabled={startupDiscoveryRunning || !formData.companiesHouseApiKey}
                    variant="outline"
                  >
                    {startupDiscoveryRunning ? (
                      <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <IconPlayerPlay className="h-4 w-4 mr-2" />
                    )}
                    {startupDiscoveryRunning ? "Running..." : "Run Now"}
                  </Button>
                </div>

                {/* Startup Discovery Results */}
                {startupDiscoveryResult && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Startup Discovery Results</p>
                    <div className="grid grid-cols-2 gap-2 text-center text-sm">
                      <div>
                        <div className="text-lg font-semibold">{startupDiscoveryResult.found}</div>
                        <div className="text-xs text-muted-foreground">Found</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-green-600">{startupDiscoveryResult.added}</div>
                        <div className="text-xs text-muted-foreground">Added</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Full Pipeline */}
                <div className="pt-4 border-t mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Run Full Pipeline</p>
                      <p className="text-xs text-muted-foreground">
                        Discover → Enrich → Qualify startups automatically
                      </p>
                    </div>
                    <Button
                      onClick={handleRunFullPipeline}
                      disabled={fullPipelineRunning || !formData.companiesHouseApiKey}
                      variant="default"
                    >
                      {fullPipelineRunning ? (
                        <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <IconSparkles className="h-4 w-4 mr-2" />
                      )}
                      {fullPipelineRunning ? "Running Pipeline..." : "Run Full Pipeline"}
                    </Button>
                  </div>

                  {/* Full Pipeline Results */}
                  {fullPipelineResult && (
                    <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <p className="text-sm font-medium mb-3 text-green-600">Pipeline Complete</p>
                      <div className="grid grid-cols-3 gap-4 text-center text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Discovery</div>
                          <div className="text-lg font-semibold">{fullPipelineResult.discovery.added}</div>
                          <div className="text-xs text-muted-foreground">startups added</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Enrichment</div>
                          <div className="text-lg font-semibold">{fullPipelineResult.enrichment.enriched}</div>
                          <div className="text-xs text-muted-foreground">founders enriched</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Qualification</div>
                          <div className="text-lg font-semibold text-green-600">{fullPipelineResult.qualification.qualified}</div>
                          <div className="text-xs text-muted-foreground">qualified</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconSparkles className="h-5 w-5" />
                Exa.ai API (LinkedIn Enrichment)
              </CardTitle>
              <CardDescription>
                Used to find and enrich founder LinkedIn profiles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="exaApiKey">API Key</Label>
                <Input
                  id="exaApiKey"
                  type="password"
                  value={formData.exaApiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, exaApiKey: e.target.value })
                  }
                  placeholder="Enter your Exa.ai API key"
                />
                <p className="text-xs text-muted-foreground">
                  Get your API key from{" "}
                  <a
                    href="https://exa.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Exa.ai Dashboard
                    <IconExternalLink className="h-3 w-3 inline ml-1" />
                  </a>
                </p>
              </div>
              {formData.exaApiKey && (
                <Badge variant="secondary" className="gap-1">
                  <IconCheck className="h-3 w-3" />
                  Configured
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconBrandLinkedin className="h-5 w-5" />
                LinkedIn Profile
              </CardTitle>
              <CardDescription>
                Your LinkedIn profile for tracking connections
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="linkedInProfileUrl">Your LinkedIn URL</Label>
                <Input
                  id="linkedInProfileUrl"
                  value={formData.linkedInProfileUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, linkedInProfileUrl: e.target.value })
                  }
                  placeholder="https://linkedin.com/in/yourprofile"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconSearch className="h-5 w-5" />
                VC Discovery APIs
              </CardTitle>
              <CardDescription>
                APIs for automatic VC discovery and email finding (runs weekly on Sundays)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Apollo - Primary email discovery */}
              <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                <Label htmlFor="apolloApiKey" className="flex items-center gap-2">
                  Apollo.io API Key
                  <Badge variant="default" className="text-xs">Primary</Badge>
                </Label>
                <Input
                  id="apolloApiKey"
                  type="password"
                  value={formData.apolloApiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, apolloApiKey: e.target.value })
                  }
                  placeholder="Enter your Apollo.io API key"
                />
                <p className="text-xs text-muted-foreground">
                  Best for finding VC partner emails. Get your API key from{" "}
                  <a
                    href="https://app.apollo.io/#/settings/integrations/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Apollo Settings
                    <IconExternalLink className="h-3 w-3 inline ml-1" />
                  </a>
                </p>
                {formData.apolloApiKey && (
                  <Badge variant="secondary" className="gap-1">
                    <IconCheck className="h-3 w-3" />
                    Apollo Configured
                  </Badge>
                )}
              </div>

              {/* Fallback APIs */}
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Fallback APIs (optional)
                </Label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hunterApiKey">Hunter.io API Key</Label>
                  <Input
                    id="hunterApiKey"
                    type="password"
                    value={formData.hunterApiKey}
                    onChange={(e) =>
                      setFormData({ ...formData, hunterApiKey: e.target.value })
                    }
                    placeholder="Enter your Hunter.io API key"
                  />
                  <p className="text-xs text-muted-foreground">
                    Find partner emails via{" "}
                    <a
                      href="https://hunter.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Hunter.io
                      <IconExternalLink className="h-3 w-3 inline ml-1" />
                    </a>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rocketReachApiKey">RocketReach API Key</Label>
                  <Input
                    id="rocketReachApiKey"
                    type="password"
                    value={formData.rocketReachApiKey}
                    onChange={(e) =>
                      setFormData({ ...formData, rocketReachApiKey: e.target.value })
                    }
                    placeholder="Enter your RocketReach API key"
                  />
                  <p className="text-xs text-muted-foreground">
                    Backup email discovery via{" "}
                    <a
                      href="https://rocketreach.co/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      RocketReach
                      <IconExternalLink className="h-3 w-3 inline ml-1" />
                    </a>
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="zeroBouncApiKey">ZeroBounce API Key</Label>
                  <Input
                    id="zeroBouncApiKey"
                    type="password"
                    value={formData.zeroBouncApiKey}
                    onChange={(e) =>
                      setFormData({ ...formData, zeroBouncApiKey: e.target.value })
                    }
                    placeholder="Enter your ZeroBounce API key"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email validation via{" "}
                    <a
                      href="https://www.zerobounce.net/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      ZeroBounce
                      <IconExternalLink className="h-3 w-3 inline ml-1" />
                    </a>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="crunchbaseApiKey">Crunchbase API Key</Label>
                  <Input
                    id="crunchbaseApiKey"
                    type="password"
                    value={formData.crunchbaseApiKey}
                    onChange={(e) =>
                      setFormData({ ...formData, crunchbaseApiKey: e.target.value })
                    }
                    placeholder="Enter your Crunchbase API key"
                  />
                  <p className="text-xs text-muted-foreground">
                    Portfolio data via{" "}
                    <a
                      href="https://www.crunchbase.com/home"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Crunchbase
                      <IconExternalLink className="h-3 w-3 inline ml-1" />
                    </a>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.hunterApiKey && (
                  <Badge variant="secondary" className="gap-1">
                    <IconCheck className="h-3 w-3" />
                    Hunter.io
                  </Badge>
                )}
                {formData.rocketReachApiKey && (
                  <Badge variant="secondary" className="gap-1">
                    <IconCheck className="h-3 w-3" />
                    RocketReach
                  </Badge>
                )}
                {formData.zeroBouncApiKey && (
                  <Badge variant="secondary" className="gap-1">
                    <IconCheck className="h-3 w-3" />
                    ZeroBounce
                  </Badge>
                )}
                {formData.crunchbaseApiKey && (
                  <Badge variant="secondary" className="gap-1">
                    <IconCheck className="h-3 w-3" />
                    Crunchbase
                  </Badge>
                )}
              </div>

              {/* Run Discovery Now */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Run Discovery Now</p>
                    <p className="text-xs text-muted-foreground">
                      Manually trigger VC discovery (scrapes BVCA, finds emails via Apollo)
                    </p>
                  </div>
                  <Button
                    onClick={handleRunDiscovery}
                    disabled={discoveryRunning}
                    variant="outline"
                  >
                    {discoveryRunning ? (
                      <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <IconPlayerPlay className="h-4 w-4 mr-2" />
                    )}
                    {discoveryRunning ? "Running..." : "Run Now"}
                  </Button>
                </div>

                {/* Discovery Results */}
                {discoveryResult && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Discovery Results</p>
                    <div className="grid grid-cols-4 gap-2 text-center text-sm">
                      <div>
                        <div className="text-lg font-semibold">{discoveryResult.vcsFound}</div>
                        <div className="text-xs text-muted-foreground">Found</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-green-600">{discoveryResult.vcsImported}</div>
                        <div className="text-xs text-muted-foreground">Imported</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-yellow-600">{discoveryResult.vcsFlagged}</div>
                        <div className="text-xs text-muted-foreground">Flagged</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-gray-500">{discoveryResult.vcsSkipped}</div>
                        <div className="text-xs text-muted-foreground">Skipped</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving ? (
                <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <IconCheck className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        </TabsContent>

        {/* Scoring Criteria Tab */}
        <TabsContent value="scoring" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <IconBriefcase className="h-5 w-5" />
                    High-Growth Companies
                  </CardTitle>
                  <CardDescription>
                    Companies that indicate valuable experience for founders
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => seedDefaults()}>
                  Seed Defaults
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add new company */}
              <div className="flex gap-2">
                <Input
                  value={newCompany.name}
                  onChange={(e) =>
                    setNewCompany({ ...newCompany, name: e.target.value })
                  }
                  placeholder="Company name"
                  className="flex-1"
                />
                <Input
                  value={newCompany.category}
                  onChange={(e) =>
                    setNewCompany({ ...newCompany, category: e.target.value })
                  }
                  placeholder="Category (optional)"
                  className="w-40"
                />
                <Button onClick={handleAddCompany}>
                  <IconPlus className="h-4 w-4" />
                </Button>
              </div>

              {/* Company list */}
              <div className="flex flex-wrap gap-2">
                {highGrowthCompanies?.map((company) => (
                  <Badge key={company._id} variant="secondary" className="gap-1">
                    {company.companyName}
                    {company.category && (
                      <span className="text-xs opacity-70">({company.category})</span>
                    )}
                    <button
                      onClick={() => removeHighGrowthCompany({ id: company._id })}
                      className="ml-1 hover:text-destructive"
                    >
                      <IconX className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {(!highGrowthCompanies || highGrowthCompanies.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    No companies added yet. Click &quot;Seed Defaults&quot; to add common high-growth companies.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconSchool className="h-5 w-5" />
                Top Universities
              </CardTitle>
              <CardDescription>
                Universities that indicate strong educational background
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add new university */}
              <div className="flex gap-2">
                <Input
                  value={newUniversity.name}
                  onChange={(e) =>
                    setNewUniversity({ ...newUniversity, name: e.target.value })
                  }
                  placeholder="University name"
                  className="flex-1"
                />
                <Select
                  value={newUniversity.tier}
                  onValueChange={(value) =>
                    setNewUniversity({ ...newUniversity, tier: value as "tier1" | "tier2" | "tier3" })
                  }
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tier1">Tier 1</SelectItem>
                    <SelectItem value="tier2">Tier 2</SelectItem>
                    <SelectItem value="tier3">Tier 3</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={newUniversity.country}
                  onChange={(e) =>
                    setNewUniversity({ ...newUniversity, country: e.target.value })
                  }
                  placeholder="Country"
                  className="w-28"
                />
                <Button onClick={handleAddUniversity}>
                  <IconPlus className="h-4 w-4" />
                </Button>
              </div>

              {/* University list by tier */}
              {["tier1", "tier2", "tier3"].map((tier) => {
                const tierUniversities = topUniversities?.filter((u) => u.tier === tier);
                if (!tierUniversities || tierUniversities.length === 0) return null;
                return (
                  <div key={tier} className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      {tier === "tier1" ? "Tier 1 (Top)" : tier === "tier2" ? "Tier 2" : "Tier 3"}
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {tierUniversities.map((university) => (
                        <Badge
                          key={university._id}
                          variant={tier === "tier1" ? "default" : "secondary"}
                          className="gap-1"
                        >
                          {university.universityName}
                          {university.country && (
                            <span className="text-xs opacity-70">({university.country})</span>
                          )}
                          <button
                            onClick={() => removeTopUniversity({ id: university._id })}
                            className="ml-1 hover:text-destructive"
                          >
                            <IconX className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
              {(!topUniversities || topUniversities.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  No universities added yet. Click &quot;Seed Defaults&quot; above to add common top universities.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconSettings className="h-5 w-5" />
                Scoring Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="autoScoreFounders"
                  checked={formData.autoScoreFounders}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, autoScoreFounders: checked as boolean })
                  }
                />
                <Label htmlFor="autoScoreFounders">
                  Automatically calculate founder scores when added
                </Label>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={saving}>
                  {saving ? (
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <IconCheck className="h-4 w-4 mr-2" />
                  )}
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Settings Tab */}
        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconMail className="h-5 w-5" />
                Email Configuration
              </CardTitle>
              <CardDescription>
                Configure your email provider for sending outreach
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emailProvider">Email Provider</Label>
                  <Select
                    value={formData.emailProvider}
                    onValueChange={(value) =>
                      setFormData({ ...formData, emailProvider: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resend">Resend</SelectItem>
                      <SelectItem value="sendgrid">SendGrid</SelectItem>
                      <SelectItem value="mailgun">Mailgun</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailApiKey">API Key</Label>
                  <Input
                    id="emailApiKey"
                    type="password"
                    value={formData.emailApiKey}
                    onChange={(e) =>
                      setFormData({ ...formData, emailApiKey: e.target.value })
                    }
                    placeholder="Enter your email API key"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emailFromName">From Name</Label>
                  <Input
                    id="emailFromName"
                    value={formData.emailFromName}
                    onChange={(e) =>
                      setFormData({ ...formData, emailFromName: e.target.value })
                    }
                    placeholder="Your Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailFromAddress">From Email</Label>
                  <Input
                    id="emailFromAddress"
                    type="email"
                    value={formData.emailFromAddress}
                    onChange={(e) =>
                      setFormData({ ...formData, emailFromAddress: e.target.value })
                    }
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={saving}>
                  {saving ? (
                    <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <IconCheck className="h-4 w-4 mr-2" />
                  )}
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
