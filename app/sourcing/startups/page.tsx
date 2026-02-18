"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconSearch,
  IconPlus,
  IconBuilding,
  IconCalendar,
  IconMapPin,
  IconTag,
  IconLoader2,
  IconRefresh,
  IconEye,
  IconRocket,
  IconX,
  IconWorld,
  IconCode,
  IconUsers,
  IconCurrencyDollar,
  IconNews,
  IconChevronDown,
  IconChevronUp,
  IconTrendingUp,
  IconTarget,
  IconExternalLink,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

type StartupStage = "discovered" | "researching" | "qualified" | "contacted" | "meeting" | "introduced" | "passed";

const STAGES: { value: StartupStage; label: string; color: string }[] = [
  { value: "discovered", label: "Discovered", color: "bg-slate-500" },
  { value: "researching", label: "Researching", color: "bg-blue-500" },
  { value: "qualified", label: "Qualified", color: "bg-amber-500" },
  { value: "contacted", label: "Contacted", color: "bg-purple-500" },
  { value: "meeting", label: "Meeting", color: "bg-green-500" },
  { value: "introduced", label: "Introduced", color: "bg-emerald-500" },
  { value: "passed", label: "Passed", color: "bg-red-500" },
];

export default function StartupsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CompanyResult[]>([]);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const settings = useQuery(api.settings.get);
  const startups = useQuery(api.startups.list, {
    stage: stageFilter === "all" ? undefined : stageFilter,
  });

  const searchCompanies = useAction(api.companiesHouse.searchCompanies);
  const createStartup = useMutation(api.startups.create);
  const updateStartup = useMutation(api.startups.update);
  const deleteStartup = useMutation(api.startups.remove);

  interface CompanyResult {
    companyNumber: string;
    companyName: string;
    companyStatus: string;
    companyType: string;
    incorporationDate: string;
    registeredAddress: string;
    sicCodes?: string[];
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    if (!settings?.companiesHouseApiKey) {
      alert("Please configure your Companies House API key in Settings first.");
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchCompanies({
        query: searchQuery,
        apiKey: settings.companiesHouseApiKey,
        itemsPerPage: 20,
      });
      setSearchResults(results.items);
      setShowSearchDialog(true);
    } catch (error) {
      console.error("Search failed:", error);
      alert("Search failed. Please check your API key.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFromSearch = async (company: CompanyResult) => {
    try {
      await createStartup({
        companyNumber: company.companyNumber,
        companyName: company.companyName,
        incorporationDate: company.incorporationDate,
        companyStatus: company.companyStatus,
        companyType: company.companyType,
        registeredAddress: company.registeredAddress,
        sicCodes: company.sicCodes,
        source: "companies_house",
      });
      setShowSearchDialog(false);
      setSearchResults([]);
      setSearchQuery("");
    } catch (error) {
      console.error("Failed to add startup:", error);
      alert("Failed to add startup");
    }
  };

  const handleStageChange = async (id: Id<"startups">, stage: StartupStage) => {
    await updateStartup({ id, stage });
  };

  const handleToggleStealth = async (id: Id<"startups">, isStealthMode: boolean) => {
    await updateStartup({ id, isStealthMode: !isStealthMode });
  };

  const getStageColor = (stage: string) => {
    return STAGES.find((s) => s.value === stage)?.color ?? "bg-slate-500";
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Startups</h1>
          <p className="text-muted-foreground">
            Search Companies House and manage your startup pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <ManualAddDialog
            open={showAddDialog}
            onOpenChange={setShowAddDialog}
            onAdd={createStartup}
          />
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconSearch className="h-5 w-5" />
            Search Companies House
          </CardTitle>
          <CardDescription>
            Find UK companies by name or registration number
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by company name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <IconLoader2 className="h-4 w-4 animate-spin" />
              ) : (
                <IconSearch className="h-4 w-4" />
              )}
              <span className="ml-2">Search</span>
            </Button>
          </div>
          {!settings?.companiesHouseApiKey && (
            <p className="text-sm text-amber-600 mt-2">
              Configure your Companies House API key in Settings to enable search.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Label>Filter by stage:</Label>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGES.map((stage) => (
              <SelectItem key={stage.value} value={stage.value}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                  {stage.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {startups?.length ?? 0} startups
        </span>
      </div>

      {/* Startups List */}
      <div className="grid gap-4">
        {startups && startups.length > 0 ? (
          startups.map((startup) => {
            const isExpanded = expandedCards.has(startup._id);
            const hasEnrichment = !!(startup.website || startup.description || startup.techStack?.length || startup.businessModel || startup.fundingStage || startup.newsArticles?.length || startup.fundingDetails?.length || startup.teamSize);

            return (
            <Card key={startup._id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-lg">{startup.companyName}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {startup.companyNumber}
                      </Badge>
                      {startup.isStealthMode && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <IconEye className="h-3 w-3" />
                          Stealth
                        </Badge>
                      )}
                      {startup.recentlyAnnounced && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <IconRocket className="h-3 w-3" />
                          Recently Announced
                        </Badge>
                      )}
                      {startup.fundingStage && (
                        <Badge className="text-xs gap-1 bg-violet-600">
                          <IconCurrencyDollar className="h-3 w-3" />
                          {startup.fundingStage}
                        </Badge>
                      )}
                      {startup.businessModel && (
                        <Badge variant="outline" className="text-xs">
                          {startup.businessModel}
                        </Badge>
                      )}
                      {startup.teamSize && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <IconUsers className="h-3 w-3" />
                          {startup.teamSize}
                        </Badge>
                      )}
                    </div>

                    {/* Description */}
                    {startup.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {startup.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {startup.website && (
                        <a
                          href={startup.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <IconWorld className="h-4 w-4" />
                          Website
                          <IconExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <span className="flex items-center gap-1">
                        <IconCalendar className="h-4 w-4" />
                        Inc. {startup.incorporationDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <IconBuilding className="h-4 w-4" />
                        {startup.companyType}
                      </span>
                      {startup.registeredAddress && (
                        <span className="flex items-center gap-1">
                          <IconMapPin className="h-4 w-4" />
                          {startup.registeredAddress.substring(0, 50)}...
                        </span>
                      )}
                    </div>

                    {/* Scores row */}
                    {(startup.teamScore !== undefined || startup.tractionScore !== undefined) && (
                      <div className="flex gap-4">
                        {startup.teamScore !== undefined && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <IconUsers className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Team:</span>
                            <span className={`font-semibold ${startup.teamScore >= 70 ? "text-emerald-500" : startup.teamScore >= 40 ? "text-amber-500" : "text-red-500"}`}>
                              {startup.teamScore}%
                            </span>
                          </div>
                        )}
                        {startup.tractionScore !== undefined && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Traction:</span>
                            <span className={`font-semibold ${startup.tractionScore >= 70 ? "text-emerald-500" : startup.tractionScore >= 40 ? "text-amber-500" : "text-red-500"}`}>
                              {startup.tractionScore}%
                            </span>
                          </div>
                        )}
                        {startup.overallScore !== undefined && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <IconTarget className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Overall:</span>
                            <span className={`font-semibold ${startup.overallScore >= 70 ? "text-emerald-500" : startup.overallScore >= 40 ? "text-amber-500" : "text-red-500"}`}>
                              {startup.overallScore}%
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tech stack */}
                    {startup.techStack && startup.techStack.length > 0 && (
                      <div className="flex items-center gap-2">
                        <IconCode className="h-4 w-4 text-muted-foreground" />
                        <div className="flex gap-1 flex-wrap">
                          {startup.techStack.map((tech) => (
                            <Badge key={tech} variant="secondary" className="text-xs">
                              {tech}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {startup.sicCodes && startup.sicCodes.length > 0 && (
                      <div className="flex items-center gap-2">
                        <IconTag className="h-4 w-4 text-muted-foreground" />
                        <div className="flex gap-1 flex-wrap">
                          {startup.sicCodes.slice(0, 3).map((sic) => (
                            <Badge key={sic} variant="secondary" className="text-xs">
                              {sic}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Expandable details */}
                    {hasEnrichment && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground px-0 hover:bg-transparent"
                        onClick={() => toggleExpanded(startup._id)}
                      >
                        {isExpanded ? (
                          <IconChevronUp className="h-4 w-4 mr-1" />
                        ) : (
                          <IconChevronDown className="h-4 w-4 mr-1" />
                        )}
                        {isExpanded ? "Less" : "More details"}
                      </Button>
                    )}

                    {isExpanded && (
                      <div className="space-y-3 pt-2 border-t">
                        {/* Product description */}
                        {startup.productDescription && (
                          <div>
                            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-1">Product</h4>
                            <p className="text-sm">{startup.productDescription}</p>
                          </div>
                        )}

                        {/* Crunchbase data */}
                        {startup.crunchbaseData && (
                          <div>
                            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-1">Crunchbase</h4>
                            <div className="flex flex-wrap gap-3 text-sm">
                              {startup.crunchbaseData.totalFunding && (
                                <span>Total Funding: <strong>{startup.crunchbaseData.totalFunding}</strong></span>
                              )}
                              {startup.crunchbaseData.lastRound && (
                                <span>Last Round: <strong>{startup.crunchbaseData.lastRound}</strong></span>
                              )}
                              {startup.crunchbaseData.employeeCount && (
                                <span>Employees: <strong>{startup.crunchbaseData.employeeCount}</strong></span>
                              )}
                            </div>
                            {startup.crunchbaseData.investors && startup.crunchbaseData.investors.length > 0 && (
                              <div className="flex gap-1 flex-wrap mt-1">
                                {startup.crunchbaseData.investors.map((inv: string) => (
                                  <Badge key={inv} variant="outline" className="text-xs">{inv}</Badge>
                                ))}
                              </div>
                            )}
                            {startup.crunchbaseUrl && (
                              <a
                                href={startup.crunchbaseUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                              >
                                View on Crunchbase <IconExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Funding details */}
                        {startup.fundingDetails && startup.fundingDetails.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-1">Funding Rounds</h4>
                            <div className="space-y-1">
                              {startup.fundingDetails.map((round: { round?: string; amount?: string; date?: string; investors?: string[] }, idx: number) => (
                                <div key={idx} className="text-sm flex gap-3">
                                  {round.round && <Badge variant="secondary" className="text-xs">{round.round}</Badge>}
                                  {round.amount && <span className="font-medium">{round.amount}</span>}
                                  {round.date && <span className="text-muted-foreground">{round.date}</span>}
                                  {round.investors && round.investors.length > 0 && (
                                    <span className="text-muted-foreground">by {round.investors.join(", ")}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* News articles */}
                        {startup.newsArticles && startup.newsArticles.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-1 flex items-center gap-1">
                              <IconNews className="h-3 w-3" />
                              News ({startup.newsArticles.length})
                            </h4>
                            <div className="space-y-1">
                              {startup.newsArticles.slice(0, 5).map((article: { title: string; url?: string; source?: string; date?: string }, idx: number) => (
                                <div key={idx} className="text-sm">
                                  {article.url ? (
                                    <a
                                      href={article.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline"
                                    >
                                      {article.title}
                                    </a>
                                  ) : (
                                    <span>{article.title}</span>
                                  )}
                                  {(article.source || article.date) && (
                                    <span className="text-muted-foreground text-xs ml-2">
                                      {[article.source, article.date].filter(Boolean).join(" - ")}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {startup.enrichedAt && (
                          <p className="text-xs text-muted-foreground">
                            Enriched: {new Date(startup.enrichedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Select
                      value={startup.stage}
                      onValueChange={(value) =>
                        handleStageChange(startup._id, value as StartupStage)
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map((stage) => (
                          <SelectItem key={stage.value} value={stage.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                              {stage.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={startup.isStealthMode ?? false}
                        onCheckedChange={() =>
                          handleToggleStealth(startup._id, startup.isStealthMode ?? false)
                        }
                      />
                      <Label className="text-sm">Stealth</Label>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteStartup({ id: startup._id })}
                    >
                      <IconX className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <IconBuilding className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No startups yet</h3>
              <p className="text-muted-foreground mb-4">
                Search Companies House or add a startup manually to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Search Results Dialog */}
      <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Search Results</DialogTitle>
            <DialogDescription>
              Found {searchResults.length} companies matching &quot;{searchQuery}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {searchResults.map((company) => (
              <Card key={company.companyNumber}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-semibold">{company.companyName}</h4>
                      <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                        <span>{company.companyNumber}</span>
                        <span>{company.companyStatus}</span>
                        <span>Inc. {company.incorporationDate}</span>
                      </div>
                      {company.registeredAddress && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {company.registeredAddress}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddFromSearch(company)}
                    >
                      <IconPlus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ManualAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: {
    companyNumber: string;
    companyName: string;
    incorporationDate: string;
    companyStatus: string;
    companyType: string;
    source: string;
    isStealthMode?: boolean;
  }) => Promise<Id<"startups">>;
}

function ManualAddDialog({ open, onOpenChange, onAdd }: ManualAddDialogProps) {
  const [formData, setFormData] = useState({
    companyName: "",
    companyNumber: "",
    incorporationDate: "",
    companyType: "private-limited-company",
    isStealthMode: false,
  });

  const handleSubmit = async () => {
    if (!formData.companyName || !formData.companyNumber) {
      alert("Company name and number are required");
      return;
    }

    await onAdd({
      ...formData,
      companyStatus: "active",
      source: "manual",
    });

    setFormData({
      companyName: "",
      companyNumber: "",
      incorporationDate: "",
      companyType: "private-limited-company",
      isStealthMode: false,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <IconPlus className="h-4 w-4 mr-2" />
          Add Manually
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Startup Manually</DialogTitle>
          <DialogDescription>
            Enter startup details to add to your pipeline
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name *</Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) =>
                setFormData({ ...formData, companyName: e.target.value })
              }
              placeholder="e.g., Acme Ltd"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyNumber">Company Number *</Label>
            <Input
              id="companyNumber"
              value={formData.companyNumber}
              onChange={(e) =>
                setFormData({ ...formData, companyNumber: e.target.value })
              }
              placeholder="e.g., 12345678"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="incorporationDate">Incorporation Date</Label>
            <Input
              id="incorporationDate"
              type="date"
              value={formData.incorporationDate}
              onChange={(e) =>
                setFormData({ ...formData, incorporationDate: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyType">Company Type</Label>
            <Select
              value={formData.companyType}
              onValueChange={(value) =>
                setFormData({ ...formData, companyType: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private-limited-company">
                  Private Limited Company
                </SelectItem>
                <SelectItem value="ltd">LTD</SelectItem>
                <SelectItem value="llp">LLP</SelectItem>
                <SelectItem value="plc">PLC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isStealthMode"
              checked={formData.isStealthMode}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, isStealthMode: checked as boolean })
              }
            />
            <Label htmlFor="isStealthMode">Stealth Mode</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Add Startup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
