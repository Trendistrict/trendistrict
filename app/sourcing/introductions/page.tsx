"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconPlus,
  IconUsers,
  IconArrowRight,
  IconBuilding,
  IconNetwork,
  IconX,
  IconCalendar,
  IconCheck,
  IconClock,
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

type IntroductionStatus = "considering" | "preparing" | "sent" | "accepted" | "meeting_scheduled" | "passed" | "invested";

const STATUS_CONFIG: Record<IntroductionStatus, { label: string; color: string; icon: React.ReactNode }> = {
  considering: { label: "Considering", color: "bg-slate-500", icon: <IconClock className="h-4 w-4" /> },
  preparing: { label: "Preparing", color: "bg-blue-500", icon: <IconClock className="h-4 w-4" /> },
  sent: { label: "Sent", color: "bg-purple-500", icon: <IconArrowRight className="h-4 w-4" /> },
  accepted: { label: "Accepted", color: "bg-green-500", icon: <IconCheck className="h-4 w-4" /> },
  meeting_scheduled: { label: "Meeting Scheduled", color: "bg-emerald-500", icon: <IconCalendar className="h-4 w-4" /> },
  passed: { label: "Passed", color: "bg-red-500", icon: <IconX className="h-4 w-4" /> },
  invested: { label: "Invested", color: "bg-amber-500", icon: <IconCheck className="h-4 w-4" /> },
};

export default function IntroductionsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);

  const introductions = useQuery(api.introductions.listWithDetails);
  const introStats = useQuery(api.introductions.getStats);
  const updateStatus = useMutation(api.introductions.updateStatus);
  const deleteIntro = useMutation(api.introductions.remove);

  const filteredIntroductions = introductions?.filter((intro) => {
    if (statusFilter !== "all" && intro.status !== statusFilter) return false;
    return true;
  });

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "Not set";
    return new Date(timestamp).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Introductions</h1>
          <p className="text-muted-foreground">
            Track your introductions between startups and VCs
          </p>
        </div>
        <AddIntroductionDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Introductions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{introStats?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(introStats?.considering ?? 0) + (introStats?.preparing ?? 0) + (introStats?.sent ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Meetings Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{introStats?.meeting_scheduled ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{introStats?.successRate ?? 0}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Label>Status:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${config.color}`} />
                  {config.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filteredIntroductions?.length ?? 0} introductions
        </span>
      </div>

      {/* Introductions List */}
      <div className="grid gap-4">
        {filteredIntroductions && filteredIntroductions.length > 0 ? (
          filteredIntroductions.map((intro) => (
            <Card key={intro._id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Introduction flow */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <IconBuilding className="h-5 w-5 text-muted-foreground" />
                        <span className="font-semibold">
                          {intro.startup?.companyName ?? "Unknown Startup"}
                        </span>
                      </div>
                      <IconArrowRight className="h-5 w-5 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        <IconNetwork className="h-5 w-5 text-muted-foreground" />
                        <span className="font-semibold">
                          {intro.vcConnection?.vcName ?? "Unknown VC"}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {intro.vcConnection?.firmName}
                        </Badge>
                      </div>
                    </div>

                    {/* Founder info */}
                    {intro.founder && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <IconUsers className="h-4 w-4" />
                        <span>
                          Founder: {intro.founder.firstName} {intro.founder.lastName}
                        </span>
                      </div>
                    )}

                    {/* Dates */}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Created: {formatDate(intro.createdAt)}</span>
                      {intro.introducedAt && (
                        <span>Introduced: {formatDate(intro.introducedAt)}</span>
                      )}
                      {intro.meetingDate && (
                        <span>Meeting: {formatDate(intro.meetingDate)}</span>
                      )}
                    </div>

                    {/* Notes and outcome */}
                    {intro.notes && (
                      <p className="text-sm text-muted-foreground">{intro.notes}</p>
                    )}
                    {intro.outcome && (
                      <div className="p-2 bg-muted rounded-md">
                        <p className="text-sm">
                          <span className="font-medium">Outcome: </span>
                          {intro.outcome}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Status and actions */}
                  <div className="flex flex-col items-end gap-2">
                    <Select
                      value={intro.status}
                      onValueChange={(value) =>
                        updateStatus({ id: intro._id, status: value as IntroductionStatus })
                      }
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${config.color}`} />
                              {config.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteIntro({ id: intro._id })}
                    >
                      <IconX className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <IconUsers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No introductions yet</h3>
              <p className="text-muted-foreground mb-4">
                Create introductions between startups and VCs in your network.
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <IconPlus className="h-4 w-4 mr-2" />
                Create Introduction
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface AddIntroductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AddIntroductionDialog({ open, onOpenChange }: AddIntroductionDialogProps) {
  const startups = useQuery(api.startups.list, {});
  const vcConnections = useQuery(api.vcConnections.list, {});
  const founders = useQuery(api.founders.list, {});
  const createIntro = useMutation(api.introductions.create);

  const [formData, setFormData] = useState({
    startupId: "" as string,
    vcConnectionId: "" as string,
    founderId: "" as string,
    notes: "",
  });

  const handleSubmit = async () => {
    if (!formData.startupId || !formData.vcConnectionId) {
      alert("Startup and VC are required");
      return;
    }

    await createIntro({
      startupId: formData.startupId as Id<"startups">,
      vcConnectionId: formData.vcConnectionId as Id<"vcConnections">,
      founderId: formData.founderId
        ? (formData.founderId as Id<"founders">)
        : undefined,
      notes: formData.notes || undefined,
    });

    setFormData({
      startupId: "",
      vcConnectionId: "",
      founderId: "",
      notes: "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <IconPlus className="h-4 w-4 mr-2" />
          Create Introduction
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Introduction</DialogTitle>
          <DialogDescription>
            Connect a startup with a VC in your network
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Startup *</Label>
            <Select
              value={formData.startupId}
              onValueChange={(value) =>
                setFormData({ ...formData, startupId: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select startup..." />
              </SelectTrigger>
              <SelectContent>
                {startups?.map((startup) => (
                  <SelectItem key={startup._id} value={startup._id}>
                    {startup.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>VC Connection *</Label>
            <Select
              value={formData.vcConnectionId}
              onValueChange={(value) =>
                setFormData({ ...formData, vcConnectionId: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select VC..." />
              </SelectTrigger>
              <SelectContent>
                {vcConnections?.map((vc) => (
                  <SelectItem key={vc._id} value={vc._id}>
                    {vc.vcName} ({vc.firmName})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Founder (optional)</Label>
            <Select
              value={formData.founderId}
              onValueChange={(value) =>
                setFormData({ ...formData, founderId: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select founder..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No specific founder</SelectItem>
                {founders?.map((founder) => (
                  <SelectItem key={founder._id} value={founder._id}>
                    {founder.firstName} {founder.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Any context for this introduction..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Create Introduction</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
