const SPREADSHEET_ID = '1_XdWhaHzHqgfa_sUIzp4gTg00E7FeK3XWAh6ckTS2WM';
function appSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// Run in the editor: checks account configuration without logging passwords.
function checkLoginSetup() {
  const spreadsheet = appSpreadsheet();
  const sheet = spreadsheet.getSheetByName('CREDENTIALS');
  if (!sheet) throw new Error('CREDENTIALS tab is missing.');
  if (sheet.getRange(1, 1, 1, 4).getDisplayValues()[0].join('|') !== 'EMAIL|NAME|PASSWORD|ROLE') {
    throw new Error('CREDENTIALS needs EMAIL, NAME, PASSWORD, ROLE in A1:D1.');
  }
  const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getDisplayValues() : [];
  const matches = rows.filter(row => String(row[0]).trim().toLowerCase() === 'admin@jhcsc.edu.ph');
  console.log('Spreadsheet: ' + spreadsheet.getName());
  console.log('Matching admin account rows: ' + matches.length);
  if (matches.length !== 1) throw new Error('Expected exactly one admin@jhcsc.edu.ph account row.');
  const password = String(matches[0][2]);
  console.log('Password configured: ' + Boolean(password));
  console.log('Password has leading/trailing whitespace: ' + (password !== password.trim()));
  console.log('Role: ' + normalizeRole(matches[0][3]));
}

const UPLOAD_FOLDER_ID = '1OVvmtvYjsp4WZz-RY7NkExyNIotO-Vji';
const FILING_TYPES = ['Executive Memorandum', 'Special Order', 'Travel Order', 'Authority to Travel Abroad', 'Certificate of Travel'];
const DOCUMENT_STATUSES = ['Draft', 'For Review', 'For Signature', 'Approved', 'Out'];

function canChangeDocumentStatus(token) {
  if (typeof token !== 'string' || !token) return false;
  const email = CacheService.getScriptCache().get('session:' + token);
  if (!email) return false;
  const sheet = appSpreadsheet().getSheetByName('CREDENTIALS');
  if (!sheet || sheet.getLastRow() < 2) return false;
  const account = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getDisplayValues()
    .find((row) => String(row[0]).trim().toLowerCase() === email);
  return !!account && ['admin', 'super admin'].includes(normalizeRole(account[3]));
}

function updateDocumentStatus(request) {
  if (!canChangeDocumentStatus(request.token)) return jsonResponse({ success: false, message: 'Admin access is required to change document status.' });
  if (!DOCUMENT_STATUSES.includes(request.status)) return jsonResponse({ success: false, message: 'Choose a valid document status.' });
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = mainFilesSheet();
    const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getDisplayValues() : [];
    const index = rows.findIndex((row) => row[1] === request.id);
    if (index === -1) return jsonResponse({ success: false, message: 'Document was not found.' });
    const cell = sheet.getRange(index + 2, 2);
    if (documentFromRow(rows[index], cell.getNote()).status === 'Out') {
      return jsonResponse({ success: false, message: 'This document is Out and locked. It can only be previewed or downloaded.' });
    }
    let metadata = {};
    try { metadata = JSON.parse(cell.getNote() || '{}'); } catch (error) { /* Legacy metadata. */ }
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) metadata = {};
    metadata.status = request.status;
    cell.setNote(JSON.stringify(metadata));
    appendActivityEvent({ activity: 'Status changed to ' + request.status, id: rows[index][1], date: new Date().toISOString(), subject: rows[index][3], url: rows[index][4], type: documentFromRow(rows[index], JSON.stringify(metadata)).type });
    SpreadsheetApp.flush();
    return jsonResponse({ success: true, document: documentFromRow(rows[index], JSON.stringify(metadata)) });
  } finally { lock.releaseLock(); }
}
const TYPE_LOG_SHEETS = {
  'Executive Memorandum': 'Executive Memorandum',
  'Special Order': 'Special Order',
  'Travel Order': 'Travel Order',
  'Authority to Travel Abroad': 'Authority to Travel Abroad',
  'Certificate of Travel': 'Certificate to Travel',
};

function typeLogSheet(type) {
  const name = TYPE_LOG_SHEETS[type];
  if (!name) throw new Error('Unsupported document type.');
  const sheet = appSpreadsheet().getSheetByName(name);
  if (!sheet || sheet.getRange(1, 1, 1, 4).getDisplayValues()[0].join('|') !== 'TIMESTAMP|ID|YEAR|FILE LINKS') {
    throw new Error(name + ' must have TIMESTAMP, ID, YEAR, FILE LINKS in A1:D1.');
  }
  return sheet;
}

function existingTypeLogRow(sheet, id) {
  if (sheet.getLastRow() < 2) return 0;
  const index = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getDisplayValues().findIndex((row) => row[0] === id);
  return index === -1 ? 0 : index + 2;
}

function writeTypeLog(sheet, row, record) {
  const values = [record.date, record.id, record.year, record.url].map((value, index) => {
    const builder = SpreadsheetApp.newRichTextValue().setText(String(value));
    if (index === 3) builder.setLinkUrl(record.url);
    return builder.build();
  });
  sheet.getRange(row, 1, 1, 4).setRichTextValues([values]);
}

// Called while holding the upload lock so concurrent requests reuse folders.
function filingSubfolder(parent, name) {
  const matches = parent.getFoldersByName(name);
  let found;
  while (matches.hasNext()) {
    const folder = matches.next();
    if (folder.isTrashed()) continue;
    if (found) throw new Error('Multiple folders named ' + name + '. Resolve the duplicate folders before uploading.');
    found = folder;
  }
  return found || parent.createFolder(name);
}

function documentFromRow(row, note) {
  let metadata = {};
  try { metadata = JSON.parse(note || '{}'); } catch (error) { /* Legacy rows have no filing metadata. */ }
  if (!metadata || typeof metadata !== 'object') metadata = {};
  return { activity: row[0], id: row[1], date: row[2], subject: row[3], url: row[4],
    deleted: metadata.deleted === true,
    status: DOCUMENT_STATUSES.includes(metadata.status) ? metadata.status : 'For Review',
    type: FILING_TYPES.includes(metadata.type) ? metadata.type : '',
    year: /^(19|20)\d{2}$/.test(String(metadata.year)) ? String(metadata.year) : '' };
}

function mutateDocument(request) {
  if (!canChangeDocumentStatus(request.token)) return jsonResponse({ success: false, message: 'Admin access is required.' });
  const subject = String(request.subject || '').trim();
  if (request.action === 'editDocument' && (!subject || subject.length > 200)) return jsonResponse({ success: false, message: 'Enter a title up to 200 characters.' });
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = mainFilesSheet();
    const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getDisplayValues() : [];
    const index = rows.findIndex(row => row[1] === request.id);
    if (index < 0) {
      if (request.action === 'deleteDocument') return jsonResponse({ success: true, deletedId: request.id, storageDeleted: true });
      throw new Error('Document was not found.');
    }
    const cell = sheet.getRange(index + 2, 2);
    const record = documentFromRow(rows[index], cell.getNote());
    if (record.status === 'Out') throw new Error('OUT documents are locked.');
    if (record.deleted && request.action === 'editDocument') throw new Error('This document has been deleted.');
    if (request.action === 'deleteDocument') {
      deleteDocumentFiles(record, sheet, index + 2);
      appendActivityEvent({ activity: 'Deleted', id: record.id, date: new Date().toISOString(), subject: record.subject, url: record.url, type: record.type });
      SpreadsheetApp.flush();
      return jsonResponse({ success: true, deletedId: request.id, storageDeleted: true });
    }
    sheet.getRange(index + 2, 4).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(subject).build());
    rows[index][3] = subject;
    SpreadsheetApp.flush();
    return jsonResponse({ success: true, document: documentFromRow(rows[index], cell.getNote()) });
  } finally { lock.releaseLock(); }
}

function deleteDocumentFiles(record, mainSheet, mainRow) {
  const match = /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/(view|preview)$/.exec(record.url);
  if (!match) throw new Error('The document has an invalid Drive link. Nothing was deleted.');
  // Resolve all sheets and the exact file before making any changes.
  const logs = FILING_TYPES.map(type => {
    const sheet = typeLogSheet(type);
    const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getDisplayValues() : [];
    return { sheet: sheet, rows: rows.map((row, index) => row[0] === record.id ? index + 2 : 0).filter(Boolean).reverse() };
  });
  const file = DriveApp.getFileById(match[1]);
  if (!file.isTrashed()) file.setTrashed(true);
  // Keep MAIN Files until all category rows are removed, so failures can be retried.
  try {
    logs.forEach(log => log.rows.forEach(row => log.sheet.deleteRow(row)));
    SpreadsheetApp.flush();
    mainSheet.deleteRow(mainRow);
    SpreadsheetApp.flush();
  } catch (error) {
    throw new Error('The PDF is in Drive Trash, but sheet cleanup did not finish. Retry Delete to finish. ' + error.message);
  }
}

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents || '{}');
    if (request.action === 'logout') return logoutUser(request.token);
    if (['editDocument', 'deleteDocument'].includes(request.action)) return mutateDocument(request);
    if (request.action === 'updateDocumentStatus') return updateDocumentStatus(request);

    if (['uploadDocument', 'documents', 'activityLogs'].includes(request.action)) {
      if (!getDocumentSession(request.token)) {
        return jsonResponse({ success: false, message: 'Your session expired. Please sign in again.' });
      }
      if (request.action === 'uploadDocument') return uploadDocument(request);
      return request.action === 'documents' ? getDocuments() : getActivityLogs();
    }

    if (['userLogs', 'users'].includes(request.action) && !isSuperAdminSession(request.token)) {
      return jsonResponse({ success: false, message: 'Super admin access is required. Sign in again if your session expired.' });
    }

    if (request.action === 'userLogs') {
      return getUserLogs();
    }

    if (request.action === 'users') {
      return getUsers();
    }

    if (request.action !== 'login') {
      return jsonResponse({ success: false, message: 'Unsupported action.' });
    }

    const email = String(request.email || '').trim().toLowerCase();
    const password = String(request.password || '');

    if (!email || !password) {
      return jsonResponse({ success: false, message: 'Email and password are required.' });
    }

    if (!/^[^\s@]+@jhcsc\.edu\.ph$/i.test(email)) {
      return jsonResponse({
        success: false,
        message: 'Use your institutional email ending in @jhcsc.edu.ph.',
      });
    }

    const sheet = appSpreadsheet().getSheetByName('CREDENTIALS');

    if (!sheet) {
      return jsonResponse({ success: false, message: 'CREDENTIALS sheet was not found.' });
    }

    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      return jsonResponse({ success: false, message: 'No user accounts are configured.' });
    }

    // CREDENTIALS columns: A EMAIL, B NAME, C PASSWORD, D ROLE.
    const accounts = sheet.getRange(2, 1, lastRow - 1, 4).getDisplayValues();
    const account = accounts.find((row) =>
      String(row[0]).trim().toLowerCase() === email && String(row[2]) === password
    );

    if (!account) {
      return jsonResponse({ success: false, message: 'Incorrect email or password.' });
    }

    logSuccessfulLogin(String(account[1]).trim());

    const token = Utilities.getUuid() + Utilities.getUuid();
    CacheService.getScriptCache().put('session:' + token, email, 21600);

    return jsonResponse({
      success: true,
      user: {
        email: String(account[0]).trim(),
        name: String(account[1]).trim(),
        role: normalizeRole(account[3]),
        token: token,
      },
    });
  } catch (error) {
    return jsonResponse({ success: false, message: 'Unable to process the login request.' });
  }
}

function logSuccessfulLogin(userName) {
  logUserEvent(userName, 'logged in');
}

function logoutUser(token) {
  if (typeof token !== 'string' || !token) {
    return jsonResponse({ success: false, message: 'A session token is required.' });
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const cache = CacheService.getScriptCache();
    const email = cache.get('session:' + token);
    // Repeated logout requests must not create duplicate entries.
    if (!email) return jsonResponse({ success: true });
    try {
      const sheet = appSpreadsheet().getSheetByName('CREDENTIALS');
      const account = sheet && sheet.getLastRow() > 1
        ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues()
          .find(row => String(row[0]).trim().toLowerCase() === email)
        : null;
      logUserEvent(account ? String(account[1]).trim() || email : email, 'logged out');
    } finally {
      cache.remove('session:' + token);
    }
    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, message: 'Unable to record logout.' });
  } finally {
    lock.releaseLock();
  }
}

function logUserEvent(userName, action) {
  const spreadsheet = appSpreadsheet();
  let logsSheet = spreadsheet.getSheetByName('USER LOGS');

  if (!logsSheet) {
    logsSheet = spreadsheet.insertSheet('USER LOGS');
    logsSheet.getRange(1, 1, 1, 2).setValues([['TIMESTAMP', 'MESSAGE']]);
  }

  logsSheet.appendRow([new Date(), `${userName} ${action}`]);
  logsSheet.getRange(logsSheet.getLastRow(), 1).setNumberFormat('m/d/yyyy h:mma');
}

function getUserLogs() {
  const sheet = appSpreadsheet().getSheetByName('USER LOGS');

  if (!sheet || sheet.getLastRow() < 2) {
    return jsonResponse({ success: true, logs: [] });
  }

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues();
  const logs = rows.reverse().map((row) => ({
    timestamp: String(row[0]).trim(),
    message: String(row[1]).trim(),
  }));

  return jsonResponse({ success: true, logs });
}

function getUsers() {
  const sheet = appSpreadsheet().getSheetByName('CREDENTIALS');

  if (!sheet || sheet.getLastRow() < 2) {
    return jsonResponse({ success: true, users: [] });
  }

  // CREDENTIALS columns: A EMAIL, B NAME, C PASSWORD, D ROLE.
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getDisplayValues();
  const users = rows
    .filter((row) => String(row[0]).trim() || String(row[1]).trim())
    .map((row) => ({
      email: String(row[0]).trim(),
      name: String(row[1]).trim(),
      role: normalizeRole(row[3]),
    }));

  return jsonResponse({ success: true, users });
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase().replace(/[ _-]+/g, '');
  if (value === 'superadmin' || value === 'superadministrator') return 'super admin';
  if (value === 'admin' || value === 'administrator') return 'admin';
  return 'user';
}

function isSuperAdminSession(token) {
  if (typeof token !== 'string' || !token) return false;
  const email = CacheService.getScriptCache().get('session:' + token);
  if (!email) return false;
  const sheet = appSpreadsheet().getSheetByName('CREDENTIALS');
  if (!sheet || sheet.getLastRow() < 2) return false;
  const account = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getDisplayValues()
    .find((row) => String(row[0]).trim().toLowerCase() === email);
  return !!account && normalizeRole(account[3]) === 'super admin';
}

// Run manually in the Apps Script editor under the deployment account.
// This requests Drive authorization and checks configuration without uploading a file.
function checkUploadSetup() {
  const sheet = mainFilesSheet();
  const folder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
  if (folder.isTrashed()) throw new Error('The configured upload folder is in the trash. Update UPLOAD_FOLDER_ID.');
  console.log('Sheet headers OK: ' + sheet.getName());
  console.log('Drive access OK: ' + folder.getName());
  console.log('Upload folder found. Its write access will be checked by the next upload.');
}

// Run manually as the account shown in the web app's "Execute as" setting.
// Creates a tiny diagnostic file, then moves only that file to the trash.
// Errors intentionally surface in the editor with Google's full explanation.
function checkUploadWriteAccess() {
  const folder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
  const blob = Utilities.newBlob('OP upload write-access check', 'text/plain', 'op-upload-check-' + Utilities.getUuid() + '.txt');
  console.log('Testing file creation in: ' + folder.getName());
  const testFile = folder.createFile(blob);
  console.log('File creation succeeded. Cleaning up the diagnostic file.');
  testFile.setTrashed(true);
  console.log('Write access confirmed and diagnostic file moved to trash.');
}

// MAIN Files: ACTIVITY, ID, DATE, SUBJECT, FILE LINKS.
function getDocumentSession(token) {
  if (typeof token !== 'string' || !token) return false;
  const email = CacheService.getScriptCache().get('session:' + token);
  if (!email) return false;
  const sheet = appSpreadsheet().getSheetByName('CREDENTIALS');
  return sheet && sheet.getLastRow() > 1 && sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
    .getDisplayValues().some((row) => String(row[0]).trim().toLowerCase() === email);
}

function mainFilesSheet() {
  const sheet = appSpreadsheet().getSheetByName('MAIN Files');
  if (!sheet || sheet.getRange(1, 1, 1, 5).getDisplayValues()[0].join('|') !== 'ACTIVITY|ID|DATE|SUBJECT|FILE LINKS') {
    throw new Error('MAIN Files must have headers ACTIVITY, ID, DATE, SUBJECT, FILE LINKS in A1:E1.');
  }
  return sheet;
}

function activityLogSheet() {
  const spreadsheet = appSpreadsheet();
  let sheet = spreadsheet.getSheetByName('ACTIVITY LOG');
  if (!sheet && spreadsheet.insertSheet) {
    sheet = spreadsheet.insertSheet('ACTIVITY LOG');
    sheet.getRange(1, 1, 1, 6).setValues([['ACTIVITY', 'ID', 'DATE', 'SUBJECT', 'FILE LINKS', 'TYPE']]);
  }
  if (!sheet) return null;
  if (!sheet || sheet.getRange(1, 1, 1, 6).getDisplayValues()[0].join('|') !== 'ACTIVITY|ID|DATE|SUBJECT|FILE LINKS|TYPE') {
    throw new Error('ACTIVITY LOG must have headers ACTIVITY, ID, DATE, SUBJECT, FILE LINKS, TYPE in A1:F1.');
  }
  return sheet;
}

function appendActivityEvent(event) {
  const sheet = activityLogSheet();
  if (!sheet) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, 6).setValues([[event.activity, event.id, event.date, event.subject, event.url, event.type || '']]);
}

function activityFromRow(row) {
  return { activity: row[0], id: row[1], date: row[2], subject: row[3], url: row[4], type: row[5] || '' };
}

function getActivityLogs() {
  const mainSheet = mainFilesSheet();
  const mainRows = mainSheet.getLastRow() > 1 ? mainSheet.getRange(2, 1, mainSheet.getLastRow() - 1, 5).getDisplayValues() : [];
  const notes = mainRows.length ? mainSheet.getRange(2, 2, mainRows.length, 1).getNotes() : [];
  const current = mainRows.map((row, index) => documentFromRow(row, notes[index][0])).filter(record => record.id && !record.deleted);
  let events = [];
  const sheet = appSpreadsheet().getSheetByName('ACTIVITY LOG');
  if (sheet && sheet.getLastRow() > 1) events = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getDisplayValues().map(activityFromRow).filter(record => record.id);
  return jsonResponse({ success: true, activities: current.concat(events) });
}

function getDocuments() {
  const sheet = mainFilesSheet();
  const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getDisplayValues() : [];
  const notes = rows.length ? sheet.getRange(2, 2, rows.length, 1).getNotes() : [];
  return jsonResponse({ success: true, documents: rows.map((row, index) => documentFromRow(row, notes[index][0])).filter((record) => record.id && !record.deleted).reverse() });
}

function uploadDocument(request) {
  const type = String(request.type || '');
  const year = String(request.year || '');
  if (!FILING_TYPES.includes(type) || !/^(19|20)\d{2}$/.test(year)) {
    return jsonResponse({ success: false, message: 'Select a document type and document year (1900–2099) before uploading.' });
  }
  const maxBytes = 25 * 1024 * 1024;
  const name = String(request.name || '').trim();
  const data = request.data;
  if (!name || name.length > 200 || !/\.pdf$/i.test(name) || typeof data !== 'string' || !data.length || data.length > Math.ceil(maxBytes / 3) * 4) {
    return jsonResponse({ success: false, message: 'Choose a PDF file up to 25 MB with a filename under 200 characters.' });
  }
  let bytes;
  try { bytes = Utilities.base64Decode(data); } catch (error) {
    return jsonResponse({ success: false, message: 'The uploaded file could not be decoded.' });
  }
  if (bytes.length > maxBytes || bytes.slice(0, 5).map((byte) => String.fromCharCode(byte)).join('') !== '%PDF-') {
    return jsonResponse({ success: false, message: 'Choose a valid PDF file up to 25 MB.' });
  }
  const lock = LockService.getScriptLock();
  let locked = false;
  let stage = 'waiting for another upload to finish';
  let file;
  let row;
  let sheet;
  let logSheet;
  let logRow;
  let committed = false;
  try {
    lock.waitLock(30000);
    locked = true;
    stage = 'checking MAIN Files headers';
    sheet = mainFilesSheet();
    stage = 'checking the ' + TYPE_LOG_SHEETS[type] + ' log headers';
    logSheet = typeLogSheet(type);
    // A stable request ID makes retrying a failed network response safe.
    const id = String(request.uploadId || '');
    stage = 'validating the upload ID';
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(id)) throw new Error('Invalid upload ID.');
    stage = 'checking previously uploaded files';
    if (sheet.getLastRow() > 1) {
      const existingRows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getDisplayValues();
      const existingIndex = existingRows.findIndex((item) => item[1] === id);
      if (existingIndex !== -1) {
        const existing = documentFromRow(existingRows[existingIndex], sheet.getRange(existingIndex + 2, 2).getNote());
        // Repair a missing category log on retry without creating another Drive file.
        if (existing.type && existing.year) {
          const existingLogSheet = typeLogSheet(existing.type);
          if (!existingTypeLogRow(existingLogSheet, existing.id)) {
            stage = 'repairing the ' + TYPE_LOG_SHEETS[existing.type] + ' log';
            writeTypeLog(existingLogSheet, existingLogSheet.getLastRow() + 1, existing);
            SpreadsheetApp.flush();
          }
        }
        return jsonResponse({ success: true, document: existing });
      }
    }
    if (existingTypeLogRow(logSheet, id)) throw new Error('This upload ID already has a category log but no MAIN Files record. Ask the administrator to check the partial upload.');
    stage = 'opening the Google Drive upload folder';
    const root = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
    if (root.isTrashed()) throw new Error('The configured upload folder is in the trash.');
    stage = 'opening or creating the ' + type + ' folder';
    const typeFolder = filingSubfolder(root, type);
    stage = 'opening or creating the ' + type + ' / ' + year + ' folder';
    const folder = filingSubfolder(typeFolder, year);
    stage = 'preparing the PDF data';
    const blob = Utilities.newBlob(bytes, 'application/pdf', name);
    stage = 'saving the PDF to Google Drive';
    file = folder.createFile(blob);
    stage = 'preparing the file link';
    const record = { activity: 'Uploaded', id: id, date: new Date().toISOString(), subject: name, url: 'https://drive.google.com/file/d/' + file.getId() + '/view', type: type, year: year, status: 'For Review' };
    stage = 'writing the file link to ' + TYPE_LOG_SHEETS[type];
    logRow = logSheet.getLastRow() + 1;
    writeTypeLog(logSheet, logRow, record);
    row = sheet.getLastRow() + 1;
    // Rich text keeps filenames literal, including names beginning with '='.
    const values = [record.activity, record.id, record.date, record.subject, record.url].map((value, index) => {
      const builder = SpreadsheetApp.newRichTextValue().setText(value);
      if (index === 4) builder.setLinkUrl(record.url);
      return builder.build();
    });
    stage = 'writing the file link to MAIN Files';
    sheet.getRange(row, 1, 1, 5).setRichTextValues([values]);
    // Keep the existing A:E schema. The ID cell note stores filing metadata.
    sheet.getRange(row, 2).setNote(JSON.stringify({ type: type, year: year, status: record.status }));
    stage = 'saving MAIN Files changes';
    SpreadsheetApp.flush();
    committed = true;
    return jsonResponse({ success: true, document: record });
  } catch (error) {
    console.error('Document upload failed while ' + stage + ': ' + String(error && error.message || error));
    let cleanupFailed = false;
    if (!committed && file) {
      try {
        // Preserve the file if its partial sheet row cannot be removed.
        if (row && sheet) {
          sheet.getRange(row, 1, 1, 5).clearContent();
          sheet.getRange(row, 2).clearNote();
        }
        if (logRow && logSheet) logSheet.getRange(logRow, 1, 1, 4).clearContent();
        SpreadsheetApp.flush();
        file.setTrashed(true);
      } catch (cleanupError) {
        cleanupFailed = true;
        console.error('Upload cleanup failed: ' + String(cleanupError && cleanupError.message || cleanupError));
      }
    }
    return jsonResponse({ success: false, message: 'Upload failed while ' + stage + '.' + (cleanupFailed ? ' A partial upload may remain; ask the administrator to check Drive and MAIN Files before retrying.' : '') });
  } finally {
    if (locked) lock.releaseLock();
  }
}

// Run once in the editor as the owner. Targets only the six known sample PDFs.
// The real SO No. 136-b file is deliberately absent from this list.
function removeKnownSamples() {
  const sampleIds = [
    '1M1w9pJymPxM_STb3PQcuPtZxeKaSinNd',
    '1l0U5Jybyr-MqokqxD8lv17FpbrSfYbiz',
    '1qg96wX7fco35ZmFAfxp73OY6dPeVkGZf',
    '1cQsqqyAU92KQI8fDiiXcH09wvAPCQrKH',
    '1Y5ptU41sHYaRGVkK52MC6JETrOc7d8er',
    '11BrM6GMxucG-EuhL_MFujkL9S0mMuKsJ',
  ];
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // Resolve every file first; permission failures stop before sheet changes.
    const files = sampleIds.map((id) => DriveApp.getFileById(id));
    files.forEach((file) => { if (!file.isTrashed()) file.setTrashed(true); });
    const spreadsheet = appSpreadsheet();
    const tabs = ['MAIN Files'].concat(Object.values(TYPE_LOG_SHEETS));
    let cleared = 0;
    tabs.forEach((name) => {
      const sheet = spreadsheet.getSheetByName(name);
      if (!sheet || sheet.getLastRow() < 2) return;
      const width = name === 'MAIN Files' ? 5 : 4;
      const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getDisplayValues();
      rows.forEach((row, index) => {
        const match = String(row[width - 1]).match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match && sampleIds.includes(match[1])) {
          const range = sheet.getRange(index + 2, 1, 1, width);
          range.clearContent();
          range.clearNote();
          cleared++;
        }
      });
    });
    SpreadsheetApp.flush();
    console.log('Moved known sample PDFs to trash and cleared ' + cleared + ' sample log rows. Real documents preserved.');
  } finally { lock.releaseLock(); }
}
