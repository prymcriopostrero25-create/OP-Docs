# Workflow adaptation

The OP portal keeps its existing burgundy interface, college letterhead, document renderers, spreadsheet columns, and Drive filing structure. The reference project was read from `C:\Users\Localuser\transmittal-system`; its files were not changed.

The five categories shown in navigation, creation, and uploads are Executive Memorandum (EM), Travel Order (TO), Certification (CTA), Travel Authority (TAA), and Special Order (SO). Certification and Travel Authority retain their existing internal spreadsheet names so existing records continue to work.

## Available workflows

- Create the five document types with the existing layouts; upload PDFs into type/year folders.
- Edit the complete form for documents created with this version. Older records without stored form data retain title editing. OUT records remain locked on both client and server.
- Review, route for signature, approve, and mark OUT; review activity and user logs.
- Search, filter by date/status/type, sort, paginate, refresh, and export the filtered registry as CSV. Archive opens the completed OUT records.
- Preview and download the registered PDF, share through supported browsers, or download a PDF with a separate QR verification page. Original PDF pages are not reformatted.
- Verify a registry entry without signing in. Public verification returns only reference, type, date, and current status. It does not certify the bytes of an arbitrary PDF or expose the document body or Drive link.
- Admins can email an approved PDF with To/CC, subject, and message. Successful sends lock the record OUT. A retried request repairs registry state without sending twice. An uncertain mail result requires checking the sender mailbox before deliberately starting another send.
- Super admins can create, edit, deactivate, reset passwords, and delete accounts. Self-deletion/demotion/deactivation and removal of the last active super admin are blocked. Password handling follows the reference project's salted/peppered format, upgrading legacy passwords on successful login.
- Account roles are refreshed on window focus and every minute. Deactivation and password resets revoke older sessions. Sessions retain this portal's existing six-hour maximum (Google CacheService can evict them earlier).

## Deployment

1. Back up the current Apps Script project and spreadsheet, then replace the deployed project's `Code.gs` with this folder's version. Existing sheet schemas and IDs stay unchanged.
2. As the deployment owner, run `checkCreateDocumentSetup` and `checkEmailSetup`. The latter requests MailApp access and reads quota; it does not send email.
3. Publish a new version of the existing web-app deployment. Keep the `/exec` URL in `VITE_APPS_SCRIPT_URL` pointed at that deployment.
4. Build and deploy the frontend with `npm run build`. Generate QR PDFs from the production portal URL so the verification links point to the public site.
5. Sign in with a super-admin account and verify account creation/deactivation, each document type, approvals, public verification, and a deliberate test email to an address you control.

Email is sent by the Apps Script deployment owner's account, with the signed-in administrator as Reply-To. The email attachment is the registered PDF; the optional QR appendix is offered separately by **Save PDF with QR**. Google Docs previews retain the existing Drive access rules.

No production deployment, spreadsheet mutation, or email send was performed during local implementation. There is no CommTrack SSO integration in this portal; the reference project's host-specific SSO is not copied.

## Validation

Run `node --test tests/*.test.js`, `npm run lint`, and `npm run build`.

The existing `executiveMemorandum.test.js` has five failures also reproduced against the original committed backend: copied Travel Order allocation recovery, unavailable Travel Order master reporting, populated-document recovery reporting, native Travel Order template filling, and sheet configuration error reporting. The current renderers were preserved rather than replaced with the native template expected by those tests.

New workflow tests exercise email authorization, approval requirements, CC, quota, uncertain delivery, retry repair, public verification disclosure, session revocation, protected accounts, content editing, record filtering, and CSV escaping. Live Google services still require the deployment checks above.
