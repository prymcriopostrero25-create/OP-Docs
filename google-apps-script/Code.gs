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
const CREATED_DOCUMENT_SHEETS = {
  'Executive Memorandum': 'EX_Memo', 'Travel Order': 'Trav_Ord', 'Special Order': 'Spe_Ord',
  'Authority to Travel Abroad': 'Auth_Travel', 'Certificate of Travel': 'Cert_Travel',
};
const CREATED_DOCUMENT_HEADERS = {
  EX_Memo: ['ID', 'REFERENCE NUMBER', 'RECIPIENT LABEL', 'NAME OF THE RECIPIENT', 'POSITION/OFFICE', 'NAME OF THE INSTITUTION OR OFFICE', 'THRU', 'SUBJECT', 'DATE', 'BODY', 'STATUS', 'ADDITIONAL NAME OF OFFICE'],
  Spe_Ord: ['ID', 'REFERENCE NUMBER', 'RECIPIENT LABEL (To or For)', 'NAME OF THE RECIPIENT', 'POSITION/OFFICE', 'NAME OF INSTITUTION/OFFICE', 'THRU (Optional)', 'SUBJECT', 'DATE', 'BODY', 'STATUS', 'ADDITIONAL NAME OF INSTITUTION (OPTIONAL)'],
  Trav_Ord: ['ID', 'REFERENCE NUMBER', 'RECIPIENT LABEL (To or For)', 'POSITION', 'NAME OF INSTITUTION', 'PLACE', 'INCLUSIVE DATE', 'TRANSPORTATION', 'PURPOSE', 'REMARKS'],
  Auth_Travel: ['ID', 'DATE (date created)', 'BODY'],
  Cert_Travel: ['ID', 'DATE (date created)', 'BODY'],
};

function normalizeHeader(text) {
  return String(text || '')
    .trim()
    .toUpperCase()
    .replace(/\bNO\./g, 'NUMBER')
    .replace(/\bNO\b/g, 'NUMBER')
    .replace(/\bREFERENCE NO\b/g, 'REFERENCE NUMBER')
    .replace(/\bFILE LINKS\b/g, 'FILE LINKS')
    .replace(/\bFILE LINK\b/g, 'FILE LINKS')
    .replace(/[()]/g, ' ')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function createdDocumentSheet(type) {
  // The editor's Run button supplies no arguments. Treat that as a setup check.
  if (arguments.length === 0) return checkCreateDocumentSetup();
  const name = CREATED_DOCUMENT_SHEETS[type];
  if (!name) throw new Error('Unsupported document type.');
  const sheet = appSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('The ' + name + ' sheet is missing.');
  const headers = CREATED_DOCUMENT_HEADERS[name];
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const actual = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0].map(normalizeHeader);
  const expected = headers.map(normalizeHeader);
  if (actual.join('|') !== expected.join('|')) throw new Error('Check the ' + name + ' sheet headers.');
  return sheet;
}

function logCreatedDocument(sheet, record, data, internalId) {
  const count = sheet.getLastRow() - 1;
  const rows = count > 0 ? sheet.getRange(2, 1, count, 1).getDisplayValues() : [];
  const notes = count > 0 ? sheet.getRange(2, 1, count, 1).getNotes() : [];
  const existing = rows.findIndex((row, index) => {
    let note = {};
    try { note = JSON.parse(notes[index][0] || '{}') || {}; } catch (error) { /* Legacy rows. */ }
    return row[0] === internalId || note.createdDocumentId === internalId;
  });
  const row = existing >= 0 ? existing + 2 : sheet.getLastRow() + 1;
  const label = data.recipientLabel || (data.to ? 'To' : 'For');
  const simple = ['Authority to Travel Abroad', 'Certificate of Travel'].includes(record.type);
  const values = simple ? [internalId, record.date, data.body || data.content]
    : record.type === 'Travel Order'
      ? [internalId, record.id, label, data.recipientPosition, data.institution, data.place || data.destination, data.inclusiveDate || data.travelDates, data.transportation, data.purpose, data.remarks]
      : record.type === 'Executive Memorandum'
        ? [internalId, record.id, label, data.recipientName, data.recipientPosition, data.institution, data.thru, record.subject, record.date, data.body || data.content, record.status, data.additionalInstitution]
      : record.type === 'Special Order'
        ? [internalId, record.id, label, data.recipientName || data.recipient, data.recipientPosition, data.institution, data.thru, record.subject, record.date, data.body || data.content, record.status, data.additionalInstitution]
      : [internalId, record.id, label, data.recipientPosition, data.institution, data.thru, record.subject, record.date, data.body || data.content, record.status, data.additionalInstitution];
  // Keep the file URL on the ID, preserving the PDF's exact column count.
  sheet.getRange(row, 1).setNote(JSON.stringify({ createdDocumentId: internalId, reference: record.id, url: record.url }));
  sheet.getRange(row, 1, 1, values.length).setRichTextValues([values.map((value, index) => {
    const builder = SpreadsheetApp.newRichTextValue().setText(String(value || ''));
    if (index === 0) builder.setLinkUrl(record.url);
    return builder.build();
  })]);
}

function syncCreatedDocumentStatus(type, internalId, status) {
  if (!internalId || !['Executive Memorandum', 'Special Order'].includes(type)) return;
  const sheet = createdDocumentSheet(type);
  const count = sheet.getLastRow() - 1;
  if (count < 1) return;
  const rows = sheet.getRange(2, 1, count, 1).getDisplayValues();
  const index = rows.findIndex(row => row[0] === internalId);
  if (index >= 0) sheet.getRange(index + 2, ['Executive Memorandum', 'Special Order'].includes(type) ? 11 : 10).setValue(status);
}

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
    syncCreatedDocumentStatus(metadata.type, metadata.createdDocumentId, request.status);
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
  const expected = ['TIMESTAMP', 'ID', 'YEAR', 'FILE LINKS'];
  const actual = sheet && sheet.getRange(1, 1, 1, 4).getDisplayValues()[0].map(normalizeHeader);
  if (!sheet || actual.join('|') !== expected.map(normalizeHeader).join('|')) {
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
    if (request.action === 'createExecutiveMemorandum') return createExecutiveMemorandum(request);
    if (request.action === 'createDocument') return createDocument(request);
    if (request.action === 'activityLogs' && !isSuperAdminSession(request.token)) {
      return jsonResponse({ success: false, message: 'Super admin access is required.' });
    }
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
  logsSheet.getRange(logsSheet.getLastRow(), 1).setNumberFormat('m/d/yyyy h:mm AM/PM');
}

function getUserLogs() {
  const sheet = appSpreadsheet().getSheetByName('USER LOGS');

  if (!sheet || sheet.getLastRow() < 2) {
    return jsonResponse({ success: true, logs: [] });
  }

  sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).setNumberFormat('m/d/yyyy h:mm AM/PM');
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

// Run manually in the Apps Script editor when you need the consent popup
// for the Drive and Google Docs scopes used by this project.
function requestAuthorizationPopup() {
  const spreadsheet = appSpreadsheet();
  const folder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
  const tempDocumentName = 'OP Authorization Check ' + Utilities.getUuid();
  console.log('Spreadsheet access OK: ' + spreadsheet.getName());
  console.log('Drive folder access OK: ' + folder.getName());
  const tempDoc = DocumentApp.create(tempDocumentName);
  console.log('Temporary Google Doc created: ' + tempDocumentName);
  tempDoc.saveAndClose();
  const tempFile = DriveApp.getFileById(tempDoc.getId());
  if (tempFile && !tempFile.isTrashed()) {
    tempFile.setTrashed(true);
  }
  console.log('Temporary Google Doc moved to trash. Authorization request completed.');
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
  const expected = ['ACTIVITY', 'ID', 'DATE', 'SUBJECT', 'FILE LINKS'];
  const actual = sheet && sheet.getRange(1, 1, 1, 5).getDisplayValues()[0].map(normalizeHeader);
  if (!sheet || actual.join('|') !== expected.map(normalizeHeader).join('|')) {
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
  const expected = ['ACTIVITY', 'ID', 'DATE', 'SUBJECT', 'FILE LINKS', 'TYPE'];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 6).setValues([expected]);
  }
  const actual = sheet.getRange(1, 1, 1, 6).getDisplayValues()[0].map(normalizeHeader);
  if (actual.join('|') !== expected.map(normalizeHeader).join('|')) {
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

function validateExecutiveMemorandum(request) {
  const data = {};
  const labels = { number: 'document number', year: 'series', recipient: 'FOR recipient', subject: 'subject', date: 'date', body: 'body', signatory: 'signatory', position: 'position' };
  Object.keys(labels).forEach(key => {
    data[key] = String(request[key] || '').trim();
    if (!data[key]) throw new Error('Please enter the ' + labels[key] + '.');
  });
  if (!/^\d{1,6}$/.test(data.number) || Number(data.number) < 1) throw new Error('Enter a document number from 1 to 999999.');
  data.number = String(Number(data.number)).padStart(3, '0');
  if (!/^(19|20)\d{2}$/.test(data.year)) throw new Error('Enter a series from 1900 to 2099.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || isNaN(Date.parse(data.date)) || new Date(data.date).toISOString().slice(0, 10) !== data.date) throw new Error('Choose a valid memorandum date.');
  data.cc = String(request.cc || '').trim();
  Object.keys(data).forEach(key => { if (data[key].length > (key === 'body' ? 50000 : 2000)) throw new Error('The ' + (labels[key] || key) + ' is too long.'); });
  data.subject = data.subject.toUpperCase();
  return data;
}

function executiveMemoDate(value) {
  const parts = value.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return months[parts[1] - 1] + ' ' + parts[2] + ', ' + parts[0];
}

function renderExecutiveMemorandum(doc, data, logo) {
  const body = doc.getBody();
  body.clear();
  body.setPageWidth(595.28).setPageHeight(841.89).setMarginTop(54).setMarginBottom(54).setMarginLeft(64.8).setMarginRight(64.8);
  body.setAttributes({ [DocumentApp.Attribute.FONT_FAMILY]: 'Arial', [DocumentApp.Attribute.FONT_SIZE]: 11 });
  const header = doc.getHeader() || doc.addHeader();
  header.clear();
  const image = header.appendParagraph('').setAlignment(DocumentApp.HorizontalAlignment.CENTER).appendInlineImage(logo);
  image.setHeight(Math.round(55 * image.getHeight() / image.getWidth())).setWidth(55);
  ['J.H. CERILLES STATE COLLEGE', 'Mati, San Miguel, Zamboanga del Sur', 'main@jhcsc.edu.ph | +63 915 2484 538', 'OFFICE OF THE PRESIDENT'].forEach((text, index) => {
    const p = header.appendParagraph(text).setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingAfter(index === 3 ? 12 : 2);
    p.editAsText().setFontFamily('Arial').setFontSize(index === 0 ? 12 : 10).setBold(index === 0 || index === 3);
  });
  body.appendParagraph(data.number ? 'Executive Memorandum Order No. ' + data.number : data.reference).setSpacingBefore(12).setSpacingAfter(2).editAsText().setBold(true);
  body.appendParagraph('Series of ' + data.year).setSpacingAfter(18).editAsText().setBold(false);
  const recipient = [data.recipientName || data.recipient, data.recipientPosition, data.institution, data.additionalInstitution].filter(Boolean).join('\n');
  const details = [[(data.recipientLabel || 'For').toUpperCase(), ':', recipient]];
  if (data.thru) details.push(['THRU', ':', data.thru]);
  const subjectRow = details.length;
  details.push(['SUBJECT', ':', data.subject], ['DATE', ':', executiveMemoDate(data.date).toUpperCase()]);
  const info = body.appendTable(details);
  info.setBorderWidth(0).setColumnWidth(0, 64).setColumnWidth(1, 12).setColumnWidth(2, 377.68);
  for (let row = 0; row < details.length; row++) {
    for (let col = 0; col < 3; col++) info.getCell(row, col).setPaddingTop(4).setPaddingBottom(7);
    info.getCell(row, 0).editAsText().setBold(true);
  }
  info.getCell(subjectRow, 2).editAsText().setBold(true);
  body.appendParagraph('').setSpacingAfter(6);
  data.body.split(/\r?\n/).forEach(line => body.appendParagraph(line).setLineSpacing(1.15).setSpacingAfter(6).editAsText().setBold(false));
  body.appendParagraph(data.signatory).setSpacingBefore(36).setSpacingAfter(0).editAsText().setBold(true);
  body.appendParagraph(data.position).setSpacingAfter(12).editAsText().setBold(false);
  if (data.cc) body.appendParagraph('cc:\n' + data.cc).editAsText().setFontSize(10).setBold(false);
  doc.saveAndClose();
}

function createExecutiveMemorandum(request) {
  return createDocument({ ...request, type: 'Executive Memorandum' });
}

function validateCreatedDocument(request, type) {
  const data = {};
  const required = ['title', 'reference', 'year', 'date', 'content'];
  if (type === 'Travel Order') required.push('to');
  ['title', 'reference', 'year', 'date', 'content', 'owner', 'to', 'recipient', 'destination', 'travelDates', 'transportation', 'purpose', 'remarks'].forEach(key => {
    data[key] = String(request[key] || '').trim();
    if (required.includes(key) && !data[key]) throw new Error('Please enter the ' + key + '.');
    if (data[key].length > (key === 'content' ? 50000 : 2000)) throw new Error('The ' + key + ' is too long.');
  });
  if (!/^(19|20)\d{2}$/.test(data.year)) throw new Error('Enter a year from 1900 to 2099.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || isNaN(Date.parse(data.date)) || new Date(data.date).toISOString().slice(0, 10) !== data.date) throw new Error('Choose a valid document date.');
  data.subject = data.title;
  return data;
}

function renderCreatedDocument(doc, data, type) {
  const body = doc.getBody();
  body.clear();
  body.setPageWidth(595.28).setPageHeight(841.89).setMarginTop(54).setMarginBottom(54).setMarginLeft(64.8).setMarginRight(64.8);
  body.setAttributes({ [DocumentApp.Attribute.FONT_FAMILY]: 'Arial', [DocumentApp.Attribute.FONT_SIZE]: 11 });
  body.appendParagraph(type).editAsText().setBold(true);
  if (data.reference) body.appendParagraph(data.reference).editAsText().setBold(false);
  if (data.subject !== type) body.appendParagraph(data.subject).setSpacingAfter(12).editAsText().setBold(true);
  const addressee = [data.recipientName || data.recipient, data.recipientPosition, data.institution, data.additionalInstitution].filter(Boolean).join('\n');
  const fields = [['DATE', executiveMemoDate(data.date)], [(data.recipientLabel || 'To').toUpperCase(), addressee], ['THRU', data.thru], ['PLACE', data.place || data.destination], ['INCLUSIVE DATE', data.inclusiveDate || data.travelDates], ['TRANSPORTATION', data.transportation], ['PURPOSE', data.purpose], ['REMARKS', data.remarks]];
  fields.filter(([, value]) => value).forEach(([label, value]) => body.appendParagraph(label + ': ' + value).editAsText().setBold(false));
  body.appendParagraph('').setSpacingAfter(6);
  (data.body || data.content || '').split(/\r?\n/).forEach(line => body.appendParagraph(line).setSpacingAfter(6).editAsText().setBold(false));
  doc.saveAndClose();
}

// Field definitions from SHEET NAME FORMAT(TEMPLATE).pdf. POSITION is the recipient's position.
function validateTemplateDocument(request, type) {
  const simple = ['Authority to Travel Abroad', 'Certificate of Travel'].includes(type);
  const travel = type === 'Travel Order';
  const data = {};
  const fields = simple ? ['body'] : travel
    ? ['reference', 'recipientLabel', 'recipientPosition', 'institution', 'place', 'inclusiveDate', 'transportation', 'purpose', 'remarks']
    : ['Executive Memorandum', 'Special Order'].includes(type)
      ? ['reference', 'recipientLabel', 'recipientName', 'recipientPosition', 'institution', 'thru', 'subject', 'date', 'body', 'additionalInstitution']
      : ['reference', 'recipientLabel', 'recipientPosition', 'institution', 'thru', 'subject', 'date', 'body', 'additionalInstitution'];
  const optional = ['thru', 'additionalInstitution'];
  fields.forEach(key => {
    data[key] = String(request[key] || '').trim();
    if (!optional.includes(key) && !data[key]) throw new Error('Please enter ' + key.replace(/([A-Z])/g, ' $1').toLowerCase() + '.');
    if (data[key].length > (key === 'body' ? 50000 : 2000)) throw new Error('The ' + key + ' is too long.');
  });
  if (!simple && !['To', 'For'].includes(data.recipientLabel)) throw new Error('Choose To or For as the recipient label.');
  if (!simple && !travel) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || isNaN(Date.parse(data.date)) || new Date(data.date).toISOString().slice(0, 10) !== data.date) throw new Error('Choose a valid document date.');
    data.year = data.date.slice(0, 4);
    if (!/^(19|20)\d{2}$/.test(data.year)) throw new Error('Choose a date from 1900 to 2099.');
  }
  data.subject = data.subject || type;
  if (type === 'Executive Memorandum') {
    data.subject = data.subject.toUpperCase();
    const match = /^(?:Executive Memorandum(?: Order)? No\.\s*)?(\d{1,6})(?:,?\s*s\.\s*(\d{4}))?$/i.exec(data.reference);
    if (match) {
      if (Number(match[1]) < 1) throw new Error('Enter a positive memorandum number.');
      data.number = String(Number(match[1])).padStart(3, '0');
      if (match[2]) {
        if (!/^(19|20)\d{2}$/.test(match[2])) throw new Error('Enter a series from 1900 to 2099.');
        data.year = match[2];
      }
    }
    data.signatory = String(request.signatory || 'EDGARDO H. ROSALES, JD, Ed.D.').trim();
    data.position = String(request.signatoryPosition || 'SUC President II').trim();
  }
  return data;
}

function createDocument(request) {
  if (!getDocumentSession(request.token)) return jsonResponse({ success: false, message: 'Your session expired. Please sign in again.' });
  const type = request.type;
  if (!FILING_TYPES.includes(type)) return jsonResponse({ success: false, message: 'Choose a valid document type.' });
  const memo = type === 'Executive Memorandum';
  const template = request.templateVersion === 2;
  const automaticDate = template && ['Authority to Travel Abroad', 'Certificate of Travel', 'Travel Order'].includes(type);
  const simple = template && ['Authority to Travel Abroad', 'Certificate of Travel'].includes(type);
  let data;
  try { data = template ? validateTemplateDocument(request, type) : memo ? validateExecutiveMemorandum(request) : validateCreatedDocument(request, type); } catch (error) { return jsonResponse({ success: false, message: error.message }); }
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(String(request.requestId || ''))) return jsonResponse({ success: false, message: 'Invalid creation request. Reopen the form.' });
  const id = memo && data.number ? 'Executive Memorandum No. ' + data.number + ', s. ' + data.year : simple ? CREATED_DOCUMENT_SHEETS[type] + '-' + request.requestId : data.reference;
  // Keep reservation prefixes stable across spreadsheet-tab renames.
  const prefixes = { 'Special Order': 'SO', 'Travel Order': 'TO', 'Authority to Travel Abroad': 'ATA', 'Certificate of Travel': 'CTA', 'Executive Memorandum': 'EM' };
  const key = memo && data.number ? 'EM-' + data.year + '-' + data.number : prefixes[type] + '-' + (data.year || 'AUTO') + '-' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, id.toUpperCase()));
  const lock = LockService.getScriptLock();
  let locked = false;
  let state;
  let stage = 'prepare';
  try {
    lock.waitLock(30000);
    locked = true;
    const sheet = mainFilesSheet();
    const logSheet = typeLogSheet(type);
    const creationSheet = createdDocumentSheet(type);
    const properties = PropertiesService.getScriptProperties();
    state = JSON.parse(properties.getProperty(key) || 'null');
    const fingerprint = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(data)));
    const owner = CacheService.getScriptCache().get('session:' + request.token);
    const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getDisplayValues() : [];
    const index = rows.findIndex(row => {
      const match = /^Executive Memorandum(?: Order)? No\.\s*0*(\d+),?\s*s\.\s*(\d{4})$/i.exec(row[1]);
      return String(row[1]).toUpperCase() === id.toUpperCase() || row[1] === key || (memo && match && Number(match[1]) === Number(data.number) && match[2] === data.year);
    });
    const creationRows = creationSheet.getLastRow() > 1
      ? creationSheet.getRange(2, 1, creationSheet.getLastRow() - 1, 1).getDisplayValues() : [];
    const hasLogEvidence = existingTypeLogRow(logSheet, id);
    const hasCreationEvidence = creationRows.some(row => row[0] === key);
    const hasMainRowEvidence = index >= 0;
    const hasRecoveryEvidence = Boolean(state && (state.fileId || state.allocationName));
    // An orphaned property record with no related MAIN Files row, type log row, or
    // created-document short log evidence is stale. Remove it so a new request can
    // reserve the same document number instead of being blocked as a duplicate.
    if (state && !hasMainRowEvidence && !hasLogEvidence && !hasCreationEvidence && !hasRecoveryEvidence) {
      properties.deleteProperty(key);
      state = null;
    }
    // A Drive file or reservation alone is not a completed creation. Legacy attempts
    // have no completion flag, so verify all three registry entries as well.
    const completed = state && (state.completed === true || (hasMainRowEvidence &&
      hasLogEvidence && hasCreationEvidence));
    const recoverReservation = state && !completed && state.owner === owner;
    if ((state || index >= 0) && (!state || (state.requestId !== request.requestId && !recoverReservation) || state.owner !== owner)) return jsonResponse({ success: false, message: id + ' already exists.' });
    if (state && state.fingerprint !== fingerprint) {
      // Allow corrections to an unpublished failed attempt when its allocation can
      // still be identified. Never rewrite a completed or partly logged document.
      if (recoverReservation && index < 0 && (state.fileId || state.allocationName)) {
        state.fingerprint = fingerprint;
        state.rendered = false;
      } else return jsonResponse({ success: false, message: 'This number belongs to an unfinished attempt with different fields. Restore the original fields to resume it safely.' });
    }
    if (recoverReservation) state.requestId = request.requestId;
    const saveState = () => properties.setProperty(key, JSON.stringify(state));
    if (!state) {
      state = { requestId: request.requestId, owner: owner, fingerprint: fingerprint, status: canChangeDocumentStatus(request.token) && DOCUMENT_STATUSES.includes(request.status) ? request.status : 'Draft' };
      if (automaticDate) state.createdDate = Utilities.formatDate(new Date(), appSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
      saveState();
    }
    // Persist resumed request ownership and any corrected draft before rendering.
    saveState();
    const name = (id + ' - ' + data.subject.slice(0, 90)).replace(/[<>:"/\\|?*\x00-\x1f]/g, '-');
    if (!state.fileId) {
      stage = 'allocate';
      // Legacy attempts used the final name; new attempts use a request-specific name.
      // Search before allocation so a lost response does not produce a second file.
      const matches = DriveApp.getFilesByName(state.allocationName || name);
      let candidate;
      while (matches.hasNext()) {
        const match = matches.next();
        if (match.isTrashed()) continue;
        if (candidate || match.getMimeType() !== 'application/vnd.google-apps.document') {
          return jsonResponse({ success: false, message: 'Multiple or incompatible files match this interrupted creation. No new file was created. Ask the administrator to check the matching Drive files.' });
        }
        candidate = match;
      }
      if (candidate) {
        const pending = DocumentApp.openById(candidate.getId());
        if (pending.getBody().getText().trim()) {
          return jsonResponse({ success: false, message: 'A matching document already contains content. No new file was created or overwritten. Ask the administrator to reconcile its registry entry.' });
        }
        state.fileId = candidate.getId();
        saveState();
        pending.saveAndClose();
      } else {
        state.allocationName = '[OP pending ' + state.requestId + '] ' + name;
        saveState();
        const doc = DocumentApp.create(state.allocationName);
        state.fileId = doc.getId();
        saveState();
        doc.saveAndClose();
      }
    }
    if (automaticDate) { data.date = state.createdDate; data.year = state.createdDate.slice(0, 4); }
    const file = DriveApp.getFileById(state.fileId);
    if (file.isTrashed()) throw new Error('File unavailable');
    if (state.allocationName) file.setName(name);
    if (!state.rendered) {
      stage = 'generate';
      if (memo) {
        if (typeof request.logo !== 'string' || request.logo.length > 1500000) throw new Error('Logo unavailable');
        const logo = Utilities.newBlob(Utilities.base64Decode(request.logo), 'image/png', 'jhcsclogo.png');
        renderExecutiveMemorandum(DocumentApp.openById(state.fileId), data, logo);
      } else renderCreatedDocument(DocumentApp.openById(state.fileId), data, type);
      const root = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
      if (root.isTrashed()) throw new Error('The destination folder is in the trash.');
      const folder = filingSubfolder(filingSubfolder(root, type), data.year);
      file.moveTo(folder);
      state.rendered = true;
      saveState();
    }
    stage = 'registry';
    const record = { activity: type.toUpperCase(), id: id, date: executiveMemoDate(data.date), subject: data.subject, url: 'https://drive.google.com/file/d/' + state.fileId + '/view', type: type, year: data.year, status: state.status };
    const row = index >= 0 ? index + 2 : sheet.getLastRow() + 1;
    if (index < 0) {
      const values = [record.activity, id, record.date, record.subject, record.url].map((value, i) => {
        const builder = SpreadsheetApp.newRichTextValue().setText(value);
        if (i === 4) builder.setLinkUrl(value);
        return builder.build();
      });
      sheet.getRange(row, 1, 1, 5).setRichTextValues([values]);
    }
    const cell = sheet.getRange(row, 2);
    let metadata = {};
    try { metadata = JSON.parse(cell.getNote() || '{}') || {}; } catch (error) { /* Repair a partial registry write. */ }
    cell.setNote(JSON.stringify({ ...metadata, type: record.type, year: record.year, status: metadata.status || record.status, createdDocumentId: key }));
    if (!existingTypeLogRow(logSheet, id)) writeTypeLog(logSheet, logSheet.getLastRow() + 1, { ...record, date: new Date().toISOString() });
    logCreatedDocument(creationSheet, { ...record, status: metadata.status || record.status }, data, key);
    SpreadsheetApp.flush();
    state.completed = true;
    saveState();
    return jsonResponse({ success: true, document: documentFromRow([record.activity, id, record.date, record.subject, record.url], cell.getNote()) });
  } catch (error) {
    console.error('Document creation failed during ' + stage + ': ' + String(error && error.message || error));
    if (stage === 'allocate') return jsonResponse({ success: false, message: 'Google Docs creation could not finish. The deployment owner should run checkCreateDocumentSetup in Apps Script and authorize access, then update the web app deployment. Retry the same fields afterward; the reserved number can be recovered automatically.' });
    return jsonResponse({ success: false, message: stage === 'registry' ? 'Document was created, but MAIN Files or the ' + CREATED_DOCUMENT_SHEETS[type] + ' / category log could not be updated. Retry with the same fields to finish logging without creating another document.' : 'Unable to create ' + type + '. Please retry with the same fields. If this persists, ask the administrator to check document access and sheet configuration.' });
  } finally { if (locked) lock.releaseLock(); }
}

// Run as the deployment owner to request the document service's required scopes.
function checkCreateDocumentSetup() {
  checkUploadSetup();
  Object.keys(CREATED_DOCUMENT_SHEETS).forEach(type => createdDocumentSheet(type));
  DocumentApp.getActiveDocument();
  console.log('Creation configuration checked. Update the web app deployment after authorizing access.');
}
