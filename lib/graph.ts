function getGraphConfig() {
  const tenantId = process.env.GRAPH_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET;
  const sender = process.env.GRAPH_SENDER_USER;

  if (!tenantId || !clientId || !clientSecret || !sender) {
    throw new Error("Graph email environment variables are missing.");
  }

  return { tenantId, clientId, clientSecret, sender };
}

async function getGraphAccessToken() {
  const { tenantId, clientId, clientSecret } = getGraphConfig();

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );

  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => "");
    throw new Error(`Failed to get Microsoft Graph access token. ${text}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token as string;
}

function getBaseUrl(appUrl?: string) {
  return (
    appUrl ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3002"
  ).replace(/\/+$/, "");
}

async function sendMail(options: {
  to: string[];
  subject: string;
  html: string;
  attachments?: Array<{
    name: string;
    contentBytesBase64: string;
    contentType: string;
  }>;
}) {
  const recipients = Array.from(
    new Set(options.to.map((value) => value.trim().toLowerCase()).filter(Boolean))
  );

  if (!recipients.length) return 0;

  const { sender } = getGraphConfig();
  const accessToken = await getGraphAccessToken();

  let sent = 0;

  for (const recipient of recipients) {
    const attachments =
      options.attachments?.map((attachment) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: attachment.name,
        contentType: attachment.contentType,
        contentBytes: attachment.contentBytesBase64,
      })) || [];

    const mailRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
        sender
      )}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: options.subject,
            body: {
              contentType: "HTML",
              content: options.html,
            },
            toRecipients: [{ emailAddress: { address: recipient } }],
            attachments,
          },
          saveToSentItems: true,
        }),
      }
    );

    if (!mailRes.ok) {
      const text = await mailRes.text().catch(() => "");
      throw new Error(`Graph sendMail failed for ${recipient}. ${text}`);
    }

    sent += 1;
  }

  return sent;
}

function escapeCsvValue(value: string | number | null | undefined) {
  const stringValue = String(value ?? "");
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildAssignedIssuesCsv(
  issues: Array<{
    id: string;
    title: string;
    platform: string;
    status: string;
    secondaryStatus: string;
    priority: string;
    createdAt: string;
  }>
) {
  const headers = [
    "Title",
    "Platform",
    "Primary Status",
    "Secondary Status",
    "Priority",
    "Created At",
    "Issue URL",
  ];

  const baseUrl = getBaseUrl();

  const rows = issues.map((issue) => [
    issue.title,
    issue.platform,
    issue.status,
    issue.secondaryStatus,
    issue.priority,
    issue.createdAt,
    `${baseUrl}/?issue=${encodeURIComponent(issue.id)}`,
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(","))
    .join("\n");
}

export async function sendResolvedEmails(options: {
  recipients: string[];
  issueTitle: string;
  issueId: string;
  appUrl?: string;
}) {
  const issueUrl = `${getBaseUrl(options.appUrl)}/?issue=${encodeURIComponent(
    options.issueId
  )}`;

  return sendMail({
    to: options.recipients,
    subject: `Resolved: ${options.issueTitle}`,
    html: `<p>Your issue <strong>${options.issueTitle}</strong> has been marked as resolved.</p><p><a href="${issueUrl}">Open the ticket</a></p>`,
  });
}

export async function sendNewIssueEmails(options: {
  issueTitle: string;
  issueId: string;
  submitter: string;
  appUrl?: string;
}) {
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.length) return 0;

  const issueUrl = `${getBaseUrl(options.appUrl)}/?issue=${encodeURIComponent(
    options.issueId
  )}`;

  return sendMail({
    to: adminEmails,
    subject: `New Issue: ${options.issueTitle}`,
    html: `<p>A new issue has been reported.</p><p><strong>Title:</strong> ${options.issueTitle}</p><p><strong>Submitted by:</strong> ${options.submitter}</p><p><a href="${issueUrl}">Open the ticket</a></p>`,
  });
}

export async function sendAddedSubscriberEmail(options: {
  recipient: string;
  issueTitle: string;
  issueId: string;
  addedBy: string;
  appUrl?: string;
}) {
  const issueUrl = `${getBaseUrl(options.appUrl)}/?issue=${encodeURIComponent(
    options.issueId
  )}`;

  return sendMail({
    to: [options.recipient],
    subject: `You were added as a subscriber: ${options.issueTitle}`,
    html: `<p>You were added as a subscriber to the issue <strong>${options.issueTitle}</strong>.</p><p><strong>Added by:</strong> ${options.addedBy}</p><p>You will receive updates when this issue is resolved.</p><p><a href="${issueUrl}">Open the ticket</a></p>`,
  });
}

export async function sendDailyAssignedIssuesEmail(options: {
  recipient: string;
  issues: Array<{
    id: string;
    title: string;
    platform: string;
    status: string;
    secondaryStatus: string;
    priority: string;
    createdAt: string;
  }>;
  appUrl?: string;
}) {
  if (!options.issues.length) return 0;

  const baseUrl = getBaseUrl(options.appUrl);

  const html = `
    <h2>Your Assigned Issues</h2>
    <p>Here is your 8:00 AM report of currently active issues assigned to you.</p>
    ${options.issues
      .map(
        (issue) => `
        <div style="margin-bottom:16px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;">
          <p style="margin:0 0 8px 0;"><strong>${issue.title}</strong></p>
          <p style="margin:0;">Platform: ${issue.platform}</p>
          <p style="margin:0;">Primary Status: ${issue.status}</p>
          <p style="margin:0;">Secondary Status: ${issue.secondaryStatus}</p>
          <p style="margin:0;">Priority: ${issue.priority}</p>
          <p style="margin:0 0 8px 0;">Created: ${issue.createdAt}</p>
          <p style="margin:0;"><a href="${baseUrl}/?issue=${encodeURIComponent(
            issue.id
          )}">Open issue</a></p>
        </div>
      `
      )
      .join("")}
    <p>A CSV export of these assigned issues is attached.</p>
  `;

  const csv = buildAssignedIssuesCsv(options.issues);
  const csvBase64 = Buffer.from(csv, "utf-8").toString("base64");

  return sendMail({
    to: [options.recipient],
    subject: "Daily assigned issues report",
    html,
    attachments: [
      {
        name: "assigned-issues-report.csv",
        contentBytesBase64: csvBase64,
        contentType: "text/csv",
      },
    ],
  });
}