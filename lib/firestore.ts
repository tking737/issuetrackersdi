import { randomUUID } from "crypto";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import {
  AttachmentItem,
  CommentItem,
  Issue,
  IssueCategory,
  IssuePlatform,
  IssuePriority,
  IssueStatus,
  SecondaryStatus,
  UserSession,
} from "@/lib/types";

const issuesCollection = adminDb.collection("issues");

function mapIssue(id: string, data: FirebaseFirestore.DocumentData): Issue {
  return {
    id,
    title: String(data.title || ""),
    category: data.category as IssueCategory,
    platform: data.platform as IssuePlatform,
    status: data.status as IssueStatus,
    secondaryStatus: (data.secondaryStatus || "None") as SecondaryStatus,
    owner: data.owner ? String(data.owner) : null,
    priority: data.priority as IssuePriority,
    submitter: String(data.submitter || ""),
    submitterName: String(data.submitterName || ""),
    description: String(data.description || ""),
    votes: Array.isArray(data.voters) ? data.voters.length : 0,
    voters: Array.isArray(data.voters) ? data.voters : [],
    comments: Array.isArray(data.comments)
      ? (data.comments as CommentItem[]).map((comment) => ({
          ...comment,
          attachments: Array.isArray(comment.attachments)
            ? comment.attachments
            : [],
        }))
      : [],
    attachments: Array.isArray(data.attachments)
      ? (data.attachments as AttachmentItem[])
      : [],
    createdAt: String(data.createdAt || new Date().toISOString()),
    resolvedAt: data.resolvedAt ? String(data.resolvedAt) : null,
    notifyOnResolve: Array.isArray(data.notifyOnResolve)
      ? data.notifyOnResolve
      : [],
  };
}

export async function listIssues(): Promise<Issue[]> {
  const snapshot = await issuesCollection.orderBy("createdAt", "desc").get();
  return snapshot.docs.map((doc) => mapIssue(doc.id, doc.data()));
}

export async function getIssueById(issueId: string): Promise<Issue> {
  const doc = await issuesCollection.doc(issueId).get();
  if (!doc.exists) throw new Error("Issue not found.");
  return mapIssue(doc.id, doc.data()!);
}

export async function createIssue(input: {
  title: string;
  category: IssueCategory;
  platform: IssuePlatform;
  priority: IssuePriority;
  description: string;
  submitterName: string;
  submitter: string;
  user: UserSession;
  attachments: AttachmentItem[];
}) {
  const now = new Date().toISOString();
  const ref = await issuesCollection.add({
    title: input.title,
    category: input.category,
    platform: input.platform,
    status: "Open",
    secondaryStatus: "None",
    owner: null,
    priority: input.priority,
    description: input.description,
    submitterName: input.submitterName,
    submitter: input.submitter,
    submitterId: input.user.id,
    createdAt: now,
    resolvedAt: null,
    voters: [],
    comments: [],
    attachments: input.attachments,
    notifyOnResolve: [input.user.email],
  });

  return getIssueById(ref.id);
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function saveAttachmentToStorage(
  path: string,
  file: File
): Promise<AttachmentItem> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const storageFile = adminStorage.file(path);

  await storageFile.save(buffer, {
    resumable: false,
    metadata: {
      contentType: file.type || undefined,
    },
  });

  const [url] = await storageFile.getSignedUrl({
    action: "read",
    expires: "03-01-2500",
  });

  return {
    name: file.name,
    path,
    url,
    contentType: file.type || null,
    size: file.size || null,
  };
}

export async function uploadAttachment(
  issueId: string,
  file: File
): Promise<AttachmentItem> {
  const path = `issues/${issueId}/${Date.now()}-${sanitizeFilename(file.name)}`;
  return saveAttachmentToStorage(path, file);
}

export async function uploadCommentAttachment(
  issueId: string,
  commentId: string,
  file: File
): Promise<AttachmentItem> {
  const path = `issues/${issueId}/comments/${commentId}/${Date.now()}-${sanitizeFilename(
    file.name
  )}`;
  return saveAttachmentToStorage(path, file);
}

export async function updateIssueFollowers(issueId: string, followers: string[]) {
  const ref = adminDb.collection("issues").doc(issueId);
  await ref.update({
    notifyOnResolve: Array.from(
      new Set(
        followers.map((value) => value.trim().toLowerCase()).filter(Boolean)
      )
    ),
  });
}

export async function toggleVote(issueId: string, email: string) {
  const ref = issuesCollection.doc(issueId);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("Issue not found.");
    const data = snap.data()!;
    const voters = Array.isArray(data.voters) ? [...data.voters] : [];
    const index = voters.indexOf(email);
    if (index >= 0) voters.splice(index, 1);
    else voters.push(email);
    tx.update(ref, { voters });
  });
  return getIssueById(issueId);
}

export async function toggleSubscription(issueId: string, email: string) {
  const ref = issuesCollection.doc(issueId);
  let subscribed = false;

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("Issue not found.");
    const data = snap.data()!;
    const values = Array.isArray(data.notifyOnResolve)
      ? [...data.notifyOnResolve]
      : [];
    const index = values.indexOf(email);
    if (index >= 0) {
      values.splice(index, 1);
      subscribed = false;
    } else {
      values.push(email);
      subscribed = true;
    }
    tx.update(ref, { notifyOnResolve: values });
  });

  return { subscribed, issue: await getIssueById(issueId) };
}

export async function addComment(
  issueId: string,
  author: string,
  text: string,
  attachments: AttachmentItem[] = []
) {
  const ref = issuesCollection.doc(issueId);
  const comment: CommentItem = {
    id: randomUUID(),
    author,
    text,
    date: new Date().toISOString(),
    attachments,
  };

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("Issue not found.");
    const data = snap.data()!;
    const comments = Array.isArray(data.comments) ? [...data.comments] : [];
    comments.push(comment);
    tx.update(ref, { comments });
  });

  return getIssueById(issueId);
}

export async function updateIssueStatus(issueId: string, status: IssueStatus) {
  const ref = issuesCollection.doc(issueId);
  await ref.update({
    status,
    resolvedAt: status === "Resolved" ? new Date().toISOString() : null,
  });
  return getIssueById(issueId);
}

export async function updateSecondaryStatus(
  issueId: string,
  secondaryStatus: SecondaryStatus
) {
  const ref = issuesCollection.doc(issueId);
  await ref.update({ secondaryStatus });
  return getIssueById(issueId);
}

export async function assignIssueOwner(
  issueId: string,
  owner: string | null
) {
  const ref = issuesCollection.doc(issueId);
  await ref.update({ owner });
  return getIssueById(issueId);
}