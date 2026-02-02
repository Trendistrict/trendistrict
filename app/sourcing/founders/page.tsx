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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconPlus,
  IconSchool,
  IconBriefcase,
  IconBrandLinkedin,
  IconMail,
  IconMapPin,
  IconCalculator,
  IconX,
  IconExternalLink,
  IconSparkles,
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

interface Education {
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number;
  isTopTier?: boolean;
}

interface Experience {
  company: string;
  title: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  isHighGrowth?: boolean;
  description?: string;
}

export default function FoundersPage() {
  const [minScore, setMinScore] = useState<number | undefined>(undefined);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const founders = useQuery(api.founders.listWithStartups);
  const startups = useQuery(api.startups.list, {});
  const calculateScore = useMutation(api.founders.calculateScore);
  const deleteFounder = useMutation(api.founders.remove);

  const filteredFounders = founders?.filter((f) => {
    if (minScore !== undefined && (f.overallScore ?? 0) < minScore) {
      return false;
    }
    return true;
  });

  const handleCalculateScore = async (id: Id<"founders">) => {
    try {
      const scores = await calculateScore({ id });
      alert(
        `Scores calculated!\nEducation: ${scores.educationScore}%\nExperience: ${scores.experienceScore}%\nOverall: ${scores.overallScore}%`
      );
    } catch (error) {
      console.error("Failed to calculate score:", error);
      alert("Failed to calculate score");
    }
  };

  const getScoreColor = (score?: number) => {
    if (score === undefined) return "text-muted-foreground";
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-green-500";
    if (score >= 40) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Founders</h1>
          <p className="text-muted-foreground">
            Track founders and evaluate their backgrounds
          </p>
        </div>
        <AddFounderDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          startups={startups ?? []}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconSparkles className="h-5 w-5" />
            Filter by Score
          </CardTitle>
          <CardDescription>
            Filter founders by their overall background score
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <Label>Minimum Score:</Label>
            <Select
              value={minScore?.toString() ?? "all"}
              onValueChange={(value) =>
                setMinScore(value === "all" ? undefined : parseInt(value))
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All founders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All founders</SelectItem>
                <SelectItem value="80">80%+ (Excellent)</SelectItem>
                <SelectItem value="60">60%+ (Good)</SelectItem>
                <SelectItem value="40">40%+ (Average)</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {filteredFounders?.length ?? 0} founders
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Founders List */}
      <div className="grid gap-4">
        {filteredFounders && filteredFounders.length > 0 ? (
          filteredFounders.map((founder) => (
            <Card key={founder._id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Name and badges */}
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">
                        {founder.firstName} {founder.lastName}
                      </h3>
                      {founder.isFounder && (
                        <Badge variant="default" className="text-xs">
                          Founder
                        </Badge>
                      )}
                      {founder.startup && (
                        <Badge variant="secondary" className="text-xs">
                          {founder.startup.companyName}
                        </Badge>
                      )}
                    </div>

                    {/* Role and location */}
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {founder.headline && (
                        <span>{founder.headline}</span>
                      )}
                      {founder.role && !founder.headline && (
                        <span>{founder.role}</span>
                      )}
                      {founder.location && (
                        <span className="flex items-center gap-1">
                          <IconMapPin className="h-4 w-4" />
                          {founder.location}
                        </span>
                      )}
                    </div>

                    {/* Contact info */}
                    <div className="flex gap-4">
                      {founder.email && (
                        <a
                          href={`mailto:${founder.email}`}
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <IconMail className="h-4 w-4" />
                          {founder.email}
                        </a>
                      )}
                      {founder.linkedInUrl && (
                        <a
                          href={founder.linkedInUrl}
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

                    {/* Education */}
                    {founder.education && founder.education.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <IconSchool className="h-4 w-4" />
                          Education
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {founder.education.map((edu, idx) => (
                            <Badge
                              key={idx}
                              variant={edu.isTopTier ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {edu.school}
                              {edu.degree && ` - ${edu.degree}`}
                              {edu.isTopTier && " ★"}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Experience */}
                    {founder.experience && founder.experience.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <IconBriefcase className="h-4 w-4" />
                          Experience
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {founder.experience.map((exp, idx) => (
                            <Badge
                              key={idx}
                              variant={exp.isHighGrowth ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {exp.title} @ {exp.company}
                              {exp.isHighGrowth && " ★"}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Score and actions */}
                  <div className="flex flex-col items-end gap-3">
                    {/* Scores */}
                    <div className="text-right space-y-1">
                      <div className={`text-2xl font-bold ${getScoreColor(founder.overallScore)}`}>
                        {founder.overallScore !== undefined
                          ? `${founder.overallScore}%`
                          : "N/A"}
                      </div>
                      {founder.overallScore !== undefined && (
                        <div className="text-xs text-muted-foreground">
                          <div>Edu: {founder.educationScore ?? 0}%</div>
                          <div>Exp: {founder.experienceScore ?? 0}%</div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCalculateScore(founder._id)}
                      >
                        <IconCalculator className="h-4 w-4 mr-1" />
                        Score
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteFounder({ id: founder._id })}
                      >
                        <IconX className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <IconBriefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No founders yet</h3>
              <p className="text-muted-foreground mb-4">
                Add founders manually or import from LinkedIn to start evaluating.
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <IconPlus className="h-4 w-4 mr-2" />
                Add Founder
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

interface AddFounderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startups: Array<{ _id: Id<"startups">; companyName: string }>;
}

function AddFounderDialog({ open, onOpenChange, startups }: AddFounderDialogProps) {
  const createFounder = useMutation(api.founders.create);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    linkedInUrl: "",
    headline: "",
    location: "",
    role: "",
    startupId: "" as string | Id<"startups">,
    isFounder: true,
  });

  const [education, setEducation] = useState<Education[]>([]);
  const [experience, setExperience] = useState<Experience[]>([]);

  const addEducation = () => {
    setEducation([...education, { school: "", isTopTier: false }]);
  };

  const addExperience = () => {
    setExperience([...experience, { company: "", title: "", isHighGrowth: false }]);
  };

  const handleSubmit = async () => {
    if (!formData.firstName || !formData.lastName) {
      alert("First name and last name are required");
      return;
    }

    await createFounder({
      ...formData,
      startupId: formData.startupId ? (formData.startupId as Id<"startups">) : undefined,
      education: education.filter((e) => e.school),
      experience: experience.filter((e) => e.company && e.title),
      source: "manual",
    });

    // Reset form
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      linkedInUrl: "",
      headline: "",
      location: "",
      role: "",
      startupId: "",
      isFounder: true,
    });
    setEducation([]);
    setExperience([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <IconPlus className="h-4 w-4 mr-2" />
          Add Founder
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Founder</DialogTitle>
          <DialogDescription>
            Add founder details to evaluate their background
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h4 className="font-medium">Basic Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
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
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="headline">Headline</Label>
              <Input
                id="headline"
                value={formData.headline}
                onChange={(e) =>
                  setFormData({ ...formData, headline: e.target.value })
                }
                placeholder="e.g., CEO at Startup Inc"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  placeholder="e.g., London, UK"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startup">Linked Startup</Label>
                <Select
                  value={formData.startupId as string}
                  onValueChange={(value) =>
                    setFormData({ ...formData, startupId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select startup..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No startup</SelectItem>
                    {startups.map((startup) => (
                      <SelectItem key={startup._id} value={startup._id}>
                        {startup.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isFounder"
                checked={formData.isFounder}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isFounder: checked as boolean })
                }
              />
              <Label htmlFor="isFounder">Is a Founder</Label>
            </div>
          </div>

          {/* Education */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <IconSchool className="h-4 w-4" />
                Education
              </h4>
              <Button variant="outline" size="sm" onClick={addEducation}>
                <IconPlus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            {education.map((edu, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">School</Label>
                  <Input
                    value={edu.school}
                    onChange={(e) => {
                      const newEdu = [...education];
                      newEdu[idx].school = e.target.value;
                      setEducation(newEdu);
                    }}
                    placeholder="University name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Degree</Label>
                  <Input
                    value={edu.degree ?? ""}
                    onChange={(e) => {
                      const newEdu = [...education];
                      newEdu[idx].degree = e.target.value;
                      setEducation(newEdu);
                    }}
                    placeholder="e.g., MBA"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={edu.isTopTier ?? false}
                    onCheckedChange={(checked) => {
                      const newEdu = [...education];
                      newEdu[idx].isTopTier = checked as boolean;
                      setEducation(newEdu);
                    }}
                  />
                  <Label className="text-xs">Top Tier</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEducation(education.filter((_, i) => i !== idx))}
                  >
                    <IconX className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Experience */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <IconBriefcase className="h-4 w-4" />
                Experience
              </h4>
              <Button variant="outline" size="sm" onClick={addExperience}>
                <IconPlus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
            {experience.map((exp, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Company</Label>
                  <Input
                    value={exp.company}
                    onChange={(e) => {
                      const newExp = [...experience];
                      newExp[idx].company = e.target.value;
                      setExperience(newExp);
                    }}
                    placeholder="Company name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={exp.title}
                    onChange={(e) => {
                      const newExp = [...experience];
                      newExp[idx].title = e.target.value;
                      setExperience(newExp);
                    }}
                    placeholder="e.g., Head of Product"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={exp.isHighGrowth ?? false}
                    onCheckedChange={(checked) => {
                      const newExp = [...experience];
                      newExp[idx].isHighGrowth = checked as boolean;
                      setExperience(newExp);
                    }}
                  />
                  <Label className="text-xs">High Growth</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExperience(experience.filter((_, i) => i !== idx))}
                  >
                    <IconX className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Add Founder</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
