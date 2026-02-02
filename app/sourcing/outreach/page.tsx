"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  IconMail,
  IconBrandLinkedin,
  IconSend,
  IconMailOpened,
  IconMessage,
  IconX,
  IconClock,
  IconCheck,
  IconAlertCircle,
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

type OutreachStatus = "draft" | "scheduled" | "sent" | "delivered" | "opened" | "replied" | "bounced" | "failed";
type OutreachType = "email" | "linkedin";

const STATUS_CONFIG: Record<OutreachStatus, { label: string; icon: React.ReactNode; color: string }> = {
  draft: { label: "Draft", icon: <IconMail className="h-4 w-4" />, color: "bg-slate-500" },
  scheduled: { label: "Scheduled", icon: <IconClock className="h-4 w-4" />, color: "bg-blue-500" },
  sent: { label: "Sent", icon: <IconSend className="h-4 w-4" />, color: "bg-purple-500" },
  delivered: { label: "Delivered", icon: <IconCheck className="h-4 w-4" />, color: "bg-indigo-500" },
  opened: { label: "Opened", icon: <IconMailOpened className="h-4 w-4" />, color: "bg-amber-500" },
  replied: { label: "Replied", icon: <IconMessage className="h-4 w-4" />, color: "bg-emerald-500" },
  bounced: { label: "Bounced", icon: <IconAlertCircle className="h-4 w-4" />, color: "bg-red-500" },
  failed: { label: "Failed", icon: <IconX className="h-4 w-4" />, color: "bg-red-600" },
};

export default function OutreachPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);

  const outreachList = useQuery(api.outreach.listWithDetails);
  const outreachStats = useQuery(api.outreach.getStats);
  const updateStatus = useMutation(api.outreach.updateStatus);
  const deleteOutreach = useMutation(api.outreach.remove);

  const filteredOutreach = outreachList?.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (typeFilter !== "all" && o.type !== typeFilter) return false;
    return true;
  });

  const handleStatusChange = async (id: Id<"outreach">, status: OutreachStatus) => {
    await updateStatus({ id, status });
  };

  const formatDate = (timestamp: number) => {
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
          <h1 className="text-2xl font-semibold">Outreach</h1>
          <p className="text-muted-foreground">
            Track your email and LinkedIn outreach to founders
          </p>
        </div>
        <AddOutreachDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Outreach</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{outreachStats?.total ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {outreachStats?.emailCount ?? 0} emails, {outreachStats?.linkedInCount ?? 0} LinkedIn
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{outreachStats?.sent ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{outreachStats?.openRate ?? 0}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{outreachStats?.responseRate ?? 0}%</div>
          </CardContent>
        </Card>
      </div>

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

        <Label>Type:</Label>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="email">
              <div className="flex items-center gap-2">
                <IconMail className="h-4 w-4" />
                Email
              </div>
            </SelectItem>
            <SelectItem value="linkedin">
              <div className="flex items-center gap-2">
                <IconBrandLinkedin className="h-4 w-4" />
                LinkedIn
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground">
          {filteredOutreach?.length ?? 0} messages
        </span>
      </div>

      {/* Outreach List */}
      <div className="grid gap-4">
        {filteredOutreach && filteredOutreach.length > 0 ? (
          filteredOutreach.map((outreach) => (
            <Card key={outreach._id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    {/* Type and recipient */}
                    <div className="flex items-center gap-3">
                      {outreach.type === "email" ? (
                        <IconMail className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <IconBrandLinkedin className="h-5 w-5 text-[#0077B5]" />
                      )}
                      <span className="font-semibold">
                        {outreach.founder
                          ? `${outreach.founder.firstName} ${outreach.founder.lastName}`
                          : "Unknown Founder"}
                      </span>
                      {outreach.startup && (
                        <Badge variant="secondary" className="text-xs">
                          {outreach.startup.companyName}
                        </Badge>
                      )}
                    </div>

                    {/* Subject and message preview */}
                    {outreach.subject && (
                      <p className="font-medium text-sm">{outreach.subject}</p>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {outreach.message}
                    </p>

                    {/* Timestamps */}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Created: {formatDate(outreach.createdAt)}</span>
                      {outreach.sentAt && <span>Sent: {formatDate(outreach.sentAt)}</span>}
                      {outreach.openedAt && <span>Opened: {formatDate(outreach.openedAt)}</span>}
                      {outreach.repliedAt && <span>Replied: {formatDate(outreach.repliedAt)}</span>}
                    </div>

                    {/* Response */}
                    {outreach.response && (
                      <div className="mt-2 p-2 bg-muted rounded-md">
                        <p className="text-sm">
                          <span className="font-medium">Response: </span>
                          {outreach.response}
                        </p>
                        {outreach.sentiment && (
                          <Badge
                            variant={
                              outreach.sentiment === "positive"
                                ? "default"
                                : outreach.sentiment === "neutral"
                                ? "secondary"
                                : "destructive"
                            }
                            className="mt-1"
                          >
                            {outreach.sentiment}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status and actions */}
                  <div className="flex flex-col items-end gap-2">
                    <Select
                      value={outreach.status}
                      onValueChange={(value) =>
                        handleStatusChange(outreach._id, value as OutreachStatus)
                      }
                    >
                      <SelectTrigger className="w-36">
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
                      onClick={() => deleteOutreach({ id: outreach._id })}
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
              <IconMail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No outreach yet</h3>
              <p className="text-muted-foreground mb-4">
                Start reaching out to founders via email or LinkedIn.
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <IconPlus className="h-4 w-4 mr-2" />
                Create Outreach
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface AddOutreachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AddOutreachDialog({ open, onOpenChange }: AddOutreachDialogProps) {
  const founders = useQuery(api.founders.list, {});
  const templates = useQuery(api.settings.listTemplates, {});
  const createOutreach = useMutation(api.outreach.create);

  const [formData, setFormData] = useState({
    founderId: "" as string,
    type: "email" as OutreachType,
    subject: "",
    message: "",
    template: "",
  });

  const handleTemplateChange = (templateId: string) => {
    const template = templates?.find((t) => t._id === templateId);
    if (template) {
      setFormData({
        ...formData,
        template: templateId,
        subject: template.subject ?? "",
        message: template.body,
      });
    }
  };

  const handleSubmit = async () => {
    if (!formData.founderId || !formData.message) {
      alert("Founder and message are required");
      return;
    }

    const founder = founders?.find((f) => f._id === formData.founderId);

    await createOutreach({
      founderId: formData.founderId as Id<"founders">,
      startupId: founder?.startupId,
      type: formData.type,
      subject: formData.subject || undefined,
      message: formData.message,
      template: formData.template || undefined,
    });

    setFormData({
      founderId: "",
      type: "email",
      subject: "",
      message: "",
      template: "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <IconPlus className="h-4 w-4 mr-2" />
          Create Outreach
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Outreach</DialogTitle>
          <DialogDescription>
            Compose an email or LinkedIn message to a founder
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type Selection */}
          <div className="flex gap-4">
            <Button
              variant={formData.type === "email" ? "default" : "outline"}
              onClick={() => setFormData({ ...formData, type: "email" })}
              className="flex-1"
            >
              <IconMail className="h-4 w-4 mr-2" />
              Email
            </Button>
            <Button
              variant={formData.type === "linkedin" ? "default" : "outline"}
              onClick={() => setFormData({ ...formData, type: "linkedin" })}
              className="flex-1"
            >
              <IconBrandLinkedin className="h-4 w-4 mr-2" />
              LinkedIn
            </Button>
          </div>

          {/* Founder Selection */}
          <div className="space-y-2">
            <Label>Recipient *</Label>
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
                {founders?.map((founder) => (
                  <SelectItem key={founder._id} value={founder._id}>
                    {founder.firstName} {founder.lastName}
                    {founder.email && ` (${founder.email})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Template Selection */}
          {templates && templates.length > 0 && (
            <div className="space-y-2">
              <Label>Use Template</Label>
              <Select
                value={formData.template}
                onValueChange={handleTemplateChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No template</SelectItem>
                  {templates
                    .filter((t) => t.type === formData.type)
                    .map((template) => (
                      <SelectItem key={template._id} value={template._id}>
                        {template.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subject (for email) */}
          {formData.type === "email" && (
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
                placeholder="Email subject..."
              />
            </div>
          )}

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) =>
                setFormData({ ...formData, message: e.target.value })
              }
              placeholder="Write your message..."
              rows={8}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <IconSend className="h-4 w-4 mr-2" />
            Save as Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
