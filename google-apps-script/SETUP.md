# Role access setup

In CREDENTIALS, keep A = EMAIL, B = NAME, C = PASSWORD and D = ROLE.
Use `user`, `admin`, or `super admin`. Blank or unknown roles receive user access.

Deploy the updated Code.gs as a new version of the existing Apps Script web app, then sign out and sign in again to load the role and session token. Log and account requests require a server-issued session (up to six hours); the server rechecks the current sheet role on each request.

Users can create draft documents. Admins can create documents and change status. Super admins additionally have Archive, Activity log, User management, User logs, and Settings access. The recent activity panel is also restricted to super admins.

The Create document form and status updates use in-memory sample records and reset on reload; PDF uploads use the separate persistent upload API described below. Activity log content is also sample data. Any future document API must enforce these permissions on the server.

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

Archive shows an empty state because no real archived data source is implemented. Activity shows actual upload events; fabricated approval/actor events have been removed. User-authored Create document drafts remain session-only and are not uploaded PDFs.
