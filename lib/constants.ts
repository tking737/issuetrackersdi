import { IssueCategory, IssuePlatform, IssuePriority, IssueStatus } from "@/lib/types";

export const CATEGORIES: IssueCategory[] = ["Bug", "Performance", "Feature Request", "Question", "Other"];
export const PLATFORMS: IssuePlatform[] = ["Sage Intacct", "Sage Paperless", "Credit Cards"];
export const PRIORITIES: IssuePriority[] = ["Low", "Medium", "High", "Critical"];
export const STATUSES: IssueStatus[] = ["Open", "In Progress", "Resolved", "Resolved with Workaround"];

export const statusColor: Record<IssueStatus, string> = {
  Open: "#378ADD",
  "In Progress": "#BA7517",
  Resolved: "#3B6D11",
  "Resolved with Workaround": "#3B6D11",
};

export const statusBg: Record<IssueStatus, string> = {
  Open: "#E6F1FB",
  "In Progress": "#FAEEDA",
  Resolved: "#EAF3DE",
  "Resolved with Workaround": "#EAF3DE",
};

export const priorityColor: Record<IssuePriority, string> = {
  Low: "#5F5E5A",
  Medium: "#BA7517",
  High: "#993C1D",
  Critical: "#A32D2D",
};

export const priorityBg: Record<IssuePriority, string> = {
  Low: "#F1EFE8",
  Medium: "#FAEEDA",
  High: "#FAECE7",
  Critical: "#FCEBEB",
};
