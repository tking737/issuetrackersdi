"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CATEGORIES,
  PLATFORMS,
  PRIORITIES,
  STATUSES,
  priorityBg,
  priorityColor,
  statusBg,
  statusColor,
} from "@/lib/constants";
import {
  AttachmentItem,
  Issue,
  IssuePlatform,
  IssueStatus,
  UserSession,
} from "@/lib/types";
import {
  daysSince,
  formatDate,
  initials,
  isImageAttachment,
} from "@/lib/utils";
import { LogoutButton } from "@/components/logout-button";
import { auth } from "@/lib/firebase/client";
import { isAllowedEmail, allowedDomainsLabel } from "@/lib/auth-config";

type Props = {
  initialIssues: Issue[];
  currentUser: UserSession;
};

type Notification = {
  msg: string;
  type: "success" | "error";
};

type StatusChecks = {
  open: boolean;
  inProgress: boolean;
  resolved: boolean;
};

function Badge({
  label,
  color,
  bg,
}: {
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <span className="badge" style={{ color, background: bg }}>
      {label}
    </span>
  );
}

function AttachmentGallery({
  attachments,
  onPreview,
}: {
  attachments: AttachmentItem[];
  onPreview: (attachment: AttachmentItem) => void;
}) {
  if (!attachments.length) return null;

  const images = attachments.filter(isImageAttachment);
  const files = attachments.filter((attachment) => !isImageAttachment(attachment));

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {images.length ? (
        <div>
          <p
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#344054",
              margin: "0 0 8px",
            }}
          >
            Images
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 10,
            }}
          >
            {images.map((attachment) => (
              <button
                key={attachment.path}
                type="button"
                onClick={() => onPreview(attachment)}
                style={{
                  border: "1px solid #eaecf0",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#fff",
                  padding: 0,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  style={{
                    display: "block",
                    width: "100%",
                    height: 140,
                    objectFit: "cover",
                    background: "#f2f4f7",
                  }}
                />
                <div style={{ padding: 8, fontSize: 12, color: "#475467" }}>
                  {attachment.name}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {files.length ? (
        <div>
          <p
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#344054",
              margin: "0 0 8px",
            }}
          >
            Files
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {files.map((attachment) => (
              <a
                key={attachment.path}
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="btn"
                style={{ justifyContent: "flex-start" }}
              >
                {attachment.name}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function IssueTrackerApp({ initialIssues, currentUser }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  const [view, setView] = useState<"list" | "aging">("list");
  const [search, setSearch] = useState("");
  const [statusChecks, setStatusChecks] = useState<StatusChecks>({
    open: true,
    inProgress: true,
    resolved: false,
  });
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterPlatform, setFilterPlatform] = useState("All");
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [adminSubscriberEmail, setAdminSubscriberEmail] = useState("");
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentItem | null>(
    null
  );
  const [form, setForm] = useState({
    title: "",
    category: "Bug",
    platform: "Sage Intacct",
    priority: "Medium",
    description: "",
    submitterName: currentUser.name,
    submitter: currentUser.email,
  });
  const [sortBy, setSortBy] = useState("createdAt");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => setIssues(initialIssues), [initialIssues]);

  const updateUrlState = (next: {
    view?: "list" | "aging";
    issueId?: string | null;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    const nextView = next.view ?? view;
    const nextIssueId =
      next.issueId === undefined ? selectedIssue?.id ?? null : next.issueId;

    if (nextView && nextView !== "list") {
      params.set("view", nextView);
    } else {
      params.delete("view");
    }

    if (nextIssueId) {
      params.set("issue", nextIssueId);
    } else {
      params.delete("issue");
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const showNotif = (
    msg: string,
    type: "success" | "error" = "success"
  ) => {
    setNotification({ msg, type });
    window.clearTimeout((showNotif as any)._timer);
    (showNotif as any)._timer = window.setTimeout(
      () => setNotification(null),
      3500
    );
  };

  const authorizedFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Not authenticated.");
    const headers = new Headers(init?.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };

  const refreshIssue = async (issueId: string) => {
    const res = await authorizedFetch(`/api/issues/${issueId}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const fresh = (await res.json()) as Issue;
    setIssues((prev) => prev.map((i) => (i.id === issueId ? fresh : i)));
    setSelectedIssue((prev) => (prev?.id === issueId ? fresh : prev));
  };

  useEffect(() => {
    const issueParam = searchParams.get("issue");
    const viewParam = searchParams.get("view");

    setView(viewParam === "aging" ? "aging" : "list");

    if (!issueParam) {
      setSelectedIssue(null);
      return;
    }

    const found = issues.find((issue) => issue.id === issueParam);
    if (found) {
      setSelectedIssue(found);
      setView("list");
    }
  }, [issues, searchParams]);

  const filtered = useMemo(() => {
    return issues
      .filter((i) => {
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.submitterName.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.platform.toLowerCase().includes(q);

        const matchStatus =
          (statusChecks.open && i.status === "Open") ||
          (statusChecks.inProgress && i.status === "In Progress") ||
          (statusChecks.resolved && i.status === "Resolved");

        const matchPriority =
          filterPriority === "All" || i.priority === filterPriority;
        const matchCategory =
          filterCategory === "All" || i.category === filterCategory;
        const matchPlatform =
          filterPlatform === "All" || i.platform === filterPlatform;

        return (
          matchSearch &&
          matchStatus &&
          matchPriority &&
          matchCategory &&
          matchPlatform
        );
      })
      .sort((a, b) => {
        const aResolved = a.status === "Resolved" ? 1 : 0;
        const bResolved = b.status === "Resolved" ? 1 : 0;
        if (aResolved !== bResolved) return aResolved - bResolved;
        if (sortBy === "votes") return b.votes - a.votes;
        if (sortBy === "priority") {
          return (
            PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority)
          );
        }
        if (sortBy === "aging") {
          return daysSince(b.createdAt) - daysSince(a.createdAt);
        }
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
  }, [
    issues,
    search,
    statusChecks,
    filterPriority,
    filterCategory,
    filterPlatform,
    sortBy,
  ]);

  const activeIssues = issues.filter((i) => i.status !== "Resolved");
  const resolvedIssues = issues.filter((i) => i.status === "Resolved");
  const avgAge = activeIssues.length
    ? Math.round(
        activeIssues.reduce((s, i) => s + daysSince(i.createdAt), 0) /
          activeIssues.length
      )
    : 0;

  const goToFilteredList = (status: "active" | "resolved") => {
    setView("list");
    setSelectedIssue(null);
    setShowForm(false);

    if (status === "active") {
      setStatusChecks({
        open: true,
        inProgress: true,
        resolved: false,
      });
    } else {
      setStatusChecks({
        open: false,
        inProgress: false,
        resolved: true,
      });
    }

    updateUrlState({ view: "list", issueId: null });
  };

  const openIssue = (issue: Issue) => {
    setView("list");
    setSelectedIssue(issue);
    updateUrlState({ view: "list", issueId: issue.id });
  };

  const backToList = () => {
    setSelectedIssue(null);
    updateUrlState({ view: "list", issueId: null });
  };

  const goToAging = () => {
    setView("aging");
    setSelectedIssue(null);
    updateUrlState({ view: "aging", issueId: null });
  };

  const goToIssues = () => {
    setView("list");
    setSelectedIssue(null);
    updateUrlState({ view: "list", issueId: null });
  };

  const updateFollowers = async (issueId: string, followers: string[]) => {
    setBusyAction(`followers-${issueId}`);

    const res = await authorizedFetch(`/api/issues/${issueId}/followers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ followers }),
    });

    setBusyAction(null);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      showNotif(data?.error || "Failed to update subscribers.", "error");
      return false;
    }

    await refreshIssue(issueId);
    return true;
  };

  const addAdminSubscriber = async (issue: Issue) => {
    const email = adminSubscriberEmail.trim().toLowerCase();

    if (!email) {
      showNotif("Enter an email address to add.", "error");
      return;
    }

    if (!isAllowedEmail(email)) {
      showNotif(
        `Only these email domains are allowed: ${allowedDomainsLabel()}`,
        "error"
      );
      return;
    }

    if (issue.notifyOnResolve.includes(email)) {
      showNotif("That user is already subscribed.", "error");
      return;
    }

    const ok = await updateFollowers(issue.id, [...issue.notifyOnResolve, email]);
    if (ok) {
      setAdminSubscriberEmail("");
      showNotif("Subscriber added.");
    }
  };

  const removeAdminSubscriber = async (issue: Issue, email: string) => {
    const next = issue.notifyOnResolve.filter((value) => value !== email);
    const ok = await updateFollowers(issue.id, next);
    if (ok) {
      showNotif("Subscriber removed.");
    }
  };

  const submitIssue = async () => {
    if (
      !form.title.trim() ||
      !form.submitterName.trim() ||
      !form.submitter.trim()
    ) {
      showNotif("Please fill in all required fields.", "error");
      return;
    }

    setBusyAction("submit");
    const payload = new FormData();
    payload.set("title", form.title);
    payload.set("category", form.category);
    payload.set("platform", form.platform);
    payload.set("priority", form.priority);
    payload.set("description", form.description);
    payload.set("submitterName", form.submitterName);
    payload.set("submitter", form.submitter);
    files.forEach((file) => payload.append("attachments", file));

    const res = await authorizedFetch("/api/issues", {
      method: "POST",
      body: payload,
    });
    setBusyAction(null);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      showNotif(data?.error || "Failed to submit issue.", "error");
      return;
    }

    const created = (await res.json()) as Issue;
    setIssues((prev) => [created, ...prev]);
    setForm({
      title: "",
      category: "Bug",
      platform: "Sage Intacct",
      priority: "Medium",
      description: "",
      submitterName: currentUser.name,
      submitter: currentUser.email,
    });
    setFiles([]);
    setShowForm(false);
    showNotif("Issue submitted successfully.");
  };

  const vote = async (issueId: string) => {
    setBusyAction(`vote-${issueId}`);
    const res = await authorizedFetch(`/api/issues/${issueId}/vote`, {
      method: "POST",
    });
    setBusyAction(null);
    if (!res.ok) {
      showNotif("Unable to update vote.", "error");
      return;
    }
    await refreshIssue(issueId);
  };

  const addComment = async (issueId: string) => {
    if (!newComment.trim()) return;

    setBusyAction(`comment-${issueId}`);

    const payload = new FormData();
    payload.set("body", newComment);
    commentFiles.forEach((file) => payload.append("attachments", file));

    const res = await authorizedFetch(`/api/issues/${issueId}/comments`, {
      method: "POST",
      body: payload,
    });

    setBusyAction(null);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      showNotif(data?.error || "Failed to post comment.", "error");
      return;
    }

    setNewComment("");
    setCommentFiles([]);
    await refreshIssue(issueId);
  };

  const changeStatus = async (issueId: string, newStatus: IssueStatus) => {
    setBusyAction(`status-${issueId}`);
    const res = await authorizedFetch(`/api/issues/${issueId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setBusyAction(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      showNotif(data?.error || "Could not update status.", "error");
      return;
    }
    const data = await res.json();
    await refreshIssue(issueId);
    showNotif(
      newStatus === "Resolved"
        ? `Issue resolved${
            typeof data.notified === "number"
              ? ` and ${data.notified} recipient(s) were notified.`
              : "."
          }`
        : "Issue status updated."
    );
  };

  const subscribeToIssue = async (issueId: string) => {
    setBusyAction(`subscribe-${issueId}`);
    const res = await authorizedFetch(`/api/issues/${issueId}/subscribe`, {
      method: "POST",
    });
    setBusyAction(null);
    if (!res.ok) {
      showNotif("Could not update subscription.", "error");
      return;
    }
    const data = await res.json();
    await refreshIssue(issueId);
    showNotif(
      data.subscribed
        ? "You will be notified when this is resolved."
        : "Unsubscribed from notifications."
    );
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) =>
    setFiles(Array.from(event.target.files || []));

  const handleCommentFileChange = (event: ChangeEvent<HTMLInputElement>) =>
    setCommentFiles(Array.from(event.target.files || []));

  const IssueCard = ({ issue }: { issue: Issue }) => {
    const age = daysSince(issue.createdAt);
    const voted = issue.voters.includes(currentUser.email);

    return (
      <div
        className="card"
        onClick={() => openIssue(issue)}
        style={{
          padding: 16,
          marginBottom: 10,
          cursor: "pointer",
          transition: "0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <button
            className="btn"
            onClick={(e) => {
              e.stopPropagation();
              void vote(issue.id);
            }}
            disabled={busyAction === `vote-${issue.id}`}
            style={{ minWidth: 56 }}
          >
            ▲ {issue.votes}
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 700 }}>
                {issue.title}
              </span>
              <Badge
                label={issue.status}
                color={statusColor[issue.status]}
                bg={statusBg[issue.status]}
              />
              <Badge
                label={issue.priority}
                color={priorityColor[issue.priority]}
                bg={priorityBg[issue.priority]}
              />
              <Badge label={issue.category} color="#533AB7" bg="#EEEDFE" />
              <Badge label={issue.platform} color="#155eef" bg="#eff8ff" />
              {voted ? (
                <Badge label="You voted" color="#155eef" bg="#dfeafe" />
              ) : null}
              {issue.notifyOnResolve.includes(currentUser.email) ? (
                <Badge label="Following" color="#027a48" bg="#ecfdf3" />
              ) : null}
            </div>

            <p
              style={{
                margin: "0 0 6px",
                color: "#475467",
                fontSize: 14,
              }}
            >
              {issue.description}
            </p>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                fontSize: 12,
                color: "#667085",
              }}
            >
              <span>By {issue.submitterName}</span>
              <span>
                {issue.comments.length} comment
                {issue.comments.length === 1 ? "" : "s"}
              </span>
              {issue.attachments.length ? (
                <span>
                  {issue.attachments.length} attachment
                  {issue.attachments.length === 1 ? "" : "s"}
                </span>
              ) : null}
              {issue.status !== "Resolved" ? (
                <span>{age}d open</span>
              ) : (
                <span>Resolved {formatDate(issue.resolvedAt)}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const liveSelected = selectedIssue
    ? issues.find((i) => i.id === selectedIssue.id) || selectedIssue
    : null;

  return (
    <main className="container">
      {previewAttachment ? (
        <div
          onClick={() => setPreviewAttachment(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(16, 24, 40, 0.82)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              display: "grid",
              gap: 12,
            }}
          >
            <img
              src={previewAttachment.url}
              alt={previewAttachment.name}
              style={{
                maxWidth: "90vw",
                maxHeight: "80vh",
                objectFit: "contain",
                borderRadius: 12,
                background: "#fff",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                color: "#fff",
                alignItems: "center",
              }}
            >
              <span>{previewAttachment.name}</span>
              <a
                href={previewAttachment.url}
                target="_blank"
                rel="noreferrer"
                className="btn"
              >
                Open original
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {notification ? (
        <div
          className="card"
          style={{
            padding: "10px 14px",
            marginBottom: 14,
            background:
              notification.type === "error" ? "#fef3f2" : "#ecfdf3",
            borderColor:
              notification.type === "error" ? "#fecdca" : "#abefc6",
          }}
        >
          <strong>{notification.type === "error" ? "Error" : "Success"}:</strong>{" "}
          {notification.msg}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 14,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Issue tracker</h1>
          <p style={{ margin: "6px 0 0", color: "#667085" }}>
            Internal portal · signed in as <strong>{currentUser.name}</strong> (
            {currentUser.email})
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {currentUser.isAdmin ? (
            <Badge label="Admin" color="#6941c6" bg="#f4f3ff" />
          ) : null}
          <button
            className={view === "list" ? "btn btn-primary" : "btn"}
            onClick={goToIssues}
          >
            Issues
          </button>
          <button
            className={view === "aging" ? "btn btn-primary" : "btn"}
            onClick={goToAging}
          >
            Punch list & aging
          </button>
          <LogoutButton />
        </div>
      </div>

      {view === "list" && !liveSelected ? (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 14 }}>
            <div style={{ display: "grid", gap: 12 }}>
              <input
                className="field"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search issues..."
                style={{ minWidth: 220 }}
              />

              <div
                style={{
                  display: "flex",
                  gap: 14,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={statusChecks.open}
                    onChange={(e) =>
                      setStatusChecks((prev) => ({
                        ...prev,
                        open: e.target.checked,
                      }))
                    }
                  />
                  <span>Open</span>
                </label>

                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={statusChecks.inProgress}
                    onChange={(e) =>
                      setStatusChecks((prev) => ({
                        ...prev,
                        inProgress: e.target.checked,
                      }))
                    }
                  />
                  <span>In Progress</span>
                </label>

                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={statusChecks.resolved}
                    onChange={(e) =>
                      setStatusChecks((prev) => ({
                        ...prev,
                        resolved: e.target.checked,
                      }))
                    }
                  />
                  <span>Resolved</span>
                </label>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select
                  className="select"
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  style={{ width: 160 }}
                >
                  <option value="All">All Priorities</option>
                  {PRIORITIES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>

                <select
                  className="select"
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  style={{ width: 170 }}
                >
                  <option value="All">All Categories</option>
                  {CATEGORIES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>

                <select
                  className="select"
                  value={filterPlatform}
                  onChange={(e) => setFilterPlatform(e.target.value)}
                  style={{ width: 180 }}
                >
                  <option value="All">All Platforms</option>
                  {PLATFORMS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>

                <select
                  className="select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{ width: 150 }}
                >
                  <option value="createdAt">Newest</option>
                  <option value="votes">Most votes</option>
                  <option value="priority">Priority</option>
                  <option value="aging">Oldest first</option>
                </select>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <span style={{ color: "#667085", fontSize: 14 }}>
              {filtered.length} issue{filtered.length === 1 ? "" : "s"}
            </span>
            <button
              className="btn btn-primary"
              onClick={() => setShowForm((prev) => !prev)}
            >
              + Report issue
            </button>
          </div>

          {showForm ? (
            <div className="card" style={{ padding: 20, marginBottom: 14 }}>
              <h3 style={{ marginTop: 0 }}>Report an issue</h3>

              <div
                className="grid-2"
                style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}
              >
                <div>
                  <label className="label">Your name</label>
                  <input
                    className="field"
                    value={form.submitterName}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        submitterName: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="label">Your email</label>
                  <input
                    className="field"
                    type="email"
                    value={form.submitter}
                    disabled
                  />
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <label className="label">Issue title</label>
                <input
                  className="field"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="Brief description of the problem"
                />
              </div>

              <div
                className="grid-2"
                style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}
              >
                <div>
                  <label className="label">Platform</label>
                  <select
                    className="select"
                    value={form.platform}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        platform: e.target.value as IssuePlatform,
                      }))
                    }
                  >
                    {PLATFORMS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Category</label>
                  <select
                    className="select"
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                  >
                    {CATEGORIES.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                className="grid-2"
                style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}
              >
                <div>
                  <label className="label">Priority</label>
                  <select
                    className="select"
                    value={form.priority}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, priority: e.target.value }))
                    }
                  >
                    {PRIORITIES.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Attachments</label>
                  <input
                    className="field"
                    type="file"
                    multiple
                    onChange={handleFileChange}
                  />
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 12,
                      color: "#667085",
                    }}
                  >
                    Optional. Attach screenshots, exports, or other supporting
                    files.
                  </p>
                </div>
              </div>

              {files.length ? (
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {files.map((file) => (
                    <span
                      key={`${file.name}-${file.size}`}
                      className="badge"
                      style={{ background: "#f2f4f7", color: "#344054" }}
                    >
                      {file.name}
                    </span>
                  ))}
                </div>
              ) : null}

              <div style={{ marginTop: 12 }}>
                <label className="label">Description</label>
                <textarea
                  className="textarea"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Describe the issue in detail — steps to reproduce, expected vs actual behavior..."
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button
                  className="btn btn-primary"
                  onClick={submitIssue}
                  disabled={busyAction === "submit"}
                >
                  {busyAction === "submit" ? "Submitting..." : "Submit issue"}
                </button>
                <button className="btn" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <p
              style={{
                color: "#667085",
                textAlign: "center",
                padding: "36px 0",
              }}
            >
              No issues match your filters.
            </p>
          ) : (
            filtered.map((i) => <IssueCard key={i.id} issue={i} />)
          )}
        </>
      ) : null}

      {view === "list" && liveSelected ? (
        <div>
          <button
            className="btn"
            onClick={backToList}
            style={{ marginBottom: 14 }}
          >
            ← Back to list
          </button>

          <div className="grid-2">
            <div className="card" style={{ padding: 22 }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                <Badge
                  label={liveSelected.status}
                  color={statusColor[liveSelected.status]}
                  bg={statusBg[liveSelected.status]}
                />
                <Badge
                  label={liveSelected.priority}
                  color={priorityColor[liveSelected.priority]}
                  bg={priorityBg[liveSelected.priority]}
                />
                <Badge label={liveSelected.category} color="#533AB7" bg="#EEEDFE" />
                <Badge label={liveSelected.platform} color="#155eef" bg="#eff8ff" />
              </div>

              <h2 style={{ margin: 0, fontSize: 22 }}>{liveSelected.title}</h2>

              <p style={{ color: "#667085", marginTop: 8 }}>
                Submitted by {liveSelected.submitterName} ·{" "}
                {formatDate(liveSelected.createdAt)} ·{" "}
                {daysSince(liveSelected.createdAt)} days open
              </p>

              <p style={{ lineHeight: 1.7 }}>{liveSelected.description}</p>

              {liveSelected.attachments.length ? (
                <div style={{ marginBottom: 18 }}>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#344054",
                      marginBottom: 8,
                    }}
                  >
                    Attachments
                  </p>
                  <AttachmentGallery
                    attachments={liveSelected.attachments}
                    onPreview={setPreviewAttachment}
                  />
                </div>
              ) : null}

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 18,
                }}
              >
                <button
                  className="btn"
                  onClick={() => void vote(liveSelected.id)}
                  disabled={busyAction === `vote-${liveSelected.id}`}
                >
                  ▲ Vote · {liveSelected.votes} affected
                </button>

                <button
                  className="btn"
                  onClick={() => void subscribeToIssue(liveSelected.id)}
                  disabled={busyAction === `subscribe-${liveSelected.id}`}
                >
                  {liveSelected.notifyOnResolve.includes(currentUser.email)
                    ? "✓ Subscribed"
                    : "Notify me when resolved"}
                </button>
              </div>

              {liveSelected.voters.length > 0 ? (
                <div style={{ marginBottom: 20 }}>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#475467",
                      fontWeight: 700,
                    }}
                  >
                    Others with this issue ({liveSelected.voters.length})
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    {liveSelected.voters.map((v) => (
                      <span
                        key={v}
                        className="badge"
                        style={{ background: "#f2f4f7", color: "#344054" }}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div style={{ borderTop: "1px solid #eaecf0", paddingTop: 16 }}>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#344054",
                    marginTop: 0,
                  }}
                >
                  Discussion ({liveSelected.comments.length})
                </p>

                {liveSelected.comments.map((c) => (
                  <div
                    key={c.id}
                    style={{ display: "flex", gap: 10, marginBottom: 18 }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 999,
                        background: "#eef4ff",
                        color: "#155eef",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {initials(c.author)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: "0 0 4px", fontWeight: 700 }}>
                        {c.author}{" "}
                        <span
                          style={{
                            fontWeight: 400,
                            color: "#667085",
                            fontSize: 12,
                          }}
                        >
                          {formatDate(c.date)}
                        </span>
                      </p>
                      <p
                        style={{
                          margin: "0 0 8px",
                          color: "#344054",
                          lineHeight: 1.6,
                        }}
                      >
                        {c.text}
                      </p>

                      {c.attachments?.length ? (
                        <AttachmentGallery
                          attachments={c.attachments}
                          onPreview={setPreviewAttachment}
                        />
                      ) : null}
                    </div>
                  </div>
                ))}

                <div style={{ display: "grid", gap: 8 }}>
                  <textarea
                    className="textarea"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    style={{ minHeight: 84 }}
                  />

                  <div>
                    <input
                      className="field"
                      type="file"
                      multiple
                      onChange={handleCommentFileChange}
                    />
                    <p
                      style={{
                        margin: "6px 0 0",
                        fontSize: 12,
                        color: "#667085",
                      }}
                    >
                      You can attach images or files to your comment.
                    </p>
                  </div>

                  {commentFiles.length ? (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      {commentFiles.map((file) => (
                        <span
                          key={`${file.name}-${file.size}`}
                          className="badge"
                          style={{ background: "#f2f4f7", color: "#344054" }}
                        >
                          {file.name}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => void addComment(liveSelected.id)}
                      disabled={busyAction === `comment-${liveSelected.id}`}
                    >
                      Post
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {currentUser.isAdmin && (
              <div className="card" style={{ padding: 22, height: "fit-content" }}>
                <h3 style={{ marginTop: 0 }}>Admin actions</h3>

                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontWeight: 700, marginTop: 0 }}>Change status</p>
                  <div style={{ display: "grid", gap: 8 }}>
                    {STATUSES.map((st) => (
                      <button
                        key={st}
                        className="btn"
                        onClick={() => void changeStatus(liveSelected.id, st)}
                        disabled={busyAction === `status-${liveSelected.id}`}
                        style={{
                          justifyContent: "flex-start",
                          background:
                            liveSelected.status === st
                              ? statusBg[st]
                              : undefined,
                          color:
                            liveSelected.status === st
                              ? statusColor[st]
                              : undefined,
                          borderColor:
                            liveSelected.status === st
                              ? statusColor[st]
                              : undefined,
                        }}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p style={{ fontWeight: 700, marginTop: 0 }}>
                    Manage subscribers
                  </p>
                  <p style={{ color: "#667085", fontSize: 13, marginTop: 0 }}>
                    Add any valid company email or remove existing subscribers.
                  </p>

                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <input
                      className="field"
                      type="email"
                      value={adminSubscriberEmail}
                      onChange={(e) => setAdminSubscriberEmail(e.target.value)}
                      placeholder={`Enter subscriber email (${allowedDomainsLabel()})`}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={() => void addAdminSubscriber(liveSelected)}
                      disabled={busyAction === `followers-${liveSelected.id}`}
                    >
                      Add
                    </button>
                  </div>

                  {liveSelected.notifyOnResolve.length === 0 ? (
                    <p style={{ color: "#667085", fontSize: 13 }}>
                      No subscribers yet.
                    </p>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {liveSelected.notifyOnResolve.map((email) => (
                        <div
                          key={email}
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <div
                            className="btn"
                            style={{
                              flex: 1,
                              justifyContent: "space-between",
                              background: "#ecfdf3",
                              color: "#027a48",
                              borderColor: "#abefc6",
                              cursor: "default",
                            }}
                          >
                            <span>{email}</span>
                            <span>Subscriber</span>
                          </div>

                          <button
                            className="btn"
                            onClick={() =>
                              void removeAdminSubscriber(liveSelected, email)
                            }
                            disabled={busyAction === `followers-${liveSelected.id}`}
                            style={{
                              color: "#b42318",
                              borderColor: "#fecdca",
                              background: "#fef3f2",
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {view === "aging" ? (
        <div>
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <button
              type="button"
              className="card"
              onClick={() => goToFilteredList("active")}
              style={{
                padding: 16,
                background: "#eff8ff",
                textAlign: "left",
                border: "1px solid #b2ddff",
                cursor: "pointer",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#155eef",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                Open issues
              </p>
              <h2 style={{ margin: "8px 0 0", fontSize: 28 }}>
                {activeIssues.length}
              </h2>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#475467" }}>
                Click to view all open and in-progress issues
              </p>
            </button>

            <div className="card" style={{ padding: 16, background: "#fffaeb" }}>
              <p
                style={{
                  margin: 0,
                  color: "#b54708",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                Avg age (days)
              </p>
              <h2 style={{ margin: "8px 0 0", fontSize: 28 }}>{avgAge}</h2>
            </div>

            <button
              type="button"
              className="card"
              onClick={() => goToFilteredList("resolved")}
              style={{
                padding: 16,
                background: "#ecfdf3",
                textAlign: "left",
                border: "1px solid #abefc6",
                cursor: "pointer",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "#067647",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                Resolved
              </p>
              <h2 style={{ margin: "8px 0 0", fontSize: 28 }}>
                {resolvedIssues.length}
              </h2>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#475467" }}>
                Click to view all resolved issues
              </p>
            </button>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ marginTop: 0 }}>Open issues aging report</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#475467", fontSize: 13 }}>
                    <th style={{ padding: "10px 8px" }}>Title</th>
                    <th style={{ padding: "10px 8px" }}>Platform</th>
                    <th style={{ padding: "10px 8px" }}>Priority</th>
                    <th style={{ padding: "10px 8px" }}>Status</th>
                    <th style={{ padding: "10px 8px" }}>Age</th>
                  </tr>
                </thead>
                <tbody>
                  {activeIssues
                    .sort(
                      (a, b) => daysSince(b.createdAt) - daysSince(a.createdAt)
                    )
                    .map((issue) => (
                      <tr
                        key={issue.id}
                        style={{
                          borderTop: "1px solid #eaecf0",
                          cursor: "pointer",
                        }}
                        onClick={() => openIssue(issue)}
                      >
                        <td style={{ padding: "12px 8px", fontWeight: 600 }}>
                          {issue.title}
                        </td>
                        <td style={{ padding: "12px 8px" }}>{issue.platform}</td>
                        <td style={{ padding: "12px 8px" }}>{issue.priority}</td>
                        <td style={{ padding: "12px 8px" }}>{issue.status}</td>
                        <td style={{ padding: "12px 8px" }}>
                          {daysSince(issue.createdAt)} days
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}