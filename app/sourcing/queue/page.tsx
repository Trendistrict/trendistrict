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
  IconMail,
  IconBrandLinkedin,
  IconClock,
  IconCheck,
  IconX,
  IconRefresh,
  IconPlayerPlay,
  IconTrash,
  IconAlertCircle,
  IconSend,
  IconLoader2,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type QueueStatus = "queued" | "sending" | "sent" | "failed";

const STATUS_CONFIG: Record<
  QueueStatus,
  { label: string; icon: React.ReactNode; color: string }
> = {
  queued: {
    label: "Queued",
    icon: <IconClock className="h-4 w-4" />,
    color: "bg-blue-500",
  },
  sending: {
    label: "Sending",
    icon: <IconLoader2 className="h-4 w-4 animate-spin" />,
    color: "bg-amber-500",
  },
  sent: {
    label: "Sent",
    icon: <IconCheck className="h-4 w-4" />,
    color: "bg-emerald-500",
  },
  failed: {
    label: "Failed",
    icon: <IconX className="h-4 w-4" />,
    color: "bg-red-500",
  },
};

export default function OutreachQueuePage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showBatchDialog, setShowBatchDialog] = useState(false);

  const queueList = useQuery(api.outreachQueue.list, {});
  const queueStats = useQuery(api.outreachQueue.getStats, {});
  const cancelOutreach = useMutation(api.outreachQueue.cancelOutreach);
  const retryOutreach = useMutation(api.outreachQueue.retryOutreach);
  const clearFailed = useMutation(api.outreachQueue.clearFailed);

  const filteredQueue = queueList?.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    return true;
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = timestamp - Date.now();
    if (diff < 0) return "Now";
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `in ${hours}h ${minutes % 60}m`;
    return `in ${minutes}m`;
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Email Queue</h1>
          <p className="text-muted-foreground">
            Manage automated email outreach to founders
          </p>
        </div>
        <div className="flex gap-2">
          {(queueStats?.failed ?? 0) > 0 && (
            <Button
              variant="outline"
              onClick={() => clearFailed()}
              className="text-destructive"
            >
              <IconTrash className="h-4 w-4 mr-2" />
              Clear Failed ({queueStats?.failed})
            </Button>
          )}
          <Button onClick={() => setShowBatchDialog(true)}>
            <IconPlayerPlay className="h-4 w-4 mr-2" />
            Queue Batch
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total in Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Queued
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats?.queued ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              Sending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats?.sending ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats?.sent ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats?.failed ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Info banner */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <IconAlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Queue Processing</p>
              <p className="text-muted-foreground">
                Emails are automatically sent every 30 minutes (one per user per
                run) to avoid spam filters. Messages are sent via Resend with
                automatic retry on failure.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Label>Status:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                <div className="flex items-center gap-2">
                  {config.icon}
                  {config.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filteredQueue?.length ?? 0} items
        </span>
      </div>

      {/* Queue List */}
      <div className="grid gap-4">
        {filteredQueue && filteredQueue.length > 0 ? (
          filteredQueue.map((item) => (
            <Card key={item._id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    {/* Type and recipient */}
                    <div className="flex items-center gap-3">
                      {item.type === "email" ? (
                        <IconMail className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <IconBrandLinkedin className="h-5 w-5 text-[#0077B5]" />
                      )}
                      <span className="font-semibold">
                        {item.founder
                          ? `${item.founder.firstName} ${item.founder.lastName}`
                          : "Unknown Founder"}
                      </span>
                      {item.founder?.email && (
                        <span className="text-sm text-muted-foreground">
                          ({item.founder.email})
                        </span>
                      )}
                      {item.startup && (
                        <Badge variant="secondary" className="text-xs">
                          {item.startup.companyName}
                        </Badge>
                      )}
                    </div>

                    {/* Subject and message preview */}
                    {item.subject && (
                      <p className="font-medium text-sm">{item.subject}</p>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.message}
                    </p>

                    {/* Timing and attempts */}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Created: {formatDate(item.createdAt)}</span>
                      <span>
                        Scheduled: {formatRelativeTime(item.scheduledFor)}
                      </span>
                      {item.attempts > 0 && (
                        <span>
                          Attempts: {item.attempts}/{item.maxAttempts}
                        </span>
                      )}
                    </div>

                    {/* Error message */}
                    {item.lastError && (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <IconAlertCircle className="h-4 w-4" />
                        {item.lastError}
                      </div>
                    )}
                  </div>

                  {/* Status and actions */}
                  <div className="flex flex-col items-end gap-2">
                    <Badge
                      variant="secondary"
                      className={`${STATUS_CONFIG[item.status as QueueStatus]?.color} text-white`}
                    >
                      <span className="flex items-center gap-1">
                        {STATUS_CONFIG[item.status as QueueStatus]?.icon}
                        {STATUS_CONFIG[item.status as QueueStatus]?.label}
                      </span>
                    </Badge>

                    <div className="flex gap-1">
                      {item.status === "failed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            retryOutreach({ queueId: item._id })
                          }
                        >
                          <IconRefresh className="h-4 w-4 mr-1" />
                          Retry
                        </Button>
                      )}
                      {item.status === "queued" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            cancelOutreach({ queueId: item._id })
                          }
                        >
                          <IconX className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <IconSend className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Queue is empty</h3>
              <p className="text-muted-foreground mb-4">
                Add founders to the outreach queue to automate your email
                campaigns.
              </p>
              <Button onClick={() => setShowBatchDialog(true)}>
                <IconPlayerPlay className="h-4 w-4 mr-2" />
                Queue Batch Outreach
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Batch Queue Dialog */}
      <BatchQueueDialog
        open={showBatchDialog}
        onOpenChange={setShowBatchDialog}
      />
    </div>
  );
}

interface BatchQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function BatchQueueDialog({ open, onOpenChange }: BatchQueueDialogProps) {
  const [selectedFounders, setSelectedFounders] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [delayMinutes, setDelayMinutes] = useState(30);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const founders = useQuery(api.founders.list, {});
  const templates = useQuery(api.settings.listTemplates, {});
  const queueBatch = useMutation(api.outreachQueue.queueBatchOutreach);

  // Filter founders with emails who aren't already queued
  const eligibleFounders = founders?.filter((f) => f.email);

  const handleSubmit = async () => {
    if (selectedFounders.length === 0 || !selectedTemplate) {
      return;
    }

    setIsSubmitting(true);
    try {
      await queueBatch({
        founderIds: selectedFounders as Id<"founders">[],
        templateId: selectedTemplate as Id<"templates">,
        delayBetweenMs: delayMinutes * 60 * 1000,
      });
      onOpenChange(false);
      setSelectedFounders([]);
      setSelectedTemplate("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFounder = (founderId: string) => {
    setSelectedFounders((prev) =>
      prev.includes(founderId)
        ? prev.filter((id) => id !== founderId)
        : [...prev, founderId]
    );
  };

  const selectAll = () => {
    if (eligibleFounders) {
      setSelectedFounders(eligibleFounders.map((f) => f._id));
    }
  };

  const selectNone = () => {
    setSelectedFounders([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Queue Batch Outreach</DialogTitle>
          <DialogDescription>
            Select founders and a template to queue automated outreach
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Email Template *</Label>
            <Select
              value={selectedTemplate}
              onValueChange={setSelectedTemplate}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a template..." />
              </SelectTrigger>
              <SelectContent>
                {templates
                  ?.filter((t) => t.type === "email")
                  .map((template) => (
                    <SelectItem key={template._id} value={template._id}>
                      {template.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Delay Setting */}
          <div className="space-y-2">
            <Label>Delay Between Emails (minutes)</Label>
            <Select
              value={delayMinutes.toString()}
              onValueChange={(v) => setDelayMinutes(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="240">4 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Founder Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Founders ({selectedFounders.length} selected)</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={selectNone}>
                  Clear
                </Button>
              </div>
            </div>
            <div className="border rounded-md max-h-64 overflow-y-auto">
              {eligibleFounders && eligibleFounders.length > 0 ? (
                eligibleFounders.map((founder) => (
                  <div
                    key={founder._id}
                    className={`flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 ${
                      selectedFounders.includes(founder._id) ? "bg-muted" : ""
                    }`}
                    onClick={() => toggleFounder(founder._id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFounders.includes(founder._id)}
                      onChange={() => toggleFounder(founder._id)}
                      className="h-4 w-4"
                    />
                    <div className="flex-1">
                      <p className="font-medium">
                        {founder.firstName} {founder.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {founder.email}
                      </p>
                    </div>
                    {founder.overallScore && (
                      <Badge variant="secondary">
                        Score: {founder.overallScore}
                      </Badge>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  No founders with email addresses found
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          {selectedFounders.length > 0 && selectedTemplate && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <p className="text-sm">
                  <strong>Summary:</strong> {selectedFounders.length} emails will
                  be queued with {delayMinutes} minute delays between each.
                  <br />
                  <span className="text-muted-foreground">
                    First email sends immediately, last email in{" "}
                    {Math.round(
                      ((selectedFounders.length - 1) * delayMinutes) / 60
                    )}{" "}
                    hours.
                  </span>
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              selectedFounders.length === 0 || !selectedTemplate || isSubmitting
            }
          >
            {isSubmitting ? (
              <>
                <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                Queueing...
              </>
            ) : (
              <>
                <IconSend className="h-4 w-4 mr-2" />
                Queue {selectedFounders.length} Emails
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
