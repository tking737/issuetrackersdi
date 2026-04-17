export type IssueStatus = "Open" | "In Progress" | "Resolved" | "Resolved with Workaround";

export type SecondaryStatus =
  | "None"
  | "Submitted to Sage"
  | "Working on Internal Solution";

export type IssuePriority = "Low" | "Medium" | "High" | "Critical";

export type IssueCategory =
  | "Bug"
  | "Performance"
  | "Feature Request"
  | "Question"
  | "Other";

export type IssuePlatform =
  | "Sage Intacct"
  | "Sage Paperless"
  | "Credit Cards";

export type AttachmentItem = {
  name: string;
  path: string;
  url: string;
  contentType: string | null;
  size: number | null;
};

export type CommentItem = {
  id: string;
  author: string;
  text: string;
  date: string;
  attachments: AttachmentItem[];
};

export type Issue = {
  id: string;
  title: string;
  category: IssueCategory;
  platform: IssuePlatform;
  status: IssueStatus;
  secondaryStatus: SecondaryStatus;
  owner: string | null;
  priority: IssuePriority;
  submitter: string;
  submitterName: string;
  description: string;
  votes: number;
  voters: string[];
  comments: CommentItem[];
  attachments: AttachmentItem[];
  createdAt: string;
  resolvedAt: string | null;
  notifyOnResolve: string[];
};

export type UserSession = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
};