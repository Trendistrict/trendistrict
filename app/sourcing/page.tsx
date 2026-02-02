"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  IconBuildingSkyscraper,
  IconUserSearch,
  IconMail,
  IconNetwork,
  IconTrendingUp,
  IconEye,
  IconRocket,
  IconSparkles,
} from "@tabler/icons-react";
import Link from "next/link";
import { useEffect } from "react";

export default function DashboardPage() {
  const pipelineStats = useQuery(api.startups.getPipelineStats);
  const outreachStats = useQuery(api.outreach.getStats);
  const introStats = useQuery(api.introductions.getStats);
  const topFounders = useQuery(api.founders.getTopFounders, { limit: 5 });
  const seedDefaults = useMutation(api.settings.seedDefaults);

  // Seed default data on first load
  useEffect(() => {
    seedDefaults();
  }, [seedDefaults]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">VC Sourcing Dashboard</h1>
        <p className="text-muted-foreground">
          Source UK startups, evaluate founders, and connect with VCs
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Startups</CardTitle>
            <IconBuildingSkyscraper className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pipelineStats?.total ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {pipelineStats?.stealthCount ?? 0} in stealth mode
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Founders</CardTitle>
            <IconUserSearch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{topFounders?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Avg score: {pipelineStats?.averageScore ?? 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outreach Sent</CardTitle>
            <IconMail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{outreachStats?.sent ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {outreachStats?.responseRate ?? 0}% response rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Introductions</CardTitle>
            <IconNetwork className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{introStats?.total ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {introStats?.successRate ?? 0}% success rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconTrendingUp className="h-5 w-5" />
              Pipeline Overview
            </CardTitle>
            <CardDescription>Track startups through your sourcing funnel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <PipelineStage
                label="Discovered"
                count={pipelineStats?.discovered ?? 0}
                color="bg-slate-500"
              />
              <PipelineStage
                label="Researching"
                count={pipelineStats?.researching ?? 0}
                color="bg-blue-500"
              />
              <PipelineStage
                label="Qualified"
                count={pipelineStats?.qualified ?? 0}
                color="bg-amber-500"
              />
              <PipelineStage
                label="Contacted"
                count={pipelineStats?.contacted ?? 0}
                color="bg-purple-500"
              />
              <PipelineStage
                label="Meeting"
                count={pipelineStats?.meeting ?? 0}
                color="bg-green-500"
              />
              <PipelineStage
                label="Introduced"
                count={pipelineStats?.introduced ?? 0}
                color="bg-emerald-500"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconSparkles className="h-5 w-5" />
              Top Scoring Founders
            </CardTitle>
            <CardDescription>Founders with the best backgrounds</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topFounders && topFounders.length > 0 ? (
                topFounders.map((founder) => (
                  <div key={founder._id} className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {founder.firstName} {founder.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {founder.headline || founder.role || "Founder"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold">{founder.overallScore}%</div>
                      <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${founder.overallScore}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No founders scored yet. Add founders and calculate their scores.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconRocket className="h-5 w-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>Common tasks to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href="/sourcing/startups">
              <Button variant="outline" className="w-full justify-start gap-2">
                <IconBuildingSkyscraper className="h-4 w-4" />
                Search Companies House
              </Button>
            </Link>
            <Link href="/sourcing/founders">
              <Button variant="outline" className="w-full justify-start gap-2">
                <IconUserSearch className="h-4 w-4" />
                Add Founder
              </Button>
            </Link>
            <Link href="/sourcing/outreach">
              <Button variant="outline" className="w-full justify-start gap-2">
                <IconMail className="h-4 w-4" />
                Create Outreach
              </Button>
            </Link>
            <Link href="/sourcing/vcs">
              <Button variant="outline" className="w-full justify-start gap-2">
                <IconNetwork className="h-4 w-4" />
                Add VC Connection
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Signals Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconEye className="h-5 w-5" />
              Stealth Startups
            </CardTitle>
            <CardDescription>
              Companies operating in stealth mode - early opportunity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pipelineStats?.stealthCount ?? 0}</div>
            <p className="text-sm text-muted-foreground mt-2">
              Stealth companies often represent the best early-stage opportunities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconRocket className="h-5 w-5" />
              Recently Announced
            </CardTitle>
            <CardDescription>
              Startups that recently came out of stealth
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pipelineStats?.recentlyAnnouncedCount ?? 0}</div>
            <p className="text-sm text-muted-foreground mt-2">
              Perfect timing for outreach as they build momentum
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PipelineStage({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="flex-1 text-sm">{label}</span>
      <span className="font-semibold">{count}</span>
    </div>
  );
}
