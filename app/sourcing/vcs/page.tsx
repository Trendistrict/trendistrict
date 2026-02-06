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
  IconNetwork,
  IconBrandLinkedin,
  IconMail,
  IconX,
  IconExternalLink,
  IconBuilding,
  IconCoin,
  IconTag,
  IconUpload,
} from "@tabler/icons-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type RelationshipStrength = "weak" | "moderate" | "strong";

const RELATIONSHIP_CONFIG: Record<RelationshipStrength, { label: string; color: string }> = {
  weak: { label: "Weak", color: "bg-red-500" },
  moderate: { label: "Moderate", color: "bg-amber-500" },
  strong: { label: "Strong", color: "bg-emerald-500" },
};

export default function VCNetworkPage() {
  const [strengthFilter, setStrengthFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);

  const vcConnections = useQuery(api.vcConnections.list, {});
  const deleteVC = useMutation(api.vcConnections.remove);
  const updateVC = useMutation(api.vcConnections.update);

  const filteredVCs = vcConnections?.filter((vc) => {
    if (strengthFilter !== "all" && vc.relationshipStrength !== strengthFilter) {
      return false;
    }
    return true;
  });

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "Never";
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
          <h1 className="text-2xl font-semibold">VC Network</h1>
          <p className="text-muted-foreground">
            Manage your connections with VCs for introductions
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/sourcing/vcs/import">
            <Button variant="outline">
              <IconUpload className="h-4 w-4 mr-2" />
              Import VCs
            </Button>
          </Link>
          <AddVCDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total VCs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vcConnections?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Strong Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vcConnections?.filter((vc) => vc.relationshipStrength === "strong").length ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unique Firms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(vcConnections?.map((vc) => vc.firmName)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <Label>Relationship Strength:</Label>
        <Select value={strengthFilter} onValueChange={setStrengthFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All connections</SelectItem>
            {Object.entries(RELATIONSHIP_CONFIG).map(([key, config]) => (
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
          {filteredVCs?.length ?? 0} connections
        </span>
      </div>

      {/* VC List */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredVCs && filteredVCs.length > 0 ? (
          filteredVCs.map((vc) => (
            <Card key={vc._id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    {/* Name and firm */}
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{vc.vcName}</h3>
                      <Badge variant="secondary" className="text-xs">
                        <IconBuilding className="h-3 w-3 mr-1" />
                        {vc.firmName}
                      </Badge>
                    </div>

                    {/* Contact info */}
                    <div className="flex gap-4">
                      {vc.email && (
                        <a
                          href={`mailto:${vc.email}`}
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
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
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <IconBrandLinkedin className="h-4 w-4" />
                          LinkedIn
                          <IconExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    {/* Investment focus */}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {vc.checkSize && (
                        <span className="flex items-center gap-1">
                          <IconCoin className="h-4 w-4" />
                          {vc.checkSize}
                        </span>
                      )}
                      {vc.investmentStages && vc.investmentStages.length > 0 && (
                        <span className="flex items-center gap-1">
                          <IconTag className="h-4 w-4" />
                          {vc.investmentStages.join(", ")}
                        </span>
                      )}
                    </div>

                    {/* Sectors */}
                    {vc.sectors && vc.sectors.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {vc.sectors.map((sector) => (
                          <Badge key={sector} variant="outline" className="text-xs">
                            {sector}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Notes */}
                    {vc.notes && (
                      <p className="text-sm text-muted-foreground">{vc.notes}</p>
                    )}

                    {/* Last contact */}
                    <p className="text-xs text-muted-foreground">
                      Last contact: {formatDate(vc.lastContactDate)}
                    </p>
                  </div>

                  {/* Relationship strength and actions */}
                  <div className="flex flex-col items-end gap-2">
                    <Select
                      value={vc.relationshipStrength}
                      onValueChange={(value) =>
                        updateVC({
                          id: vc._id,
                          relationshipStrength: value as RelationshipStrength,
                        })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(RELATIONSHIP_CONFIG).map(([key, config]) => (
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
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateVC({ id: vc._id, lastContactDate: Date.now() })
                      }
                    >
                      Log Contact
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteVC({ id: vc._id })}
                    >
                      <IconX className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="md:col-span-2">
            <CardContent className="p-8 text-center">
              <IconNetwork className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No VC connections yet</h3>
              <p className="text-muted-foreground mb-4">
                Build your network of VCs to make introductions.
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <IconPlus className="h-4 w-4 mr-2" />
                Add VC Connection
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface AddVCDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AddVCDialog({ open, onOpenChange }: AddVCDialogProps) {
  const createVC = useMutation(api.vcConnections.create);

  const [formData, setFormData] = useState({
    vcName: "",
    firmName: "",
    email: "",
    linkedInUrl: "",
    investmentStages: "",
    sectors: "",
    checkSize: "",
    relationshipStrength: "moderate" as RelationshipStrength,
    notes: "",
  });

  const handleSubmit = async () => {
    if (!formData.vcName || !formData.firmName) {
      alert("VC name and firm name are required");
      return;
    }

    await createVC({
      vcName: formData.vcName,
      firmName: formData.firmName,
      email: formData.email || undefined,
      linkedInUrl: formData.linkedInUrl || undefined,
      investmentStages: formData.investmentStages
        ? formData.investmentStages.split(",").map((s) => s.trim())
        : undefined,
      sectors: formData.sectors
        ? formData.sectors.split(",").map((s) => s.trim())
        : undefined,
      checkSize: formData.checkSize || undefined,
      relationshipStrength: formData.relationshipStrength,
      notes: formData.notes || undefined,
    });

    setFormData({
      vcName: "",
      firmName: "",
      email: "",
      linkedInUrl: "",
      investmentStages: "",
      sectors: "",
      checkSize: "",
      relationshipStrength: "moderate",
      notes: "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <IconPlus className="h-4 w-4 mr-2" />
          Add VC Connection
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add VC Connection</DialogTitle>
          <DialogDescription>
            Add a VC to your network for making introductions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vcName">VC Name *</Label>
              <Input
                id="vcName"
                value={formData.vcName}
                onChange={(e) =>
                  setFormData({ ...formData, vcName: e.target.value })
                }
                placeholder="e.g., John Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firmName">Firm Name *</Label>
              <Input
                id="firmName"
                value={formData.firmName}
                onChange={(e) =>
                  setFormData({ ...formData, firmName: e.target.value })
                }
                placeholder="e.g., Sequoia Capital"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedInUrl">LinkedIn URL</Label>
              <Input
                id="linkedInUrl"
                value={formData.linkedInUrl}
                onChange={(e) =>
                  setFormData({ ...formData, linkedInUrl: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="checkSize">Check Size</Label>
              <Input
                id="checkSize"
                value={formData.checkSize}
                onChange={(e) =>
                  setFormData({ ...formData, checkSize: e.target.value })
                }
                placeholder="e.g., $250k-$2m"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relationshipStrength">Relationship</Label>
              <Select
                value={formData.relationshipStrength}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    relationshipStrength: value as RelationshipStrength,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RELATIONSHIP_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="investmentStages">Investment Stages (comma-separated)</Label>
            <Input
              id="investmentStages"
              value={formData.investmentStages}
              onChange={(e) =>
                setFormData({ ...formData, investmentStages: e.target.value })
              }
              placeholder="e.g., pre-seed, seed, series-a"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sectors">Sectors (comma-separated)</Label>
            <Input
              id="sectors"
              value={formData.sectors}
              onChange={(e) =>
                setFormData({ ...formData, sectors: e.target.value })
              }
              placeholder="e.g., fintech, healthtech, b2b saas"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Add VC</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
