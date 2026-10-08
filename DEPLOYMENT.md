# Deploying OP Documents

## Release checks

Use Node.js 22.13 or newer. Install the locked dependencies with `npm ci`.
Set `VITE_APPS_SCRIPT_URL` in `.env.local` (or your hosting build environment) to
the production Apps Script web app URL ending in `/exec`, then run:

```sh
npm run check
```

This runs all tests, ESLint and the production build. A production build fails
if the deployment URL is missing or malformed. The GitHub validation workflow
uses a placeholder URL only for compilation; deployment must use your real URL.
Vite embeds `VITE_` variables in public JavaScript: use them for configuration,
never passwords or secrets. Changing this URL requires rebuilding the frontend.

## Apps Script

Newly created documents save only to their form tab (`EX_Memo`, `Spe_Ord`,
`Trav_Ord`, `Auth_Travel`, or `Cert_Travel`). The ID cell note stores the file
link and workflow metadata; preserve that note when editing rows manually.
Category logs receive the document only after Gmail confirms a successful send.
Email recovery retries finish logging without sending another email.
New creations never add a row to `MAIN Files`; PDF uploads still use that tab.
Existing `MAIN Files` records remain supported and are not migrated or deleted.
Deploy the updated `Code.gs` as a new version of the existing web app deployment
to enable this behavior.

1. Back up the current script and spreadsheet.
2. Copy `google-apps-script/Code.gs` into the existing Apps Script project.
3. Enable the manifest in Project Settings. Merge the supplied
   `google-apps-script/appsscript.json` with the existing manifest, retaining any
   existing project services/settings. It enables Gmail API v1 as `Gmail`.
4. Run `checkCreateDocumentSetup` and `checkEmailSetup` as the deployment owner.
   Authorize the requested services. These checks do not send email.
5. Update the **existing** web app deployment to a new version, executing as
   the owner. Its access setting must allow the portal's browsers to call the
   web app; application sessions and roles authorize protected operations.
6. Put that deployment's `/exec` URL in the frontend build configuration.

Email uses the deployment owner's Gmail account, with the signed-in admin as
Reply-To. Confirm the owner's Drive/template access and available Gmail quota
before release. Apps Script logs contain backend failure details.

## Frontend hosting

Deploy the contents of `dist/` to an HTTPS static host at the site root. The
frontend calls Google directly in production; the local `/apps-script` proxy
exists only for development. Serve `.mjs` files as JavaScript so the PDF worker
can load. Enable gzip or Brotli at the host.

Configure the host's response headers:

| Resource | Cache-Control |
| --- | --- |
| `/assets/*` (hashed build files) | `public, max-age=31536000, immutable` |
| `/index.html` and HTML navigation | `no-cache` |
| Unversioned public images | `public, max-age=3600` |

Keep older hashed assets available during a release transition so open tabs can
finish loading their lazy modules. Deploy HTML and assets together. If a CSP is
configured, allow the Google script/redirect endpoints for connections and the
site's PDF worker. Test the actual production origin, including Google redirects.

## Preview and email behavior

Dashboard totals load inline without blocking navigation or document creation.
Successful login supplies the authenticated account, avoiding an immediate
duplicate account request. Role/session checks still run on focus and each minute;
restored sessions are checked immediately. Server overview totals are cached for
30 seconds after authorization, invalidated by document mutations, and bypassed
by Refresh overview. Existing charts remain visible during refresh.

Overview and Documents share a 30-second server registry cache so navigating
between them does not repeat the six-tab spreadsheet scan. Authorization still
runs before serving cached records, and document mutations invalidate both caches.
Manual refresh bypasses the cache. Registers too large for the cache use live
reads. Publish the updated `Code.gs` as a **new version of the existing Apps Script
deployment** to activate this optimization; redeploying Vercel alone cannot do so.

- Saved form previews and PDF export load independently. Closing a preview
  releases its object URL and cancels rendering; it does not cancel a shared export.
- Browser PDF caching lasts two minutes, holds at most five entries and caps
  estimated retained base64 memory at 24 MB. It is isolated by session and record
  revision, cleared on logout/account changes, and invalidated by Retry preview.
- Native PDF exports use an optional ten-minute Drive-revision cache. Evicted
  chunks or unavailable caches fall back to export. An edit during export prevents
  storing that result under the older revision. Uploaded PDFs need no conversion.
- Long PDFs render pages near the viewport, release offscreen canvases, and cap
  each canvas at approximately four million pixels.
- Email attachment preparation warms the server cache without transferring
  attachment bytes to the browser. The sender exports/attaches the registered
  Drive file and rejects a changed preparation revision. Attachments above 20 MB
  are rejected. Downloads/previews accept PDFs up to 25 MB.
- Read requests have bounded retries for temporary transport/deployment failures.
  Mutations are not automatically retried. Most reads time out after 30 seconds;
  PDF preparation and document mutations have a 90-second client deadline.
- Each email form has a stable request ID. An ambiguous send response triggers a
  status check for that same request, never an automatic second send. If delivery
  remains uncertain, check the sender's Sent mailbox before starting a new form.
- While a send is pending, the browser checks its receipt every three seconds
  (each status request has a ten-second deadline). A persisted Gmail confirmation
  can end the send animation while the original execution finishes spreadsheet
  logging. The status check does not wait for the original execution's lock when
  a confirmed receipt is available. This confirms Gmail acceptance, not inbox arrival.

Browser-cached PDFs can remain visible briefly after an external Drive edit;
Retry preview fetches fresh data. Sending always checks the registered file on
the server. Caches improve speed but do not bypass authorization or guarantee
Google service availability.

## Production acceptance

Deploy the latest `google-apps-script/Code.gs` as a new version of the existing
web app before using Send PDF. The frontend checks `previewEmailPdfVersion: 1`
and asks for a backend update if the deployed version lacks this support.
For saved forms, Save as PDF and Send PDF use the same PDF captured from the
preview, including its signature and approval timestamp. Uploaded PDFs continue
to use the registered Drive file. Preview attachments are limited to 20 MB and
must match the current registered document revision.

Use a test document and an inbox you control:

1. Sign in and open each document category. Create and edit each supported type.
2. Open a saved form and an uploaded multipage PDF. Close/reopen, scroll, download,
   and retry preview. Confirm the downloaded PDF matches the saved document.
3. Approve the test record. Prepare and send its PDF with To and CC. Verify the
   attachment in the received email, Reply-To, the sender's Sent mailbox, OUT
   status, activity entry and edit lock.
4. Interrupt the connection during a send. Reuse the same form/request and confirm
   it recovers the result without sending twice. Check failed/oversized attachments.
5. Verify public document lookup, logout and inactive-account access rejection.

Local tests and browser checks do not establish live Google delivery. Complete
these checks on the deployed frontend and backend before using real recipients.
For rollback, restore the previous Apps Script deployment version and matching
frontend artifact; retain the spreadsheet and Drive records.

Document fetching optimizations require rebuilding the frontend and deploying
`google-apps-script/Code.gs` as a new version of the existing web app. Document
polls authenticate as usual but return only a revision when the list is unchanged.
Manual Refresh always retrieves the full list. Older backends remain compatible
but continue sending all rows. Registry cache chunks expire after 30 seconds;
missing chunks fall back to live spreadsheet reads. The first list load still
reads the complete registry for existing search, filters and CSV export.

Dashboard startup optimizations require deploying the updated Code.gs and frontend.
The overview can now include the authenticated account, so restoring a session
shares one request for account validation and chart totals. Login includes an
already-cached summary when available, without scanning the registry on a cache
miss. The frontend reuses that result for up to 30 seconds; manual refresh and
document mutations invalidate it. Older deployments fall back to the separate
account request. A cold Google Apps Script execution can still take time.
