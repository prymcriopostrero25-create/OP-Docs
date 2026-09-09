# Role access setup

In CREDENTIALS, keep A = EMAIL, B = NAME, C = PASSWORD and D = ROLE.
Use `user`, `admin`, or `super admin`. Blank or unknown roles receive user access.

Deploy the updated Code.gs as a new version of the existing Apps Script web app, then sign out and sign in again to load the role and session token. Log and account requests require a server-issued session (up to six hours); the server rechecks the current sheet role on each request.

Users can create draft documents. Admins can create documents and change status. Super admins additionally have Archive, Activity log, User management, User logs, and Settings access. The recent activity panel is also restricted to super admins.

Create Document and PDF uploads persist files to Drive and records to MAIN Files. Status permissions and restricted log access are enforced by the backend.

## PDF uploads

The Documents page uploads PDFs (up to 25 MB), saves them to Drive, and lists saved files from MAIN Files after reload. Its existing A1:E1 headers must be ACTIVITY, ID, DATE, SUBJECT, FILE LINKS. Links open the Drive preview in a new tab. The other document registry and dashboard sample records remain separate from this uploaded-files list.

After copying Code.gs into the spreadsheet-bound Apps Script project:
1. Code.gs uses the UPLOAD_FOLDER_ID constant for the selected folder: https://drive.google.com/drive/folders/1OVvmtvYjsp4WZz-RY7NkExyNIotO-Vji. The deploying account needs write access to this folder. Uploads reuse or create document-type/year subfolders under this root. Old UPLOAD_FOLDER_ID script properties are no longer used. Run checkUploadSetup in the editor to verify folder read access before uploading.
2. Authorize Drive access under the new account (run a read-only helper such as getDocuments in the editor if authorization is needed), then update the existing web app deployment to a new version, executing as that account.
3. Give intended preview users Viewer access to the upload folder using Drive's Share dialog. Uploads do not make documents public or change sharing permissions. Users open links while signed into a Google account with folder access.
4. Sign into the portal, choose Documents > Upload PDF, select a PDF, check the suggested document type and document year, and click Upload to folder. Verify the file in Drive, its row in MAIN Files, the Preview file link, and persistence after refreshing. Retry uses the same upload ID to avoid duplicate records after a lost response.

A live end-to-end check requires the updated Apps Script deployment and Drive authorization; local build checks cannot verify those permissions.

## Filing by document type and year

Reference folder: https://drive.google.com/drive/folders/1mqITmio0GxLSaYUIA7j1yMK4r-69F5rE
Upload root remains OP Systems: https://drive.google.com/drive/folders/1OVvmtvYjsp4WZz-RY7NkExyNIotO-Vji

The five type folders and their 2026 subfolders have been created and verified:
- Executive Memorandum / 2026
- Special Order / 2026
- Travel Order / 2026
- Authority to Travel Abroad / 2026
- Certificate of Travel / 2026

Future uploads create missing years under the selected type while holding the script upload lock. Duplicate same-name folders cause an error rather than arbitrary routing. The reference PDFs and previously uploaded root files are not migrated.

PDF.js reads text locally in the browser from up to five pages. Classification recognizes the reference headings and filename conventions, including Executive-Memo, SO No., TO104, Authority to Travel Abroad, and Certificate to Travel Abroad. Filename type labels take priority because the two supplied travel-certificate/authority PDFs each contain both forms. Year suggestions use a filename year, an unambiguous series year, or a unique year in the extracted text. Conflicting or missing years require user selection; the current year is not substituted. Scanned PDFs without text and protected PDFs allow explicit type/year selection. OCR and visual template matching are not implemented. The destination is shown for review before submission.

The server validates the type against the five allowed names and the year against 1900?2099 before any Drive writes. MAIN Files retains ACTIVITY, ID, DATE, SUBJECT, FILE LINKS in A:E. A JSON note on each new ID cell persists its type/year; legacy rows without metadata display Not classified. Preview links continue to open Drive.

Publish the updated Code.gs as a new version of the existing deployment, executing as an account with Drive write access to OP Systems. Run checkUploadWriteAccess in the editor to request authorization and test file creation if required. Existing folder creation through the connector does not prove the deployment account can write there.

Validation: npm.cmd run lint; npm.cmd run build; node --test tests/*.test.js. The Node tests mock Apps Script services; live classification/upload/preview still requires testing against the deployed script.


## Document-type sheet logs

Each new upload is logged both in MAIN Files and in its matching document-type tab. Type log tabs use exactly A = TIMESTAMP, B = ID, C = YEAR, D = FILE LINKS, with headers on row 1 and entries starting on row 2. TIMESTAMP is the upload timestamp (ISO UTC), ID is the same upload ID as MAIN Files, YEAR is the chosen document year, and FILE LINKS is a clickable Drive preview URL.

Exact tab mapping:
- Executive Memorandum -> Executive Memorandum
- Special Order -> Special Order
- Travel Order -> Travel Order
- Authority to Travel Abroad -> Authority to Travel Abroad
- Certificate of Travel -> Certificate to Travel

The server validates the target log headers before uploading. Retries reuse the same ID and can repair a missing category log for an already committed MAIN Files row. Failed new uploads attempt to remove both partial log rows before trashing the new file. Existing historical uploads are not automatically backfilled. Deploy a new version of Code.gs to enable category logging.

## Upload statuses

New uploads always start as For Review, enforced by the server. The available statuses are Draft, For Review, For Signature, Approved, and Out. Admins and super admins can change uploaded-file status; the server rechecks their account role. The status is stored in the MAIN Files ID cell note alongside type/year, retaining the existing visible sheet columns. Older uploaded rows without status metadata display For Review. A retry of an existing upload preserves its current status.

## Removing the known sample data

The UI no longer seeds demonstration documents, archive records, activity events, metrics, or pagination counts. Dashboard, category lists, and uploaded files share the live MAIN Files data. The only confirmed real record at cleanup time is SO No. 136-b, s. 2024.V Grengia.VPAA.pdf (Drive ID 1IJBqldxJJmB8B-eqhUvCK_RfmfpjhYb9), with status Out.

The connected account received HTTP 403 for deleting the sample upload and clearing its sheet entry. Its upload ID is excluded from the app while cleanup is pending. As the spreadsheet/Drive owner, paste the current Code.gs, save, and run removeKnownSamples in the editor. This moves the uploaded sample and five reference sample PDFs to trash by exact IDs, and clears only matching MAIN Files/type-log rows. It preserves the confirmed real file and all unrelated files. Refresh the app afterward. The helper does not need a web deployment to run in the editor.

Archive shows an empty state because no real archived data source is implemented. Activity shows actual registry events; fabricated approval/actor events have been removed. Create Document now saves editable Google Docs for all five document types.

## Executive Memorandum creation

Create Document saves Executive Memoranda as editable Google Docs in the existing Executive Memorandum / series-year folder. Other document types also save editable Google Docs using the existing title/reference/content fields, plus date, filing year, recipients and optional travel details. Their layout is a simple document, not a new institutional template. Existing PDF upload workflows remain unchanged. There was no existing PDF generator or Create Document preview; neither is introduced here. The existing textarea preserves paragraphs and typed bullet/numbered lines; it does not provide rich-text bold editing.

The memorandum uses the bundled public/jhcsclogo.png, an A4 portrait layout, a repeating institutional header, aligned FOR/SUBJECT/DATE fields, uppercase subject and formal date, body paragraphs, editable signatory/position, and optional CC. No template ID, logo ID, new folder ID, spreadsheet ID, or credentials are needed.

Deployment:
1. Copy the updated Code.gs into the existing Apps Script project. Authorize the added Google Docs service as the deployment account, which must also retain access to the existing Drive folder and spreadsheet. Publish a new version of the existing web app deployment.
2. Deploy the rebuilt frontend together with public/jhcsclogo.png. Keep the existing VITE_APPS_SCRIPT_URL.
3. Verify MAIN Files has ACTIVITY, ID, DATE, SUBJECT, FILE LINKS in A1:E1 and Executive Memorandum has TIMESTAMP, ID, YEAR, FILE LINKS in A1:D1.
4. Submit the supplied No. 203, series 2026 acceptance example. Check the actual Google Doc layout (including a multi-page body), editable content, Drive folder, MAIN Files row, category log, and persistence after reload. These live checks require the deployed account and are not covered by local mocks.

Creation validates the session and fields, reserves EM-year-number under the script lock, creates and formats the Google Doc, moves it to the designated folder, then writes MAIN Files and the category log. Success is returned only after MAIN Files, the full-name category log, and the creation-template tab flush. MAIN Files uses EXECUTIVE MEMORANDUM, Executive Memorandum No. 203, s. 2026, September 9, 2026, the uppercase subject, and the actual Drive file link. Text is written as rich text to avoid interpreting user content as spreadsheet formulas.

Retry with the same form fields after a network or logging failure. Script Properties retain the request owner, request ID, field fingerprint, file ID, and status under EM-year-number; retries repair logging without creating another file. A different request for the same number is rejected. If execution is interrupted between allocating the Google Doc and recording its file ID, the reservation intentionally blocks another allocation: an administrator must reconcile the created file and reservation in Script Properties. Do not clear reservations without checking Drive and both sheet logs. Retained reservations also prevent accidental reuse of deleted memo numbers; monitor Script Properties storage as the registry grows.

All authenticated roles can create memoranda. USER submissions always receive Draft status; ADMIN and SUPER ADMIN may choose a valid status. Activity-log API access now requires SUPER ADMIN, matching the existing interface restriction.

New functions: backend validateExecutiveMemorandum, executiveMemoDate, renderExecutiveMemorandum, createExecutiveMemorandum; frontend API createExecutiveMemorandum. DocumentApp layout methods follow the Google Apps Script Document service reference: https://developers.google.com/apps-script/reference/document.

Validation: node --test tests/*.test.js, npm.cmd run lint, npm.cmd run build. Memorandum tests cover the acceptance record, renderer structure, required fields, failed generation, duplicate requests, partial logging retries, and role enforcement. Existing Special Order and Travel Order upload tests remain included.

## PDF template update (September 9, 2026)

The current source of truth is SHEET NAME FORMAT(TEMPLATE).pdf. The connected OP Files workbook was updated and read back successfully. Existing creation tabs were empty; their sheet IDs were preserved while renaming EMO -> EX_Memo, TO -> Trav_Ord, SO -> Spe_Ord, ATA -> Auth_Travel, CTA -> Cert_Travel. MAIN Files, existing full-name upload logs, credentials, and audit tabs were preserved.

| Document type | Sheet | Columns, in PDF order |
| --- | --- | --- |
| Executive Memorandum | EX_Memo | ID; REFERENCE NUMBER; RECIPIENT LABEL (To or For); POSITION; NAME OF INSTITUTION; THRU (Optional); SUBJECT; DATE; BODY; STATUS; ADDITIONAL NAME OF INSTITUTION (OPTIONAL) |
| Special Order | Spe_Ord | Same eleven columns as EX_Memo |
| Travel Order | Trav_Ord | ID; REFERENCE NUMBER; RECIPIENT LABEL (To or For); POSITION; NAME OF INSTITUTION; PLACE; INCLUSIVE DATE; TRANSPORTATION; PURPOSE; REMARKS |
| Authority to Travel Abroad | Auth_Travel | ID; DATE (date created); BODY |
| Certificate of Travel | Cert_Travel | ID; DATE (date created); BODY |

Create Document uses templateVersion 2 and shows the corresponding fields. IDs are automatic. Recipient label is a To/For selection; POSITION is the recipient position, separate from the optional configurable memorandum signatory. THRU and additional institution are optional. USER status remains Draft; ADMIN and SUPER ADMIN may change status. Status changes also update column J in EX_Memo/Spe_Ord for matching created records.

Authority/certificate creation needs only BODY: creation date comes from the server in the spreadsheet time zone. Travel orders collect the ten-column template's user fields, without requiring a subject, date or body absent from that template. Their filing date also comes from the server. Automatic dates are retained across retries, including retries after midnight or a year boundary. A memorandum reference can be a number (e.g. 203) or a full reference; a recognized series is retained, otherwise filing uses the selected document date's year.

Generated Google Docs include the selected recipient label, recipient position, institution, optional THRU/additional institution, and the document-type fields. The Executive Memorandum keeps its institutional header and logo. The ID cell in each creation sheet hyperlinks to the actual Drive document. File placement remains OP Systems / existing document-type folder / year. MAIN Files and the full-name category logs are still written; all required writes must succeed before the frontend confirms creation.

The live sheet structure is already updated. Deploy the updated Code.gs and rebuilt frontend together to activate the matching form and backend. Reuse the existing spreadsheet ID, Drive folder ID, and web-app URL. No new configuration values are required. Older deployed code still expects the previous sheet names and must be replaced.

Validation includes all five PDF column mappings, recipient labels, optional fields, automatic-date retries, matching status-cell updates, duplicate prevention and existing upload/RBAC regression tests. Sheet header values and wrap formatting were verified through the connector; live Google Doc rendering requires the deployed Apps Script account.
