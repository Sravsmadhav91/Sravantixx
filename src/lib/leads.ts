// Shared labels, colors, and helpers for the Leads pipeline

export type LeadStatus =
  | "new"
  | "contacted"
  | "site_visit"
  | "negotiation"
  | "won"
  | "lost";

export type LeadSource =
  | "walk_in"
  | "referral"
  | "advertisement"
  | "website"
  | "social_media"
  | "other";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  site_visit: "Site Visit",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export const LEAD_STATUS_CLASSES: Record<LeadStatus, string> = {
  new: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  contacted: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  site_visit: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  negotiation: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  won: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  lost: "bg-muted text-muted-foreground",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  walk_in: "Walk-in",
  referral: "Referral",
  advertisement: "Advertisement",
  website: "Website",
  social_media: "Social media",
  other: "Other",
};

export const ALL_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "site_visit",
  "negotiation",
  "won",
  "lost",
];

export const OPEN_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "site_visit",
  "negotiation",
];
