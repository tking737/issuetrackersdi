import { useState, useMemo } from "react";

const INITIAL_ISSUES = [
  { id: 1, title: "Login page not loading on IE11", category: "Bug", status: "Open", priority: "High", submitter: "jane.doe@company.com", submitterName: "Jane Doe", description: "Users on IE11 cannot access the login page. Blank screen shown.", votes: 4, voters: ["tom@company.com","sara@company.com","mike@company.com","lisa@company.com"], comments: [{author:"Tom Chen", text:"Confirmed on my machine too.", date:"2026-03-10"}], createdAt: "2026-03-08", resolvedAt: null, notifyOnResolve: ["jane.doe@company.com","tom@company.com"] },
  { id: 2, title: "Export to CSV missing department column", category: "Bug", status: "In Progress", priority: "Medium", submitter: "mike.r@company.com", submitterName: "Mike Rodriguez", description: "When exporting reports, the department column is absent from the CSV file.", votes: 7, voters: ["jane.doe@company.com","sara@company.com","lisa@company.com","amy@company.com","bob@company.com","carl@company.com","dana@company.com"], comments: [], createdAt: "2026-03-01", resolvedAt: null, notifyOnResolve: ["mike.r@company.com"] },
  { id: 3, title: "Dashboard loads slowly after 5PM", category: "Performance", status: "Open", priority: "Low", submitter: "sara.t@company.com", submitterName: "Sara Thompson", description: "Dashboard takes 15–20 seconds to load after 5PM each day.", votes: 2, voters: ["john@company.com","pat@company.com"], comments: [{author:"Sara Thompson", text:"Seems to happen every day around the same time.", date:"2026-03-20"}], createdAt: "2026-03-18", resolvedAt: null, notifyOnResolve: ["sara.t@company.com"] },
  { id: 4, title: "Password reset email not arriving", category: "Bug", status: "Resolved", priority: "High", submitter: "lisa.k@company.com", submitterName: "Lisa Kim", description: "Password reset emails are going to spam or not arriving at all.", votes: 12, voters: [], comments: [{author:"IT Team", text:"Fixed — DKIM records updated.", date:"2026-03-22"}], createdAt: "2026-02-20", resolvedAt: "2026-03-22", notifyOnResolve: ["lisa.k@company.com"] },
  { id: 5, title: "Cannot attach files larger than 2MB", category: "Feature Request", status: "Open", priority: "Medium", submitter: "tom.c@company.com", submitterName: "Tom Chen", description: "The system rejects file attachments over 2MB. We need at least 10MB support.", votes: 9, voters: ["jane.doe@company.com","mike.r@company.com","sara.t@company.com","bob@company.com","carl@company.com","dana@company.com","eve@company.com","frank@company.com","gina@company.com"], comments: [], createdAt: "2026-02-15", resolvedAt: null, notifyOnResolve: ["tom.c@company.com"] },
];

const CATEGORIES = ["Bug", "Performance", "Feature Request", "Question", "Other"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const STATUSES = ["Open", "In Progress", "Resolved"];

const statusColor = { "Open": "#378ADD", "In Progress": "#BA7517", "Resolved": "#3B6D11" };
const statusBg = { "Open": "#E6F1FB", "In Progress": "#FAEEDA", "Resolved": "#EAF3DE" };
const priorityColor = { "Low": "#5F5E5A", "Medium": "#BA7517", "High": "#993C1D", "Critical": "#A32D2D" };
const priorityBg = { "Low": "#F1EFE8", "Medium": "#FAEEDA", "High": "#FAECE7", "Critical": "#FCEBEB" };

function daysSince(dateStr) {
  const d = new Date(dateStr);
  const now = new Date("2026-03-31");
  return Math.floor((now - d) / 86400000);
}

function agingColor(days) {
  if (days > 30) return "#A32D2D";
  if (days > 14) return "#BA7517";
  return "#3B6D11";
}

function Badge({ label, color, bg }) {
  return <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: bg, color, whiteSpace: "nowrap" }}>{label}</span>;
}

function initials(name) {
  return name.split(" ").map(p => p[0]).join("").slice(0,2).toUpperCase();
}

export default function App() {
  const [issues, setIssues] = useState(INITIAL_ISSUES);
  const [view, setView] = useState("list");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [currentUser] = useState("current.user@company.com");
  const [currentUserName] = useState("Current User");
  const [showForm, setShowForm] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [notification, setNotification] = useState(null);
  const [form, setForm] = useState({ title:"", category:"Bug", priority:"Medium", description:"", submitterName:"", submitter:"" });
  const [sortBy, setSortBy] = useState("createdAt");

  const showNotif = (msg, type="success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const filtered = useMemo(() => {
    return issues.filter(i => {
      const q = search.toLowerCase();
      const matchSearch = !q || i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || i.submitterName.toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
      const matchStatus = filterStatus === "All" || i.status === filterStatus;
      const matchPriority = filterPriority === "All" || i.priority === filterPriority;
      const matchCategory = filterCategory === "All" || i.category === filterCategory;
      return matchSearch && matchStatus && matchPriority && matchCategory;
    }).sort((a,b) => {
      const aResolved = a.status === "Resolved" ? 1 : 0;
      const bResolved = b.status === "Resolved" ? 1 : 0;
      if (aResolved !== bResolved) return aResolved - bResolved;
      if (sortBy === "votes") return b.votes - a.votes;
      if (sortBy === "priority") return PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority);
      if (sortBy === "aging") return daysSince(a.createdAt) < daysSince(b.createdAt) ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [issues, search, filterStatus, filterPriority, filterCategory, sortBy]);

  const openIssues = issues.filter(i => i.status !== "Resolved");
  const resolvedIssues = issues.filter(i => i.status === "Resolved");
  const avgAge = openIssues.length ? Math.round(openIssues.reduce((s,i) => s + daysSince(i.createdAt), 0) / openIssues.length) : 0;

  const submitIssue = () => {
    if (!form.title.trim() || !form.submitterName.trim() || !form.submitter.trim()) {
      showNotif("Please fill in all required fields.", "error"); return;
    }
    const newIssue = {
      id: Math.max(...issues.map(i=>i.id)) + 1,
      ...form,
      status: "Open",
      votes: 0,
      voters: [],
      comments: [],
      createdAt: "2026-03-31",
      resolvedAt: null,
      notifyOnResolve: [form.submitter],
    };
    setIssues(prev => [newIssue, ...prev]);
    setForm({ title:"", category:"Bug", priority:"Medium", description:"", submitterName:"", submitter:"" });
    setShowForm(false);
    showNotif("Issue submitted successfully.");
  };

  const vote = (issueId) => {
    setIssues(prev => prev.map(i => {
      if (i.id !== issueId) return i;
      const alreadyVoted = i.voters.includes(currentUser);
      return alreadyVoted
        ? { ...i, votes: i.votes - 1, voters: i.voters.filter(v => v !== currentUser) }
        : { ...i, votes: i.votes + 1, voters: [...i.voters, currentUser] };
    }));
  };

  const addComment = (issueId) => {
    if (!newComment.trim()) return;
    setIssues(prev => prev.map(i => {
      if (i.id !== issueId) return i;
      return { ...i, comments: [...i.comments, { author: currentUserName, text: newComment, date: "2026-03-31" }] };
    }));
    setNewComment("");
  };

  const changeStatus = (issueId, newStatus) => {
    setIssues(prev => prev.map(i => {
      if (i.id !== issueId) return i;
      const updated = { ...i, status: newStatus, resolvedAt: newStatus === "Resolved" ? "2026-03-31" : null };
      if (newStatus === "Resolved") {
        showNotif(`Email notifications sent to ${updated.notifyOnResolve.length} subscriber(s).`);
      }
      return updated;
    }));
    if (selectedIssue?.id === issueId) setSelectedIssue(prev => ({ ...prev, status: newStatus }));
  };

  const subscribeToIssue = (issueId) => {
    setIssues(prev => prev.map(i => {
      if (i.id !== issueId) return i;
      const already = i.notifyOnResolve.includes(currentUser);
      showNotif(already ? "Unsubscribed from notifications." : "You'll be notified when this is resolved.");
      return { ...i, notifyOnResolve: already ? i.notifyOnResolve.filter(e => e !== currentUser) : [...i.notifyOnResolve, currentUser] };
    }));
  };

  const s = { fontFamily: "inherit" };

  const IssueCard = ({ issue, onClick }) => {
    const age = daysSince(issue.createdAt);
    const voted = issue.voters.includes(currentUser);
    return (
      <div onClick={onClick} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "14px 16px", cursor: "pointer", marginBottom: 8, transition: "border-color 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = "var(--color-border-secondary)"}
        onMouseLeave={e => e.currentTarget.style.borderColor = "var(--color-border-tertiary)"}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div onClick={e => { e.stopPropagation(); vote(issue.id); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 36, cursor: "pointer", paddingTop: 2 }}>
            <span style={{ fontSize: 16, color: voted ? "#378ADD" : "var(--color-text-tertiary)", lineHeight: 1 }}>▲</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: voted ? "#378ADD" : "var(--color-text-secondary)" }}>{issue.votes}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)", marginRight: 4 }}>{issue.title}</span>
              <Badge label={issue.status} color={statusColor[issue.status]} bg={statusBg[issue.status]} />
              <Badge label={issue.priority} color={priorityColor[issue.priority]} bg={priorityBg[issue.priority]} />
              <Badge label={issue.category} color="#533AB7" bg="#EEEDFE" />
            </div>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{issue.description}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>By {issue.submitterName}</span>
              <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{issue.comments.length} comment{issue.comments.length !== 1 ? "s" : ""}</span>
              {issue.status !== "Resolved" && <span style={{ fontSize: 11, fontWeight: 500, color: agingColor(age) }}>{age}d open</span>}
              {issue.status === "Resolved" && <span style={{ fontSize: 11, color: "#3B6D11" }}>Resolved {issue.resolvedAt}</span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const IssueDetail = ({ issue }) => {
    const live = issues.find(i => i.id === issue.id) || issue;
    const age = daysSince(live.createdAt);
    const voted = live.voters.includes(currentUser);
    const subscribed = live.notifyOnResolve.includes(currentUser);
    return (
      <div>
        <button onClick={() => setSelectedIssue(null)} style={{ ...s, marginBottom: 16, fontSize: 13, color: "var(--color-text-secondary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>← Back to list</button>
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "20px 22px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            <Badge label={live.status} color={statusColor[live.status]} bg={statusBg[live.status]} />
            <Badge label={live.priority} color={priorityColor[live.priority]} bg={priorityBg[live.priority]} />
            <Badge label={live.category} color="#533AB7" bg="#EEEDFE" />
          </div>
          <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 500, color: "var(--color-text-primary)" }}>{live.title}</h2>
          <p style={{ fontSize: 12, color: "var(--color-text-tertiary)", margin: "0 0 14px" }}>Submitted by {live.submitterName} · {live.createdAt} · {age} days open</p>
          <p style={{ fontSize: 14, color: "var(--color-text-primary)", lineHeight: 1.7, margin: "0 0 20px" }}>{live.description}</p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
            <button onClick={() => vote(live.id)} style={{ ...s, fontSize: 13, padding: "6px 14px", borderRadius: "var(--border-radius-md)", border: `0.5px solid ${voted ? "#378ADD" : "var(--color-border-secondary)"}`, background: voted ? "#E6F1FB" : "transparent", color: voted ? "#185FA5" : "var(--color-text-primary)", cursor: "pointer", fontWeight: 500 }}>
              ▲ {voted ? "Voted" : "Vote"} · {live.votes} {live.votes === 1 ? "person" : "people"} affected
            </button>
            <button onClick={() => subscribeToIssue(live.id)} style={{ ...s, fontSize: 13, padding: "6px 14px", borderRadius: "var(--border-radius-md)", border: `0.5px solid var(--color-border-secondary)`, background: subscribed ? "#EAF3DE" : "transparent", color: subscribed ? "#3B6D11" : "var(--color-text-primary)", cursor: "pointer" }}>
              {subscribed ? "✓ Subscribed" : "Notify me when resolved"}
            </button>
          </div>

          {live.voters.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 6px", fontWeight: 500 }}>Others with this issue ({live.voters.length})</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {live.voters.map(v => <span key={v} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)" }}>{v}</span>)}
              </div>
            </div>
          )}

          <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 16, marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", margin: "0 0 10px" }}>Update status (admin)</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {STATUSES.map(st => (
                <button key={st} onClick={() => changeStatus(live.id, st)} style={{ ...s, fontSize: 12, padding: "5px 12px", borderRadius: "var(--border-radius-md)", border: `0.5px solid ${live.status === st ? statusColor[st] : "var(--color-border-secondary)"}`, background: live.status === st ? statusBg[st] : "transparent", color: live.status === st ? statusColor[st] : "var(--color-text-secondary)", cursor: "pointer" }}>{st}</button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>Discussion ({live.comments.length})</p>
            {live.comments.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, color: "#533AB7", flexShrink: 0 }}>{initials(c.author)}</div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{c.author} <span style={{ fontWeight: 400, fontSize: 11, color: "var(--color-text-tertiary)" }}>{c.date}</span></p>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.6 }}>{c.text}</p>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment..." rows={2} style={{ ...s, flex: 1, fontSize: 13, padding: "8px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", resize: "none" }} />
              <button onClick={() => addComment(live.id)} style={{ ...s, fontSize: 13, padding: "0 14px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer", alignSelf: "flex-end", height: 36 }}>Post</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AgingReport = () => {
    const open = issues.filter(i => i.status !== "Resolved").sort((a,b) => daysSince(b.createdAt) - daysSince(a.createdAt));
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          {[["Open issues", openIssues.length, "#378ADD", "#E6F1FB"], ["Avg age (days)", avgAge, "#BA7517", "#FAEEDA"], ["Resolved", resolvedIssues.length, "#3B6D11", "#EAF3DE"]].map(([l,v,c,bg]) => (
            <div key={l} style={{ background: bg, borderRadius: "var(--border-radius-md)", padding: "12px 14px" }}>
              <p style={{ margin: 0, fontSize: 11, color: c, fontWeight: 500 }}>{l}</p>
              <p style={{ margin: "2px 0 0", fontSize: 24, fontWeight: 500, color: c }}>{v}</p>
            </div>
          ))}
        </div>
        <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--color-background-secondary)" }}>
                {["Issue", "Priority", "Status", "Submitted", "Age"].map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 500, fontSize: 12, color: "var(--color-text-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {open.map(issue => {
                const age = daysSince(issue.createdAt);
                return (
                  <tr key={issue.id} onClick={() => { setSelectedIssue(issue); setView("list"); }} style={{ cursor: "pointer", borderBottom: "0.5px solid var(--color-border-tertiary)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-secondary)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "10px 14px", color: "var(--color-text-primary)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{issue.title}</td>
                    <td style={{ padding: "10px 14px" }}><Badge label={issue.priority} color={priorityColor[issue.priority]} bg={priorityBg[issue.priority]} /></td>
                    <td style={{ padding: "10px 14px" }}><Badge label={issue.status} color={statusColor[issue.status]} bg={statusBg[issue.status]} /></td>
                    <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{issue.createdAt}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 500, color: agingColor(age), whiteSpace: "nowrap" }}>{age}d</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 8 }}>Red = 30+ days · Amber = 14–30 days · Green = under 14 days</p>
      </div>
    );
  };

  const SubmitForm = () => (
    <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "20px 22px" }}>
      <h3 style={{ margin: "0 0 18px", fontSize: 16, fontWeight: 500 }}>Report an issue</h3>
      {[["Your name", "submitterName", "text", "Jane Doe"], ["Your email", "submitter", "email", "you@company.com"], ["Issue title", "title", "text", "Brief description of the problem"]].map(([label, key, type, ph]) => (
        <div key={key} style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 5 }}>{label}</label>
          <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} style={{ ...s, width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", boxSizing: "border-box" }} />
        </div>
      ))}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        {[["Category", "category", CATEGORIES], ["Priority", "priority", PRIORITIES]].map(([label, key, opts]) => (
          <div key={key}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 5 }}>{label}</label>
            <select value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={{ ...s, width: "100%", fontSize: 13, padding: "7px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 5 }}>Description</label>
        <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} placeholder="Describe the issue in detail — steps to reproduce, expected vs actual behavior..." style={{ ...s, width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", resize: "vertical", boxSizing: "border-box" }} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={submitIssue} style={{ ...s, fontSize: 13, padding: "8px 20px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-primary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer", fontWeight: 500 }}>Submit issue</button>
        <button onClick={() => setShowForm(false)} style={{ ...s, fontSize: 13, padding: "8px 16px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-tertiary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "1rem 0", fontFamily: "inherit", maxWidth: 760, margin: "0 auto" }}>
      {notification && (
        <div style={{ position: "sticky", top: 8, zIndex: 10, background: notification.type === "error" ? "#FCEBEB" : "#EAF3DE", border: `0.5px solid ${notification.type === "error" ? "#F09595" : "#97C459"}`, borderRadius: "var(--border-radius-md)", padding: "10px 16px", marginBottom: 14, fontSize: 13, color: notification.type === "error" ? "#791F1F" : "#27500A", fontWeight: 500 }}>
          {notification.type === "error" ? "⚠ " : "✓ "}{notification.msg}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 500, color: "var(--color-text-primary)" }}>Issue tracker</h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-tertiary)" }}>Software implementation · internal portal</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["list", "Issues"], ["aging", "Punch list & aging"]].map(([v, l]) => (
            <button key={v} onClick={() => { setView(v); setSelectedIssue(null); }} style={{ ...s, fontSize: 13, padding: "6px 14px", borderRadius: "var(--border-radius-md)", border: `0.5px solid ${view === v ? "var(--color-border-primary)" : "var(--color-border-secondary)"}`, background: view === v ? "var(--color-background-secondary)" : "transparent", color: "var(--color-text-primary)", cursor: "pointer", fontWeight: view === v ? 500 : 400 }}>{l}</button>
          ))}
        </div>
      </div>

      {view === "list" && !selectedIssue && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search issues..." style={{ ...s, flex: 1, minWidth: 140, fontSize: 13, padding: "7px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }} />
            {[["filterStatus", STATUSES, filterStatus, setFilterStatus, "Status", "All Statuses"], ["filterPriority", PRIORITIES, filterPriority, setFilterPriority, "Priority", "All Priorities"], ["filterCategory", CATEGORIES, filterCategory, setFilterCategory, "Category", "All Categories"]].map(([k, opts, val, set, ph, allLabel]) => (
              <select key={k} value={val} onChange={e => set(e.target.value)} style={{ ...s, fontSize: 13, padding: "7px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
                <option value="All">{allLabel}</option>
                {opts.map(o => <option key={o}>{o}</option>)}
              </select>
            ))}
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ ...s, fontSize: 13, padding: "7px 10px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
              <option value="createdAt">Newest</option>
              <option value="votes">Most votes</option>
              <option value="priority">Priority</option>
              <option value="aging">Oldest first</option>
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>{filtered.length} issue{filtered.length !== 1 ? "s" : ""}</span>
            <button onClick={() => setShowForm(!showForm)} style={{ ...s, fontSize: 13, padding: "6px 16px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-primary)", background: "transparent", color: "var(--color-text-primary)", cursor: "pointer", fontWeight: 500 }}>+ Report issue</button>
          </div>
          {showForm && <div style={{ marginBottom: 14 }}><SubmitForm /></div>}
          {filtered.length === 0 ? <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", textAlign: "center", padding: "40px 0" }}>No issues match your filters.</p> : filtered.map(i => <IssueCard key={i.id} issue={i} onClick={() => setSelectedIssue(i)} />)}
        </>
      )}

      {view === "list" && selectedIssue && <IssueDetail issue={selectedIssue} />}
      {view === "aging" && <AgingReport />}
    </div>
  );
}
