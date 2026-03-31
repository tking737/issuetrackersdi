# Internal Issue Tracker (Firebase + Microsoft Graph)

This version uses:
- Firebase Authentication for email/password sign-in, email verification, and password reset
- Firestore for issue data
- Firebase Storage for file attachments
- Microsoft Graph `sendMail` for resolved-ticket notification emails

## 1. Install

```bash
npm install
```

## 2. Firebase setup

Create a Firebase project and enable:
- Authentication → Email/Password
- Firestore Database
- Storage

From Project settings, copy the web app config values into `.env.local`.

Create a service account in Firebase / Google Cloud and add these to `.env.local`:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`

## 3. Allowed domains and admins

Set:

```env
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=shaftdrillers.com
NEXT_PUBLIC_ADMIN_EMAILS=you@shaftdrillers.com,other.admin@shaftdrillers.com
ADMIN_EMAILS=you@shaftdrillers.com,other.admin@shaftdrillers.com
```

## 4. Microsoft Graph email setup

Use your Azure app registration that already has `Mail.Send` application permission and admin consent.

Set:

```env
GRAPH_TENANT_ID=your-tenant-id
GRAPH_CLIENT_ID=your-app-client-id
GRAPH_CLIENT_SECRET=your-client-secret
GRAPH_SENDER_USER=sdiminutes@shaftdrillers.com
```

When an issue is changed to **Resolved**, the app sends a notification email to the submitter and all subscribers.

## 5. Firebase Auth email templates

Firebase Auth sends verification and password reset emails for you.
No Resend setup is needed.

In Authentication → Settings → Authorized domains, add your dev / production domains if needed.

## 6. Run locally

```bash
npm run dev
```

## 7. Deploy

Deploy to Render, Vercel, or another Node host. Add the same environment variables there.

## Security notes

- Allowed company domains are enforced in both the browser and the API layer.
- Admin-only status changes are enforced on the API using `ADMIN_EMAILS`.
- Attachments are stored under Firebase Storage using the Firebase Admin SDK.
