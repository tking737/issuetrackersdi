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

export async function sendResolvedEmails(options: {
  recipients: string[];
  issueTitle: string;
  issueId: string;
  appUrl?: string;
}) {
  const recipients = Array.from(
    new Set(
      options.recipients
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  if (!recipients.length) return 0;

  const { sender } = getGraphConfig();
  const accessToken = await getGraphAccessToken();

  const issueUrl = `${getBaseUrl(options.appUrl)}/?issue=${encodeURIComponent(
    options.issueId
  )}`;

  let sent = 0;

  for (const recipient of recipients) {
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
            subject: `Resolved: ${options.issueTitle}`,
            body: {
              contentType: "HTML",
              content: `<p>Your issue <strong>${options.issueTitle}</strong> has been marked as resolved.</p><p><a href="${issueUrl}">Open the ticket</a></p>`,
            },
            toRecipients: [{ emailAddress: { address: recipient } }],
          },
          saveToSentItems: true,
        }),
      }
    );

    if (mailRes.ok) sent += 1;
  }

  return sent;
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

  const { sender } = getGraphConfig();
  const accessToken = await getGraphAccessToken();

  const issueUrl = `${getBaseUrl(options.appUrl)}/?issue=${encodeURIComponent(
    options.issueId
  )}`;

  let sent = 0;

  for (const recipient of adminEmails) {
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
            subject: `New Issue: ${options.issueTitle}`,
            body: {
              contentType: "HTML",
              content: `<p>A new issue has been reported.</p><p><strong>Title:</strong> ${options.issueTitle}</p><p><strong>Submitted by:</strong> ${options.submitter}</p><p><a href="${issueUrl}">Open the ticket</a></p>`,
            },
            toRecipients: [{ emailAddress: { address: recipient } }],
          },
          saveToSentItems: true,
        }),
      }
    );

    if (mailRes.ok) sent += 1;
  }

  return sent;
}