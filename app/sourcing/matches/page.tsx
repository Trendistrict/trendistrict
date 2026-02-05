"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconSparkles,
  IconBuilding,
  IconBrandLinkedin,
  IconMail,
  IconExternalLink,
  IconUsers,
  IconChevronDown,
  IconChevronUp,
  IconTag,
  IconCoin,
  IconCheck,
  IconLoader2,
} from "@tabler/icons-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";

export default function VCMatchesPage() {
  const [expandedStartups, setExpandedStartups] = useState<Set<string>>(
    new Set()
  );
  const [minScore, setMinScore] = useState<number>(0);

  const matches = useQuery(api.vcConnections.getVCMatchesForQualifiedStartups);
  const createIntro = useMutation(api.introductions.create);

  const [creatingIntro, setCreatingIntro] = useState<string | null>(null);

  const handleCreateIntro = async (
    startupId: Id<"startups">,
    vcId: Id<"vcConnections">,
    founderId?: Id<"founders">
  ) => {
    const key = `${startupId}-${vcId}`;
    setCreatingIntro(key);
    try {
      await createIntro({
        startupId,
        vcConnectionId: vcId,
        founderId,
        status: "considering",
      });
    } finally {
      setCreatingIntro(null);
    }
  };

  const toggleExpanded = (startupId: string) => {
    setExpandedStartups((prev) => {
      const next = new Set(prev);
      if (next.has(startupId)) {
        next.delete(startupId);
      } else {
        next.add(startupId);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (matches) {
      setExpandedStartups(new Set(matches.map((m) => m.startup._id)));
    }
  };

  const collapseAll = () => {
    setExpandedStartups(new Set());
  };

  const filteredMatches = matches?.filter((m) =>
    m.topVCs.some((vc) => vc.score >= minScore)
  );

  const totalMatches =
    filteredMatches?.reduce((sum, m) => sum + m.topVCs.length, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">VC Matches</h1>
          <p className="text-muted-foreground">
            AI-powered matching between qualified startups and VCs in your
            network
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={expandAll}>
            <IconChevronDown className="h-4 w-4 mr-2" />
            Expand All
          </Button>
          <Button variant="outline" onClick={collapseAll}>
            <IconChevronUp className="h-4 w-4 mr-2" />
            Collapse All
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Qualified Startups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredMatches?.length ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Ready for VC introductions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Potential Matches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMatches}</div>
            <p className="text-xs text-muted-foreground">
              Based on stage, sector & relationship
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Match Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalMatches > 0
                ? Math.round(
                    (filteredMatches?.reduce(
                      (sum, m) =>
                        sum + m.topVCs.reduce((s, v) => s + v.score, 0),
                      0
                    ) ?? 0) / totalMatches
                  )
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">Out of 100</p>
          </CardContent>
        </Card>
      </div>

      {/* Scoring Explanation */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <IconSparkles className="h-5 w-5 text-amber-500 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">How Matching Works</p>
              <p className="text-muted-foreground">
                VCs are scored based on: <strong>Stage match</strong> (40 pts) -
                VC invests at startup&apos;s funding stage |{" "}
                <strong>Sector match</strong> (20 pts) - Overlapping investment
                focus | <strong>Relationship</strong> (5-25 pts) - Your
                connection strength | <strong>Recent contact</strong> (10 pts) -
                Contacted within 30 days
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Label>Min Match Score:</Label>
        <Select
          value={minScore.toString()}
          onValueChange={(v) => setMinScore(parseInt(v))}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">All matches</SelectItem>
            <SelectItem value="30">30+ (Fair)</SelectItem>
            <SelectItem value="50">50+ (Good)</SelectItem>
            <SelectItem value="70">70+ (Great)</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filteredMatches?.length ?? 0} startups with matches
        </span>
      </div>

      {/* Matches List */}
      <div className="grid gap-4">
        {filteredMatches && filteredMatches.length > 0 ? (
          filteredMatches.map(({ startup, topVCs }) => {
            const isExpanded = expandedStartups.has(startup._id);
            const filteredVCs = topVCs.filter((vc) => vc.score >= minScore);

            return (
              <Card key={startup._id}>
                <Collapsible
                  open={isExpanded}
                  onOpenChange={() => toggleExpanded(startup._id)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <IconBuilding className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <CardTitle className="text-lg">
                              {startup.companyName}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2">
                              {startup.fundingStage && (
                                <Badge variant="outline">
                                  {startup.fundingStage}
                                </Badge>
                              )}
                              <span>
                                {filteredVCs.length} matching{" "}
                                {filteredVCs.length === 1 ? "VC" : "VCs"}
                              </span>
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="bg-amber-500/10 text-amber-500"
                          >
                            <IconSparkles className="h-3 w-3 mr-1" />
                            Top: {filteredVCs[0]?.score ?? 0}
                          </Badge>
                          {isExpanded ? (
                            <IconChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <IconChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="grid gap-3">
                        {filteredVCs.map(({ vc, score, reasons }) => {
                          const introKey = `${startup._id}-${vc._id}`;
                          const isCreating = creatingIntro === introKey;

                          return (
                            <div
                              key={vc._id}
                              className="flex items-center justify-between p-4 border rounded-lg"
                            >
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-3">
                                  <h4 className="font-semibold">{vc.vcName}</h4>
                                  <Badge variant="secondary" className="text-xs">
                                    <IconBuilding className="h-3 w-3 mr-1" />
                                    {vc.firmName}
                                  </Badge>
                                </div>

                                {/* Match reasons */}
                                <div className="flex flex-wrap gap-1">
                                  {reasons.map((reason, i) => (
                                    <Badge
                                      key={i}
                                      variant="outline"
                                      className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                    >
                                      <IconCheck className="h-3 w-3 mr-1" />
                                      {reason}
                                    </Badge>
                                  ))}
                                </div>

                                {/* VC details */}
                                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                                  {vc.checkSize && (
                                    <span className="flex items-center gap-1">
                                      <IconCoin className="h-4 w-4" />
                                      {vc.checkSize}
                                    </span>
                                  )}
                                  {vc.investmentStages &&
                                    vc.investmentStages.length > 0 && (
                                      <span className="flex items-center gap-1">
                                        <IconTag className="h-4 w-4" />
                                        {vc.investmentStages.join(", ")}
                                      </span>
                                    )}
                                  {vc.email && (
                                    <a
                                      href={`mailto:${vc.email}`}
                                      className="flex items-center gap-1 hover:text-primary"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <IconMail className="h-4 w-4" />
                                      {vc.email}
                                    </a>
                                  )}
                                  {vc.linkedInUrl && (
                                    <a
                                      href={vc.linkedInUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 hover:text-primary"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <IconBrandLinkedin className="h-4 w-4" />
                                      LinkedIn
                                      <IconExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                              </div>

                              {/* Score and action */}
                              <div className="flex items-center gap-4 ml-4">
                                <div className="text-center">
                                  <div
                                    className={`text-2xl font-bold ${
                                      score >= 70
                                        ? "text-emerald-500"
                                        : score >= 50
                                        ? "text-amber-500"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {score}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Match
                                  </p>
                                </div>
                                <Button
                                  onClick={() =>
                                    handleCreateIntro(startup._id, vc._id)
                                  }
                                  disabled={isCreating}
                                >
                                  {isCreating ? (
                                    <>
                                      <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Creating...
                                    </>
                                  ) : (
                                    <>
                                      <IconUsers className="h-4 w-4 mr-2" />
                                      Create Intro
                                    </>
                                  )}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <IconSparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No matches found</h3>
              <p className="text-muted-foreground mb-4">
                {matches?.length === 0
                  ? "Move startups to 'Qualified' stage to see VC matches, or add VCs to your network."
                  : "No VCs match your filter criteria. Try lowering the minimum score."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
