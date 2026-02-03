"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
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
} from "@tabler/icons-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
  const settings = useQuery(api.settings.get);
  const highGrowthCompanies = useQuery(api.settings.listHighGrowthCompanies);
  const topUniversities = useQuery(api.settings.listTopUniversities);

  const upsertSettings = useMutation(api.settings.upsert);
  const addHighGrowthCompany = useMutation(api.settings.addHighGrowthCompany);
  const removeHighGrowthCompany = useMutation(api.settings.removeHighGrowthCompany);
  const addTopUniversity = useMutation(api.settings.addTopUniversity);
  const removeTopUniversity = useMutation(api.settings.removeTopUniversity);
  const seedDefaults = useMutation(api.settings.seedDefaults);

  const [formData, setFormData] = useState({
    companiesHouseApiKey: "",
    exaApiKey: "",
    emailApiKey: "",
    emailProvider: "resend",
    emailFromAddress: "",
    emailFromName: "",
    linkedInProfileUrl: "",
    autoScoreFounders: true,
  });

  const [newCompany, setNewCompany] = useState({ name: "", category: "" });
  const [newUniversity, setNewUniversity] = useState({ name: "", tier: "tier2" as "tier1" | "tier2" | "tier3", country: "" });
  const [saving, setSaving] = useState(false);

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
      });
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
              {formData.companiesHouseApiKey && (
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
