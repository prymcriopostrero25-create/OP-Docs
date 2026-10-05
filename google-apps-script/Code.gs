const SPREADSHEET_ID = '1_XdWhaHzHqgfa_sUIzp4gTg00E7FeK3XWAh6ckTS2WM';
// Reuse the spreadsheet handle within this Apps Script execution only.
let spreadsheetForExecution;
function appSpreadsheet() {
  if (!spreadsheetForExecution) spreadsheetForExecution = SpreadsheetApp.openById(SPREADSHEET_ID);
  return spreadsheetForExecution;
}

// Run in the editor: checks account configuration without logging passwords.
function checkLoginSetup() {
  const spreadsheet = appSpreadsheet();
  const sheet = spreadsheet.getSheetByName('CREDENTIALS');
  if (!sheet) throw new Error('CREDENTIALS tab is missing.');
  if (sheet.getRange(1, 1, 1, 4).getDisplayValues()[0].join('|') !== 'EMAIL|NAME|PASSWORD|ROLE') {
    throw new Error('CREDENTIALS needs EMAIL, NAME, PASSWORD, ROLE in A1:D1.');
  }
  const rows = sheetDataRows(sheet, 1, 4);
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
  Trav_Ord: ['REFERENCE NUMBER', 'RECIPIENT LABEL (To or For)', 'NAME OF THE RECIPIENT', 'POSITION/OFFICE', 'PLACE', 'INCLUSIVE DATES', 'MODE OF TRANSPORTATION', 'PURPOSE', 'REMARKS'],
  Auth_Travel: ['ID', 'DATE (date created)', 'BODY', 'DATE (issue)', 'EMPLOYEE NAME', 'POSITION / DESIGNATION', 'SALARY GRADE', 'EMPLOYMENT STATUS', 'TRAVEL DATE FROM', 'TRAVEL DATE UNTIL', 'PURPOSE', 'DESTINATION', 'TRAVEL CLASSIFICATION', 'APPROVING AUTHORITY', 'AUTHORITY POSITION', 'COPY FURNISHED'],
  Cert_Travel: ['ID', 'DATE (date created)', 'BODY', 'DATE ISSUED', 'EMPLOYEE NAME', 'SALARY GRADE', 'EMPLOYMENT STATUS', 'TRAVEL DATE FROM', 'TRAVEL DATE UNTIL', 'DESTINATION', 'TRAVEL CLASSIFICATION', 'CERTIFYING AUTHORITY', 'AUTHORITY POSITION', 'COPY FURNISHED'],
};
const LEGACY_TRAVEL_ORDER_HEADERS = [
  ['REFERENCE NUMBER', 'RECIPIENT LABEL (To or For)', 'POSITION', 'NAME OF INSTITUTION', 'PLACE', 'INCLUSIVE DATE', 'TRANSPORTATION', 'PURPOSE', 'REMARKS'],
  ['REFERENCE NUMBER', 'RECIPIENT LABEL (To or For)', 'NAME OF THE RECIPIENT', 'POSITION/OFFICE', 'PLACE', 'INCLUSIVE DATES', 'MODE OF TRANSPORTATION', 'PURPOSE', 'REMARKS'],
];

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

  if (name === 'Auth_Travel') {
    const authorityHeaders = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
    const legacy = authorityHeaders.slice(0, 3).map(normalizeHeader).join('|') === headers.slice(0, 3).map(normalizeHeader).join('|') && authorityHeaders.slice(3).every(value => !value);
    if (legacy) sheet.getRange(1, 4, 1, headers.length - 3).setValues([headers.slice(3)]);
  }

  if (name === 'Cert_Travel') {
    const certificateHeaders = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
    const legacy = certificateHeaders.slice(0, 3).map(normalizeHeader).join('|') === headers.slice(0, 3).map(normalizeHeader).join('|') && certificateHeaders.slice(3).every(value => !value);
    if (legacy) sheet.getRange(1, 4, 1, headers.length - 3).setValues([headers.slice(3)]);
    if (normalizeHeader(certificateHeaders[3]) === normalizeHeader('DATE (date issue)')) sheet.getRange(1, 4).setValue('DATE ISSUED');
  }

  const actual = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0].map(normalizeHeader);
  const expected = headers.map(normalizeHeader);

  const acceptedTravelOrderHeader = name === 'Trav_Ord' && (
    actual.join('|') === expected.join('|') ||
    LEGACY_TRAVEL_ORDER_HEADERS.some(candidate => candidate.map(normalizeHeader).join('|') === actual.join('|'))
  );

  if (name === 'Trav_Ord' && !acceptedTravelOrderHeader) {
    throw new Error('Check the ' + name + ' sheet headers.');
  }

  if (name !== 'Trav_Ord' && actual.join('|') !== expected.join('|')) {
    throw new Error('Check the ' + name + ' sheet headers.');
  }

  return sheet;
}

function createdDocumentLogSnapshot(sheet) {
  const lastRow = sheet.getLastRow();
  const range = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1) : null;
  return { lastRow: lastRow, rows: range ? range.getDisplayValues() : [], notes: range ? range.getNotes() : [] };
}

function logCreatedDocument(sheet, record, data, internalId, snapshot) {
  const { lastRow, rows, notes } = snapshot || createdDocumentLogSnapshot(sheet);
  const existing = rows.findIndex((row, index) => {
    let note = {};
    try { note = JSON.parse(notes[index][0] || '{}') || {}; } catch (error) { /* Legacy rows. */ }
    return row[0] === internalId || note.createdDocumentId === internalId;
  });
  const row = existing >= 0 ? existing + 2 : lastRow + 1;
  const label = data.recipientLabel || (data.to ? 'To' : 'For');
  const values = record.type === 'Certificate of Travel' ? [internalId, record.date, data.body || data.content, data.issueDate, data.recipientName, data.salaryGrade, data.employmentStatus, data.travelFrom, data.travelUntil, data.place, data.travelClassification, data.signatory, data.position, data.cc]
    : record.type === 'Authority to Travel Abroad' ? [internalId, record.date, data.body || data.content, data.issueDate, data.recipientName, data.recipientPosition, data.salaryGrade, data.employmentStatus, data.travelFrom, data.travelUntil, data.purpose, data.place, data.travelClassification, data.signatory, data.signatoryPosition || data.position, data.cc]
    : record.type === 'Travel Order'
      ? [record.id, label, data.recipientName || data.recipient, data.recipientPosition, data.place || data.destination, data.inclusiveDate || data.travelDates, data.transportation, data.purpose, data.remarks]
      : record.type === 'Executive Memorandum'
        ? [internalId, record.id, label, data.recipientName, data.recipientPosition, data.institution, data.thru, record.subject, record.date, data.body || data.content, record.status, data.additionalInstitution]
      : record.type === 'Special Order'
        ? [internalId, record.id, label, data.recipientName || data.recipient, data.recipientPosition, data.institution, data.thru, record.subject, record.date, data.body || data.content, record.status, data.additionalInstitution]
      : [internalId, record.id, label, data.recipientPosition, data.institution, data.thru, record.subject, record.date, data.body || data.content, record.status, data.additionalInstitution];
  // Keep the file URL on the ID, preserving the PDF's exact column count.
  sheet.getRange(row, 1).setNote(JSON.stringify({ createdDocumentId: internalId, reference: record.id, url: record.url }));
  sheet.getRange(row, 1, 1, values.length).setRichTextValues([values.map((value, index) => {
    const builder = SpreadsheetApp.newRichTextValue().setText(String(value || ''));
    if (index === 0 && record.type !== 'Travel Order') builder.setLinkUrl(record.url);
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

// Only doPost owns this cache; never reuse authorization between requests.
let requestAccounts;
function authenticatedAccount(token) {
  if (typeof token !== 'string' || !token) return null;
  if (requestAccounts && requestAccounts.has(token)) return requestAccounts.get(token);
  const email = CacheService.getScriptCache().get('session:' + token);
  let account = null;
  if (email && !sessionRevoked(email, token)) {
    const sheet = appSpreadsheet().getSheetByName('CREDENTIALS');
    const rows = sheet ? sheetDataRows(sheet, 1, 4) : [];
    const row = rows.find(item => String(item[0]).trim().toLowerCase() === email);
    if (row) account = { email: email, name: row[1], role: normalizeRole(row[3]), token: token };
  }
  if (requestAccounts) requestAccounts.set(token, account);
  return account;
}

// Read the row count once per snapshot, without caching mutable sheet contents.
function sheetDataRows(sheet, column, width) {
  const count = sheet.getLastRow() - 1;
  return count > 0 ? sheet.getRange(2, column, count, width).getDisplayValues() : [];
}

function canChangeDocumentStatus(token) {
  const account = authenticatedAccount(token);
  return !!account && ['admin', 'super admin'].includes(account.role);
}

function updateDocumentStatus(request) {
  if (!canChangeDocumentStatus(request.token)) return jsonResponse({ success: false, message: 'Admin access is required to change document status.' });
  if (!DOCUMENT_STATUSES.includes(request.status)) return jsonResponse({ success: false, message: 'Choose a valid document status.' });
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = mainFilesSheet();
    const rows = sheetDataRows(sheet, 1, 5);
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
    metadata.updated = new Date().toISOString();
    if (request.status === 'Approved' && !metadata.approvedAt) metadata.approvedAt = metadata.updated;
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
    deleted: metadata.deleted === true, owner: metadata.owner || '', updated: metadata.updated || row[2], editableContent: !!metadata.form && metadata.form.templateVersion === 2, approvedAt: metadata.approvedAt || '',
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
    const rows = sheetDataRows(sheet, 1, 5);
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
      let sourceId;
      try { sourceId = JSON.parse(cell.getNote() || '{}').form?.bodyRichFileId; } catch (error) { /* Legacy records may not contain JSON notes. */ }
      deleteDocumentFiles(record, sheet, index + 2, sourceId);
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

function deleteDocumentFiles(record, mainSheet, mainRow, bodyRichFileId) {
  const match = /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/(view|preview)$/.exec(record.url);
  if (!match) throw new Error('The document has an invalid Drive link. Nothing was deleted.');
  // Resolve all sheets and the exact file before making any changes.
  const logs = FILING_TYPES.map(type => {
    const sheet = typeLogSheet(type);
    const rows = sheetDataRows(sheet, 2, 1);
    return { sheet: sheet, rows: rows.map((row, index) => row[0] === record.id ? index + 2 : 0).filter(Boolean).reverse() };
  });
  const file = DriveApp.getFileById(match[1]);
  const bodySource = bodyRichFileId ? DriveApp.getFileById(bodyRichFileId) : null;
  if (!file.isTrashed()) file.setTrashed(true);
  if (bodySource && !bodySource.isTrashed()) bodySource.setTrashed(true);
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
  requestAccounts = new Map();
  try {
    const request = JSON.parse(e.postData.contents || '{}');
    if (request.action === 'editorCapabilities') {
      if (!getDocumentSession(request.token)) return jsonResponse({ success: false, message: 'Your session expired. Please sign in again.' });
      return jsonResponse({ success: true, richBodyVersion: 1 });
    }
    if (['currentUser', 'createUser', 'updateUser', 'deleteUser', 'verificationLink', 'verify', 'sendDocument', 'documentDetails', 'updateDocumentContent'].includes(request.action)) return workflowRequest(request);
    if (request.action === 'documentPage') return documentPage(request);
    if (request.action === 'prepareDocumentPreview') return prepareDocumentPreview(request);
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
      String(row[0]).trim().toLowerCase() === email && verifyPassword_(password, row[2])
    );

    if (!account || accountSettings(email).disabled) {
      return jsonResponse({ success: false, message: 'Incorrect email or password.' });
    }

    if (!String(account[2]).startsWith('v2$')) sheet.getRange(accounts.indexOf(account) + 2, 3).setValue(hashPassword_(password));
    logSuccessfulLogin(String(account[1]).trim());

    const token = Utilities.getUuid() + Utilities.getUuid();
    CacheService.getScriptCache().put('session:' + token, email, 21600);
    CacheService.getScriptCache().put('issued:' + token, String(Date.now()), 21600);

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
  } finally {
    requestAccounts = undefined;
  }
}

// Page content loads independently from the background PDF export.
function documentPage(request) {
  if (!getDocumentSession(request.token)) return jsonResponse({ success: false, message: 'Your session expired. Please sign in again.' });
  try {
    const entry = workflowDocument(request.id);
    return jsonResponse({ success: true, form: loadRichBodyForm(entry.metadata.form), type: entry.record.type });
  } catch (error) { return jsonResponse({ success: false, message: error.message }); }
}

// Server-owned PDF cache, keyed by Drive revision. Never accept attachment bytes
// from the browser. Missing/evicted chunks safely fall back to a fresh export.
function preparedDocumentPdf(file) {
  const native = file.getMimeType() === 'application/vnd.google-apps.document';
  if (!native) return file.getBlob();
  let cache, key;
  try {
    cache = CacheService.getScriptCache();
    key = 'pdf:' + file.getId() + ':' + file.getLastUpdated().getTime();
    const count = Number(cache.get(key));
    if (Number.isInteger(count) && count > 0 && count <= 300) {
      const keys = Array.from({ length: count }, (_, i) => key + ':' + i);
      const chunks = cache.getAll(keys);
      if (keys.every(part => typeof chunks[part] === 'string')) {
        return Utilities.newBlob(Utilities.base64Decode(keys.map(part => chunks[part]).join('')), 'application/pdf', file.getName() + '.pdf');
      }
    }
  } catch (error) { /* Cache is optional; export remains available. */ }
  const pdf = file.getAs('application/pdf');
  try {
    if (cache && key) {
      const data = Utilities.base64Encode(pdf.getBytes());
      const count = Math.ceil(data.length / 80000);
      if (count > 0 && count <= 300) {
        const chunks = {};
        for (let i = 0; i < count; i++) chunks[key + ':' + i] = data.slice(i * 80000, (i + 1) * 80000);
        cache.putAll(chunks, 600);
        cache.put(key, String(count), 600);
      }
    }
  } catch (error) { /* Cache failures must not block download or sending. */ }
  return pdf;
}

// Export only the registered document, and only when its preview is opened.
function prepareDocumentPreview(request) {
  if (!getDocumentSession(request.token)) return jsonResponse({ success: false, message: 'Your session expired. Please sign in again.' });
  try {
    const sheet = mainFilesSheet();
    const rows = sheetDataRows(sheet, 1, 5);
    const index = rows.findIndex(row => row[1] === request.id);
    if (index < 0 || documentFromRow(rows[index], sheet.getRange(index + 2, 2).getNote()).deleted) throw new Error('Document was not found.');
    const match = /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/(view|preview)$/.exec(rows[index][4]);
    if (!match) throw new Error('Invalid document link.');
    const file = DriveApp.getFileById(match[1]);
    if (file.isTrashed()) throw new Error('Document is in Trash.');
    const native = file.getMimeType() === 'application/vnd.google-apps.document';
    if (!native && file.getMimeType() !== 'application/pdf') throw new Error('Unsupported document format.');
    let certificateLayoutVersion, authorityLayoutVersion;
    if (native) {
      const metadata = JSON.parse(sheet.getRange(index + 2, 2).getNote() || '{}');
      if (metadata.type === 'Authority to Travel Abroad' && metadata.form) {
        const lock = LockService.getScriptLock();
        lock.waitLock(30000);
        try {
          const cell = sheet.getRange(index + 2, 2);
          const current = JSON.parse(cell.getNote() || '{}');
          if (current.form.authorityLayoutVersion !== 2) {
            const doc = DocumentApp.openById(file.getId());
            doc.getBody().replaceText('This is to CERTIFY that, where applicable to personal travel', 'This is to AUTHORIZED that, where applicable to personal travel');
            doc.saveAndClose();
            current.form.body = current.form.authorityStructured ? travelAuthorityBody(current.form) : String(current.form.body || current.form.content || '').replace('This is to CERTIFY that, where applicable to personal travel', 'This is to AUTHORIZED that, where applicable to personal travel');
            current.form.authorityLayoutVersion = 2;
            cell.setNote(JSON.stringify(current));
            SpreadsheetApp.flush();
          }
          authorityLayoutVersion = current.form.authorityLayoutVersion;
        } finally { lock.releaseLock(); }
      }
      if (metadata.type === 'Certificate of Travel' && metadata.form) {
        const lock = LockService.getScriptLock();
        lock.waitLock(30000);
        try {
          const cell = sheet.getRange(index + 2, 2);
          const current = JSON.parse(cell.getNote() || '{}');
          if (current.form.certificateLayoutVersion !== 3) {
            if (!request.logo || typeof request.logo !== 'string' || request.logo.length > 1500000) throw new Error('The college logo is required to update the certificate PDF. Refresh the app and retry.');
            const logo = Utilities.newBlob(Utilities.base64Decode(request.logo), 'image/png', 'jhcsclogo.png');
            renderTravelCertificate(DocumentApp.openById(file.getId()), current.form, logo);
            cell.setNote(JSON.stringify(current));
            SpreadsheetApp.flush();
          }
          certificateLayoutVersion = current.form.certificateLayoutVersion;
        } finally { lock.releaseLock(); }
      }
    }
    const pdf = preparedDocumentPdf(file);
    return jsonResponse({ success: true, certificateLayoutVersion: certificateLayoutVersion, authorityLayoutVersion: authorityLayoutVersion, native: native, fileId: file.getId(), name: file.getName().replace(/\.pdf$/i, '') + '.pdf', data: Utilities.base64Encode(pdf.getBytes()) });
  } catch (error) {
    return jsonResponse({ success: false, message: 'Unable to prepare the PDF. ' + error.message });
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
  const settings = PropertiesService.getScriptProperties().getProperties();
  const users = rows
    .filter((row) => String(row[0]).trim() || String(row[1]).trim())
    .map((row) => ({
      email: String(row[0]).trim(),
      name: String(row[1]).trim(),
      role: normalizeRole(row[3]),
      status: JSON.parse(settings['account:' + String(row[0]).trim().toLowerCase()] || '{}').disabled ? 'Inactive' : 'Active',
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
  const account = authenticatedAccount(token);
  return !!account && account.role === 'super admin';
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
  return !!authenticatedAccount(token);
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
  const mainRows = sheetDataRows(mainSheet, 1, 5);
  const notes = mainRows.length ? mainSheet.getRange(2, 2, mainRows.length, 1).getNotes() : [];
  const current = mainRows.map((row, index) => documentFromRow(row, notes[index][0])).filter(record => record.id && !record.deleted);
  let events = [];
  const sheet = appSpreadsheet().getSheetByName('ACTIVITY LOG');
  if (sheet && sheet.getLastRow() > 1) events = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getDisplayValues().map(activityFromRow).filter(record => record.id);
  return jsonResponse({ success: true, activities: current.concat(events) });
}

function getDocuments() {
  const sheet = mainFilesSheet();
  const rows = sheetDataRows(sheet, 1, 5);
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
    sheet.getRange(row, 2).setNote(JSON.stringify({ type: type, year: year, status: record.status, owner: CacheService.getScriptCache().get('session:' + request.token) }));
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

function renderExecutiveMemorandum(doc, data, logo, heading) {
  const body = doc.getBody();
  body.clear();
  // Shared letterhead and layout for memoranda and special orders.
  const green = '#356442';
  const leftMargin = data.bodyRich ? data.bodyRich.attrs.marginLeft * 72 : 52;
  const rightMargin = data.bodyRich ? data.bodyRich.attrs.marginRight * 72 : 52;
  const contentWidth = 612 - leftMargin - rightMargin;
  body.setPageWidth(612).setPageHeight(792).setMarginTop(30).setMarginBottom(36).setMarginLeft(leftMargin).setMarginRight(rightMargin);
  body.setAttributes({ [DocumentApp.Attribute.FONT_FAMILY]: 'Arial', [DocumentApp.Attribute.FONT_SIZE]: 10 });
  const header = doc.getHeader() || doc.addHeader();
  header.clear();
  const letterhead = header.appendTable([['', 'J.H. CERILLES STATE COLLEGE\nMati, San Miguel, Zamboanga del Sur  |  main@jhcsc.edu.ph  |  +63 915 2484 538\nOFFICE OF THE PRESIDENT']]);
  letterhead.setBorderWidth(0).setColumnWidth(0, 54).setColumnWidth(1, contentWidth - 54);
  const image = letterhead.getCell(0, 0).getChild(0).asParagraph().appendInlineImage(logo);
  image.setHeight(Math.round(43 * image.getHeight() / image.getWidth())).setWidth(43);
  const brand = letterhead.getCell(0, 1);
  for (let i = 0; i < brand.getNumChildren(); i++) {
    const p = brand.getChild(i).asParagraph().setSpacingBefore(0).setSpacingAfter(0);
    p.editAsText().setFontFamily('Arial').setFontSize(i === 0 ? 15 : 8).setBold(i !== 1).setForegroundColor(i === 0 ? green : i === 1 ? '#707875' : '#202820');
  }
  // A narrow filled table provides a consistent green rule in Google Docs/PDF.
  const rule = header.appendTable([['']]);
  rule.setBorderWidth(0).setColumnWidth(0, contentWidth);
  rule.getCell(0, 0).setBackgroundColor(green).setPaddingTop(0).setPaddingBottom(0)
    .getChild(0).asParagraph().setSpacingBefore(0).setSpacingAfter(0).editAsText().setFontSize(1);
  body.appendParagraph('').setSpacingAfter(12).editAsText().setFontSize(1);
  const title = heading || (data.number ? 'Executive Memorandum Order No. ' + data.number : data.reference);
  const banner = body.appendTable([[String(title).toUpperCase(), 'Series of ' + data.year]]);
  banner.setBorderColor(green).setBorderWidth(0.5).setColumnWidth(0, contentWidth * 290 / 508).setColumnWidth(1, contentWidth * 218 / 508);
  for (let col = 0; col < 2; col++) {
    banner.getCell(0, col).setBackgroundColor('#f4f6f5').setPaddingTop(0).setPaddingBottom(0).setPaddingLeft(0)
      .editAsText().setFontFamily('Arial').setFontSize(10).setBold(false);
  }
  body.appendParagraph('').setSpacingAfter(12).editAsText().setFontSize(1);
  const recipient = [data.recipientName || data.recipient, data.recipientPosition, data.institution, data.additionalInstitution].filter(Boolean).join('\n');
  const details = [[(data.recipientLabel || 'For').toUpperCase() + ':', recipient]];
  if (data.thru) details.push(['THRU:', data.thru]);
  details.push(['SUBJECT:', String(data.subject || '').toUpperCase()], ['DATE:', executiveMemoDate(data.date).toUpperCase()]);
  const info = body.appendTable(details);
  info.setBorderWidth(0).setColumnWidth(0, contentWidth * 140 / 508).setColumnWidth(1, contentWidth * 368 / 508);
  for (let row = 0; row < details.length; row++) {
    for (let col = 0; col < 2; col++) {
      info.getCell(row, col).setPaddingTop(0).setPaddingBottom(2).setPaddingLeft(0).setPaddingRight(0)
        .editAsText().setFontFamily('Arial').setFontSize(10).setBold(false);
    }
  }
  body.appendParagraph('').setSpacingAfter(6).editAsText().setFontSize(1);
  // Explicit sizing prevents content from inheriting the 1-point spacer style.
  if (data.bodyRich) renderRichBody(body, data.bodyRich);
  else String(data.body || '').split(/\r?\n/).forEach(line => body.appendParagraph(line)
    .setIndentFirstLine(21.6).setLineSpacing(1).setSpacingAfter(6).editAsText().setFontFamily('Arial').setFontSize(12).setBold(false));
  body.appendParagraph(data.signatory).setIndentStart(contentWidth * 266 / 508).setSpacingBefore(24).setSpacingAfter(0).editAsText().setFontFamily('Arial').setFontSize(12).setBold(false);
  body.appendParagraph(data.position).setIndentStart(contentWidth * 266 / 508).setSpacingAfter(12).editAsText().setFontFamily('Arial').setFontSize(12).setBold(false);
  if (data.cc) body.appendParagraph('cc:\n' + data.cc).editAsText().setFontSize(9).setBold(false);
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

function renderSpecialOrder(doc, data, logo) {
  const reference = String(data.reference || '');
  const heading = /^(?:special order|SO)\b/i.test(reference) ? reference : 'Special Order No. ' + reference;
  return renderExecutiveMemorandum(doc, {
    ...data,
    subject: String(data.subject || '').toUpperCase(),
    body: data.body || data.content || '',
    signatory: data.signatory || 'EDGARDO H. ROSALES, JD, Ed.D.',
    position: data.position || 'SUC President II',
  }, logo, heading);
}

function renderCreatedDocument(doc, data, type, logo) {
  if (type === 'Authority to Travel Abroad') return renderTravelAuthority(doc, data, logo);
  if (type === 'Certificate of Travel') return renderTravelCertificate(doc, data, logo);
  if (type === 'Special Order') return renderSpecialOrder(doc, data, logo);
  if (type === 'Travel Order') return renderOrderTemplate(doc, data, type, data.logo || '');
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

function travelCertificateBody(data) {
  const dates = data.inclusiveDate || '[TRAVEL DATE/S]';
  return 'This is to certify that the requested travel abroad to ' + (data.place || '[DESTINATION]') + ', from ' + dates + ', by ' + (data.recipientName || data.recipient || '[EMPLOYEE NAME]') + ' (Salary Grade ' + (data.salaryGrade || '[SALARY GRADE]') + '), a ' + (data.employmentStatus || '[EMPLOYMENT STATUS]') + ' employee of J.H. Cerilles State College, is considered ' + (data.travelClassification || '[PERSONAL LEAVE / OTHER APPROVED CLASSIFICATION]') + ' only. The personnel concerned will not represent the institution and will not utilize government funds for the said personal travel.\n\n' +
    'This certificate is issued on ' + (data.issueDate ? executiveMemoDate(data.issueDate) : '[DATE ISSUED]') + ', at the JHCSC Main Campus, Mati, San Miguel, Zamboanga del Sur, for whatever legal purpose it may serve.';
}

function travelAuthorityBody(form) {
  const value = form.issueDate || form.date
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').map(Number) : null
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return [
    `This refers to the proposed travel to ${form.place || '[DESTINATION]'} on ${(form.inclusiveDate || '[TRAVEL DATE/S]')}. Relative to the aforementioned travel, please be informed that the request is hereby APPROVED as ${form.travelClassification || '[PERSONAL LEAVE / OFFICIAL TRAVEL / OTHER CLASSIFICATION]'} for the period stated above only.`,
    'This is to AUTHORIZED that, where applicable to personal travel, the personnel concerned shall not represent the institution and shall not utilize government funds for the approved travel.',
    `Issued this ${date ? date[2] : '[DAY]'} day of ${date ? months[date[1] - 1] : '[MONTH]'}, ${date ? date[0] : '[YEAR]'} at the JHCSC Main Campus, Mati, San Miguel, Zamboanga del Sur, for whatever legal purpose it may serve.`,
  ].join('\n\n')
}

function renderTravelAuthority(doc, data, logo) {
  return renderTravelCertificate(doc, data, logo, true);
}

function renderTravelCertificate(doc, data, logo, authority) {
  const body = doc.getBody();
  body.clear();
  if (doc.getHeader()) doc.getHeader().clear();
  const width = 491.94;
  body.setPageWidth(595.44).setPageHeight(841.68).setMarginLeft(51.75).setMarginRight(51.75).setMarginTop(30).setMarginBottom(36);
  body.setAttributes({ [DocumentApp.Attribute.FONT_FAMILY]: 'Arial', [DocumentApp.Attribute.FONT_SIZE]: 10.5, [DocumentApp.Attribute.FOREGROUND_COLOR]: '#202820' });
  function style(paragraph, size, bold, color) {
    paragraph.setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(1.2);
    paragraph.editAsText().setFontFamily('Arial').setFontSize(size).setBold(bold).setForegroundColor(color || '#202820');
    return paragraph;
  }
  function spacer(points) { style(body.appendParagraph(''), 1, false).setSpacingAfter(points); }
  const letterhead = body.appendTable([['', 'J.H. CERILLES STATE COLLEGE\nMati, San Miguel, Zamboanga del Sur | main@jhcsc.edu.ph | +63 915 2484 538\nOFFICE OF THE PRESIDENT']]);
  letterhead.setBorderWidth(0).setColumnWidth(0, 51).setColumnWidth(1, width - 51);
  for (let col = 0; col < 2; col++) letterhead.getCell(0, col).setPaddingTop(0).setPaddingBottom(0).setPaddingLeft(0).setPaddingRight(0);
  const image = letterhead.getCell(0, 0).getChild(0).asParagraph().appendInlineImage(logo);
  image.setHeight(Math.round(45 * image.getHeight() / image.getWidth())).setWidth(45);
  const brand = letterhead.getCell(0, 1);
  for (let i = 0; i < brand.getNumChildren(); i++) style(brand.getChild(i).asParagraph(), i === 0 ? 16 : i === 1 ? 8 : 9, i !== 1, i === 0 ? '#356442' : i === 1 ? '#707875' : '#202820');
  spacer(24);
  const rule = body.appendTable([['']]);
  rule.setBorderWidth(0).setColumnWidth(0, width);
  rule.getCell(0, 0).setBackgroundColor('#356442').setPaddingTop(0).setPaddingBottom(0);
  style(rule.getCell(0, 0).getChild(0).asParagraph(), 1, false);
  const banner = body.appendTable([[authority ? 'AUTHORITY TO TRAVEL ABROAD' : 'TRAVEL CERTIFICATE', authority ? 'AUTHORIZATION' : 'CERTIFICATION']]);
  banner.setBorderWidth(0).setColumnWidth(0, width / 2).setColumnWidth(1, width / 2);
  for (let col = 0; col < 2; col++) {
    const cell = banner.getCell(0, col).setPaddingLeft(0).setPaddingTop(6).setPaddingBottom(6);
    style(cell.getChild(0).asParagraph(), col === 0 ? 14 : 8.5, true, col === 0 ? '#202820' : '#356442');
    if (col === 1) { cell.setBackgroundColor('#eaf0ec'); cell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER); }
  }
  spacer(18);
  const details = body.appendTable(authority ? [["EMPLOYEE'S NAME", data.recipientName || '[FULL NAME]'], ['POSITION', data.recipientPosition || '[POSITION / DESIGNATION]'], ['SALARY GRADE', data.salaryGrade || '[SG]'], ['STATUS', data.employmentStatus || '[PERMANENT / TEMPORARY / COS / OTHER]'], ['TRAVEL DATE/S', data.inclusiveDate || '[TRAVEL DATE/S]'], ['PURPOSE', data.purpose || '[PERSONAL LEAVE / OFFICIAL PURPOSE]'], ['DESTINATION', data.place || '[COUNTRY / DESTINATION]']] : [['EMPLOYEE', data.recipientName || data.recipient || '[FULL NAME OF EMPLOYEE]'], ['DESTINATION', data.place || '[COUNTRY / DESTINATION]'], ['TRAVEL DATE/S', data.inclusiveDate || '[TRAVEL DATE/S]']]);
  details.setBorderWidth(0.5).setBorderColor('#e1e6e3').setColumnWidth(0, width / 2).setColumnWidth(1, width / 2);
  for (let row = 0; row < (authority ? 7 : 3); row++) for (let col = 0; col < 2; col++) {
    const cell = details.getCell(row, col).setPaddingLeft(3).setPaddingRight(3).setPaddingTop(4).setPaddingBottom(4);
    if (col === 0) cell.setBackgroundColor('#f3f6f4');
    style(cell.getChild(0).asParagraph(), col === 0 ? 8.5 : 10, col === 0, col === 0 ? '#356442' : '#202820');
  }
  spacer(21);
  const content = authority ? (data.authorityStructured ? travelAuthorityBody(data) : data.body || data.content || travelAuthorityBody(data)) : data.certificateStructured ? travelCertificateBody(data) : data.body || data.content || travelCertificateBody(data);
  content.split(/\r?\n/).forEach(line => style(body.appendParagraph(line), 10.5, false).setAlignment(DocumentApp.HorizontalAlignment.JUSTIFY).setIndentFirstLine(20.25).setSpacingAfter(9));
  spacer(18);
  // A fixed empty left column positions every signature line like the preview.
  const signature = body.appendTable([['', '']]);
  signature.setBorderWidth(0).setColumnWidth(0, width * 0.49).setColumnWidth(1, width * 0.51);
  for (let col = 0; col < 2; col++) signature.getCell(0, col).setPaddingLeft(0).setPaddingRight(0).setPaddingTop(0).setPaddingBottom(0);
  const signatureCell = signature.getCell(0, 1);
  const certifiedBy = signatureCell.getChild(0).asParagraph();
  certifiedBy.setText(authority ? 'APPROVED:' : 'CERTIFIED BY:');
  style(certifiedBy, 9, true, '#707875').setAlignment(DocumentApp.HorizontalAlignment.LEFT).setIndentStart(0).setIndentFirstLine(0).setSpacingAfter(24);
  style(signatureCell.appendParagraph(data.signatory || '[NAME OF CERTIFYING AUTHORITY]'), 10.5, true).setAlignment(DocumentApp.HorizontalAlignment.LEFT).setIndentStart(0).setIndentFirstLine(0);
  style(signatureCell.appendParagraph(data.signatoryPosition || data.position || '[POSITION]'), 9, false, '#707875').setAlignment(DocumentApp.HorizontalAlignment.LEFT).setIndentStart(0).setIndentFirstLine(0);
  style(body.appendParagraph('cc: ' + (data.cc || (authority ? 'HRMO | Records/File' : '[HRMO / Records / Other concerned office]'))), 8.5, false, '#707875').setSpacingBefore(21);
  const footer = doc.getFooter() || doc.addFooter();
  footer.clear();
  const footerTable = footer.appendTable([['JHCSC | Office of the President', (authority ? 'Authority to Travel Abroad' : 'Travel Certificate') + ' | Page 1 of 1']]);
  footerTable.setBorderWidth(0.5).setBorderColor('#e1e6e3').setColumnWidth(0, width * 0.4).setColumnWidth(1, width * 0.6);
  for (let col = 0; col < 2; col++) style(footerTable.getCell(0, col).setPaddingLeft(0).setPaddingTop(6).getChild(0).asParagraph(), 8, false, '#707875');
  doc.saveAndClose();
  if (authority) data.authorityLayoutVersion = 2;
  else data.certificateLayoutVersion = 3;
}

// Native Travel Order master retains the fixed authorization, signature and footer.
const TRAVEL_ORDER_TEMPLATE_ID = '1MyxhPT3pS4XL66VyJyUBPbFaIblELfVMFHNv4hXY6qU';

function renderOrderTemplate(doc, data) {
  if (doc.getId() === TRAVEL_ORDER_TEMPLATE_ID) throw new Error('Cannot modify the Travel Order master.');
  const master = DocumentApp.openById(TRAVEL_ORDER_TEMPLATE_ID);
  function copySection(source, target) {
    target.setAttributes(source.getAttributes());
    target.clear();
    for (let i = 0; i < source.getNumChildren(); i++) {
      const child = source.getChild(i);
      const kind = child.getType();
      if (kind === DocumentApp.ElementType.PARAGRAPH) target.insertParagraph(i, child.asParagraph().copy());
      else if (kind === DocumentApp.ElementType.TABLE) target.insertTable(i, child.asTable().copy());
      else if (kind === DocumentApp.ElementType.LIST_ITEM) target.insertListItem(i, child.asListItem().copy());
      else throw new Error('Unsupported element in Travel Order template.');
    }
    // Google Docs forbids removing the final paragraph of a section. Remove the
    // placeholder before the copied final paragraph, keeping that paragraph last.
    const last = source.getNumChildren() - 1;
    if (last >= 0 && source.getChild(last).getType() === DocumentApp.ElementType.PARAGRAPH &&
        target.getNumChildren() > source.getNumChildren()) {
      const finalParagraph = target.getChild(last);
      const copiedFinal = finalParagraph.asParagraph().copy();
      target.insertParagraph(target.getNumChildren(), copiedFinal);
      target.removeChild(finalParagraph);
      while (target.getNumChildren() > source.getNumChildren()) {
        target.removeChild(target.getChild(target.getNumChildren() - 2));
      }
    }
  }
  const sourceBody = master.getBody();
  const sourceTables = sourceBody.getTables();
  if (sourceTables.length < 2) throw new Error('Travel Order template is missing its heading or details table.');
  copySection(sourceBody, doc.getBody());
  if (master.getHeader()) copySection(master.getHeader(), doc.getHeader() || doc.addHeader());
  if (master.getFooter()) copySection(master.getFooter(), doc.getFooter() || doc.addFooter());
  const tables = doc.getBody().getTables();
  function fill(table, row, col, value) {
    const text = table.getCell(row, col).getChild(0).asParagraph().editAsText();
    const attributes = text.getAttributes();
    text.setText(String(value || ''));
    text.setAttributes(attributes);
  }
  const number = String(data.reference || '').match(/\d+/);
  fill(tables[0], 0, 0, 'TRAVEL ORDER NO. ' + (number ? String(Number(number[0])).padStart(3, '0') : data.reference));
  fill(tables[0], 0, 1, 'Series of ' + data.year);
  fill(tables[1], 0, 0, String(data.recipientLabel || 'For').toUpperCase() + ':');
  const values = [data.recipientName || data.recipient, data.recipientPosition, data.place || data.destination,
    data.inclusiveDate || data.travelDates, data.transportation, data.purpose, data.remarks];
  values.forEach((value, row) => fill(tables[1], row, 1, value));
  // Replace the master's signature block with the memorandum's paragraph format.
  const body = doc.getBody();
  const signatureName = 'EDGARDO H. ROSALES, JD, Ed.D.';
  const signaturePosition = 'SUC President II';
  for (let i = body.getNumChildren() - 1; i >= 0; i--) {
    const child = body.getChild(i);
    const text = child.getText ? child.getText().trim() : '';
    const signatureOnly = text.replace(signatureName, '').replace(signaturePosition, '').trim() === '';
    if (text && signatureOnly && (text.includes(signatureName) || text === signaturePosition)) {
      // Keep a final paragraph in the section while removing the old signature.
      if (i === body.getNumChildren() - 1) body.appendParagraph('');
      body.removeChild(child);
    }
  }
  const contentWidth = body.getPageWidth() - body.getMarginLeft() - body.getMarginRight();
  body.appendParagraph(data.signatory || signatureName).setIndentStart(contentWidth * 266 / 508).setSpacingBefore(24).setSpacingAfter(0).editAsText().setFontFamily('Arial').setFontSize(12).setBold(false);
  body.appendParagraph(data.position || signaturePosition).setIndentStart(contentWidth * 266 / 508).setSpacingAfter(12).editAsText().setFontFamily('Arial').setFontSize(12).setBold(false);
  doc.saveAndClose();
}

function travelOrderDisplayId(reference, createdDate) {
  const raw = String(reference || '').match(/\d+/);
  const number = raw ? String(Number(raw[0])).padStart(3, '0') : '000';
  const date = String(createdDate || '').replace(/-/g, '');
  const month = date.slice(4, 6);
  const day = date.slice(6, 8);
  const year = date.slice(0, 4);
  return 'TO' + number + '-' + month + day + year;
}

// Field definitions from SHEET NAME FORMAT(TEMPLATE).pdf. POSITION is the recipient's position.
// Store the editor source outside spreadsheet notes, which cannot hold image data.
// Only server-owned IDs from record metadata may be passed as existingId.
function storeRichBodyForm(data, documentFile, existingId) {
  if (!data.bodyRich) return data;
  const source = JSON.stringify(data.bodyRich);
  let file;
  if (existingId) {
    file = DriveApp.getFileById(existingId);
    file.setContent(source);
  } else {
    const parents = documentFile.getParents();
    if (!parents.hasNext()) throw new Error('The document folder is unavailable.');
    const folder = parents.next();
    const name = documentFile.getId() + '.body.json';
    const matches = folder.getFilesByName(name);
    file = matches.hasNext() ? matches.next() : folder.createFile(name, source, 'application/json');
    file.setContent(source);
  }
  const stored = { ...data, bodyRichFileId: file.getId() };
  delete stored.bodyRich;
  return stored;
}

function loadRichBodyForm(form) {
  if (!form || !form.bodyRichFileId) return form || null;
  const source = DriveApp.getFileById(form.bodyRichFileId);
  if (source.isTrashed()) throw new Error('The formatted body source is unavailable.');
  return { ...form, bodyRich: validateRichBody(JSON.parse(source.getBlob().getDataAsString())) };
}

function richBodyPlainText(node) {
  if (node.type === 'text') return node.text;
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'image') return '[Image]';
  const separate = ['doc', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'table', 'tableRow', 'tableCell', 'tableHeader'].includes(node.type);
  return (node.content || []).map(richBodyPlainText).join(separate ? '\n' : '');
}

function validateRichBody(value) {
  if (!value || value.type !== 'doc' || JSON.stringify(value).length > 3000000) throw new Error('The formatted body is invalid or too large (maximum 3 MB).');
  const blocks = ['paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote', 'horizontalRule', 'pageBreak', 'image', 'table'];
  const allowed = { doc: blocks, paragraph: ['text', 'hardBreak'], heading: ['text', 'hardBreak'], bulletList: ['listItem'], orderedList: ['listItem'], listItem: ['paragraph', 'bulletList', 'orderedList'], blockquote: ['paragraph', 'heading', 'bulletList', 'orderedList'], table: ['tableRow'], tableRow: ['tableCell', 'tableHeader'], tableCell: ['paragraph', 'heading', 'bulletList', 'orderedList', 'image'], tableHeader: ['paragraph', 'heading', 'bulletList', 'orderedList', 'image'], text: [], hardBreak: [], horizontalRule: [], pageBreak: [], image: [] };
  let count = 0;
  const color = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value : null;
  function visit(node, depth) {
    if (++count > 10000 || depth > 20 || !node || !Object.prototype.hasOwnProperty.call(allowed, node.type)) throw new Error('The body contains unsupported formatting.');
    const clean = { type: node.type }, attrs = node.attrs || {};
    if (node.type === 'doc') clean.attrs = { marginLeft: [0.5, 0.75, 1, 1.25, 1.5].includes(attrs.marginLeft) ? attrs.marginLeft : 0.75, marginRight: [0.5, 0.75, 1, 1.25, 1.5].includes(attrs.marginRight) ? attrs.marginRight : 0.75 };
    if (node.type === 'text') {
      if (typeof node.text !== 'string' || !node.text) throw new Error('Invalid body text.');
      clean.text = node.text;
      clean.marks = (node.marks || []).map(mark => {
        if (['bold', 'italic', 'underline', 'strike'].includes(mark.type)) return { type: mark.type };
        const a = mark.attrs || {};
        if (mark.type === 'link' && /^(https?:\/\/|mailto:)/i.test(a.href || '') && a.href.length <= 2000) return { type: 'link', attrs: { href: a.href } };
        if (mark.type === 'highlight' && color(a.color)) return { type: 'highlight', attrs: { color: color(a.color) } };
        if (mark.type === 'textStyle') {
          const style = {};
          if (a.color) { if (!color(a.color)) throw new Error('Unsupported text color.'); style.color = a.color; }
          if (a.fontFamily) { if (!['Arial', 'Times New Roman', 'Calibri', 'Georgia', 'Verdana'].includes(a.fontFamily)) throw new Error('Choose a font from the editor toolbar.'); style.fontFamily = a.fontFamily; }
          if (a.fontSize) { if (!/^(8|9|10|11|12|14|16|18|24|30|36)pt$/.test(a.fontSize)) throw new Error('Choose a font size from the editor toolbar.'); style.fontSize = a.fontSize; }
          return { type: 'textStyle', attrs: style };
        }
        throw new Error('The body contains an unsupported text style or link.');
      });
    }
    if (['paragraph', 'heading'].includes(node.type)) {
      clean.attrs = { textAlign: ['left', 'center', 'right', 'justify'].includes(attrs.textAlign) ? attrs.textAlign : 'left', indent: Math.max(0, Math.min(8, Number(attrs.indent) || 0)), lineSpacing: [1, 1.15, 1.5, 2].includes(Number(attrs.lineSpacing)) ? Number(attrs.lineSpacing) : 1.15 };
      if (node.type === 'heading') clean.attrs.level = [1, 2, 3].includes(attrs.level) ? attrs.level : 1;
    }
    if (node.type === 'orderedList') clean.attrs = { start: Math.max(1, Math.min(9999, Number(attrs.start) || 1)) };
    if (node.type === 'table' && (!node.content?.length || node.content.length > 100)) throw new Error('Tables must have between 1 and 100 rows.');
    if (node.type === 'tableRow' && (!node.content?.length || node.content.length > 12)) throw new Error('Tables must have between 1 and 12 columns.');
    if (['tableCell', 'tableHeader'].includes(node.type) && ((attrs.colspan || 1) !== 1 || (attrs.rowspan || 1) !== 1)) throw new Error('Merged table cells are not supported. Split the cells before saving.');
    if (node.type === 'image') {
      if (!/^data:image\/(png|jpeg|gif);base64,[A-Za-z0-9+/=]+$/.test(attrs.src || '') || attrs.src.length > 1400000) throw new Error('Insert a PNG, JPEG, or GIF image up to 1 MB using the image button.');
      clean.attrs = { src: attrs.src, alt: String(attrs.alt || '').slice(0, 200), width: Math.max(24, Math.min(640, Number(attrs.width) || 480)) };
    }
    if (node.content) {
      if (!Array.isArray(node.content) || node.content.some(child => !allowed[node.type].includes(child?.type))) throw new Error('The body structure is unsupported.');
      clean.content = node.content.map(child => visit(child, depth + 1));
    }
    if (node.type === 'table' && clean.content.some(row => row.content.length !== clean.content[0].content.length)) throw new Error('Every table row must have the same number of cells.');
    return clean;
  }
  const result = visit(value, 0);
  if (!richBodyPlainText(result).trim()) throw new Error('Please enter body.');
  if (richBodyPlainText(result).length > 50000) throw new Error('The body is too long.');
  return result;
}

// Render structured content directly, never execute HTML supplied by the browser.
function renderRichBody(body, source) {
  const A = DocumentApp.Attribute;
  const alignment = { left: DocumentApp.HorizontalAlignment.LEFT, center: DocumentApp.HorizontalAlignment.CENTER, right: DocumentApp.HorizontalAlignment.RIGHT, justify: DocumentApp.HorizontalAlignment.JUSTIFY };
  function paragraph(parent, node, options) {
    const attrs = node.attrs || {}, opts = options || {};
    const prefix = opts.prefix || '';
    const p = parent.appendParagraph(prefix + (node.content || []).map(child => child.type === 'hardBreak' ? '\n' : child.text).join(''));
    const size = node.type === 'heading' ? ({ 1: 24, 2: 18, 3: 14 }[attrs.level] || 24) : 12;
    p.setAlignment(alignment[attrs.textAlign] || alignment.left).setIndentStart((attrs.indent || 0) * 24 + (opts.indent || 0)).setIndentFirstLine((attrs.indent || 0) * 24 + (opts.indent || 0))
      .setLineSpacing(attrs.lineSpacing || 1.15).setSpacingBefore(node.type === 'heading' ? 12 : 0).setSpacingAfter(6);
    p.setAttributes({ [A.FONT_FAMILY]: 'Arial', [A.FONT_SIZE]: size, [A.BOLD]: node.type === 'heading' || !!opts.header, [A.ITALIC]: !!opts.quote, [A.UNDERLINE]: false, [A.STRIKETHROUGH]: false, [A.FOREGROUND_COLOR]: '#202820' });
    const text = p.editAsText();
    let offset = prefix.length;
    (node.content || []).forEach(child => {
      const length = child.type === 'hardBreak' ? 1 : child.text.length;
      const start = offset, end = offset + length - 1;
      offset += length;
      // Reset each run so marks never leak to following unformatted text.
      text.setAttributes(start, end, { [A.FONT_FAMILY]: 'Arial', [A.FONT_SIZE]: size, [A.BOLD]: node.type === 'heading' || !!opts.header, [A.ITALIC]: !!opts.quote, [A.UNDERLINE]: false, [A.STRIKETHROUGH]: false, [A.FOREGROUND_COLOR]: '#202820', [A.BACKGROUND_COLOR]: null, [A.LINK_URL]: null });
      (child.marks || []).forEach(mark => {
        const a = mark.attrs || {};
        if (mark.type === 'bold') text.setBold(start, end, true);
        if (mark.type === 'italic') text.setItalic(start, end, true);
        if (mark.type === 'underline') text.setUnderline(start, end, true);
        if (mark.type === 'strike') text.setStrikethrough(start, end, true);
        if (mark.type === 'link') text.setLinkUrl(start, end, a.href).setForegroundColor(start, end, '#1155cc').setUnderline(start, end, true);
        if (mark.type === 'highlight') text.setBackgroundColor(start, end, a.color);
        if (mark.type === 'textStyle') {
          if (a.color) text.setForegroundColor(start, end, a.color);
          if (a.fontFamily) text.setFontFamily(start, end, a.fontFamily);
          if (a.fontSize) text.setFontSize(start, end, parseInt(a.fontSize, 10));
        }
      });
    });
    return p;
  }
  function render(parent, nodes, options) {
    const opts = options || {};
    nodes.forEach(node => {
      if (['paragraph', 'heading'].includes(node.type)) paragraph(parent, node, opts);
      else if (node.type === 'pageBreak') parent.appendPageBreak();
      else if (node.type === 'horizontalRule') parent.appendHorizontalRule();
      else if (node.type === 'blockquote') render(parent, node.content || [], { ...opts, indent: (opts.indent || 0) + 30, quote: true });
      else if (['bulletList', 'orderedList'].includes(node.type)) {
        (node.content || []).forEach((item, index) => {
          let first = true;
          (item.content || []).forEach(child => {
            const nested = { ...opts, indent: (opts.indent || 0) + 24 };
            if (child.type === 'paragraph') {
              // Explicit markers preserve numbering starts and independent lists.
              paragraph(parent, child, { ...nested, prefix: first ? (node.type === 'orderedList' ? ((node.attrs?.start || 1) + index) + '. ' : '• ') : '' });
              first = false;
            } else render(parent, [child], nested);
          });
        });
      } else if (node.type === 'image') {
        const match = /^data:(image\/(?:png|jpeg|gif));base64,(.*)$/.exec(node.attrs.src);
        const image = parent.appendParagraph('').setSpacingAfter(6).appendInlineImage(Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], node.attrs.alt || 'body-image'));
        const width = Math.min(node.attrs.width * 0.75, opts.width || 508);
        const ratio = image.getHeight() / image.getWidth();
        image.setWidth(Math.round(width)).setHeight(Math.round(width * ratio));
      } else if (node.type === 'table') {
        const columns = node.content[0].content.length;
        const table = parent.appendTable(node.content.map(row => row.content.map(() => '')));
        table.setBorderWidth(0.75).setBorderColor('#b7bec8');
        for (let col = 0; col < columns; col++) table.setColumnWidth(col, (opts.width || 508) / columns);
        node.content.forEach((row, r) => row.content.forEach((cell, c) => {
          const target = table.getCell(r, c);
          target.setPaddingTop(6).setPaddingBottom(6).setPaddingLeft(6).setPaddingRight(6);
          if (cell.type === 'tableHeader') target.setBackgroundColor('#f1f3f5');
          render(target, cell.content || [], { header: cell.type === 'tableHeader', width: (opts.width || 508) / columns - 12 });
          // appendTable creates one empty paragraph per cell; remove it after filling.
          if (target.getNumChildren() > 1) target.removeChild(target.getChild(0));
        }));
      }
    });
  }
  render(body, source.content || [], { width: 612 - 72 * (source.attrs.marginLeft + source.attrs.marginRight) });
}

function validateTemplateDocument(request, type) {
  const simple = ['Authority to Travel Abroad', 'Certificate of Travel'].includes(type);
  const travel = type === 'Travel Order';
  const data = {};
  if (type === 'Executive Memorandum' && request.bodyRich) {
    data.bodyRich = validateRichBody(request.bodyRich);
    request = { ...request, body: richBodyPlainText(data.bodyRich) };
  }
  const authority = type === 'Authority to Travel Abroad' && request.authorityStructured === true;
  const certificate = type === 'Certificate of Travel' && request.certificateStructured === true;
  const fields = authority ? ['body', 'recipientName', 'recipientPosition', 'salaryGrade', 'employmentStatus', 'travelFrom', 'travelUntil', 'purpose', 'place', 'travelClassification', 'signatory', 'signatoryPosition', 'cc'] : certificate ? ['body', 'recipientName', 'salaryGrade', 'employmentStatus', 'travelFrom', 'travelUntil', 'place', 'travelClassification', 'signatory', 'signatoryPosition', 'cc'] : simple ? ['body'] : travel
    ? ['reference', 'recipientLabel', 'recipientName', 'recipientPosition', 'place', 'inclusiveDate', 'transportation', 'purpose', 'remarks']
    : ['Executive Memorandum', 'Special Order'].includes(type)
      ? ['reference', 'recipientLabel', 'recipientName', 'recipientPosition', 'institution', 'thru', 'subject', 'date', 'body', 'additionalInstitution']
      : ['reference', 'recipientLabel', 'recipientPosition', 'institution', 'thru', 'subject', 'date', 'body', 'additionalInstitution'];
  const optional = ['thru', 'additionalInstitution', 'cc'];
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
  if (certificate || authority) {
    if (authority) data.authorityStructured = true;
    else data.certificateStructured = true;
    data.issueDate = String(request.issueDate || request.date || '').trim();
    for (const key of ['issueDate', 'travelFrom', 'travelUntil']) {
      const value = data[key];
      if (!/^(19|20)\d{2}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Choose a valid ' + key + '.');
    }
    if (data.travelUntil < data.travelFrom) throw new Error('Travel end date must be on or after the start date.');
    data.inclusiveDate = data.travelFrom === data.travelUntil ? executiveMemoDate(data.travelFrom) : executiveMemoDate(data.travelFrom) + ' to ' + executiveMemoDate(data.travelUntil);
    data.position = data.signatoryPosition;
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
  }
  if (['Executive Memorandum', 'Special Order', 'Travel Order'].includes(type)) {
    data.signatory = String(request.signatory || 'EDGARDO H. ROSALES, JD, Ed.D.').trim();
    data.position = String(request.signatoryPosition || 'SUC President II').trim();
  }
  return data;
}

// Called under the creation lock. Persist reservations so retries keep their number.
function reserveDocumentReference(request, data, automaticDate, categorySheet) {
  const properties = PropertiesService.getScriptProperties();
  const owner = CacheService.getScriptCache().get('session:' + request.token);
  const reservationKey = 'reference-request:' + request.requestId;
  const previous = JSON.parse(properties.getProperty(reservationKey) || 'null');
  if (previous) {
    if (previous.owner !== owner || previous.type !== request.type) throw new Error('Creation request does not match its reference reservation.');
    if (!automaticDate && previous.year !== data.year) throw new Error('Keep the original document year when retrying this creation.');
    return previous;
  }
  const date = automaticDate ? Utilities.formatDate(new Date(), appSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd') : data.date;
  const year = date.slice(0, 4);
  const counterKey = 'reference-counter:' + request.type + ':' + year;
  let number = Number(properties.getProperty(counterKey) || 0);
  const log = categorySheet || typeLogSheet(request.type);
  const lastRow = log.getLastRow();
  const rows = lastRow > 1 ? log.getRange(2, 2, lastRow - 1, 2).getDisplayValues() : [];
  rows.forEach(row => {
    if (String(row[1]) !== year) return;
    const match = String(row[0]).match(/^(?:(?:Executive Memorandum(?: Order)?|Special Order|Travel Order|Authority to Travel Abroad|Certificate of Travel)\s*(?:No\.?\s*)?|(?:EM|SO|TO|ATA|CTA)[ -]*|)(\d{1,6})(?=\D|$)/i);
    if (match) number = Math.max(number, Number(match[1]));
  });
  number++;
  if (number > 999999) throw new Error('The annual reference number limit has been reached.');
  const reference = request.type + ' No. ' + String(number).padStart(3, '0') + ', s. ' + year;
  const reservation = { owner: owner, type: request.type, reference: reference, date: date, year: year };
  // Advance first: an interrupted reservation may leave a gap but cannot reuse a number.
  properties.setProperty(counterKey, String(number));
  properties.setProperty(reservationKey, JSON.stringify(reservation));
  return reservation;
}

function createDocument(request) {
  if (!getDocumentSession(request.token)) return jsonResponse({ success: false, message: 'Your session expired. Please sign in again.' });
  const type = request.type;
  if (!FILING_TYPES.includes(type)) return jsonResponse({ success: false, message: 'Choose a valid document type.' });
  const memo = type === 'Executive Memorandum';
  const template = request.templateVersion === 2;
  const automaticDate = template && ['Authority to Travel Abroad', 'Certificate of Travel', 'Travel Order'].includes(type);
  const simple = template && ['Authority to Travel Abroad', 'Certificate of Travel'].includes(type);
  const autoReference = template && request.autoReference === true;
  let data;
  try { data = template ? validateTemplateDocument(autoReference ? { ...request, reference: 'AUTO' } : request, type) : memo ? validateExecutiveMemorandum(request) : validateCreatedDocument(request, type); } catch (error) { return jsonResponse({ success: false, message: error.message }); }
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(String(request.requestId || ''))) return jsonResponse({ success: false, message: 'Invalid creation request. Reopen the form.' });
  const lock = LockService.getScriptLock();
  let locked = false;
  let state;
  let stage = 'prepare';
  try {
    lock.waitLock(30000);
    locked = true;
    stage = 'checking MAIN Files first-row headers';
    const sheet = mainFilesSheet();
    stage = 'checking ' + TYPE_LOG_SHEETS[type] + ' first-row headers';
    const logSheet = typeLogSheet(type);
    stage = 'checking ' + CREATED_DOCUMENT_SHEETS[type] + ' first-row headers';
    const creationSheet = createdDocumentSheet(type);
    stage = 'prepare';
    if (autoReference) {
      const reserved = reserveDocumentReference(request, data, automaticDate, logSheet);
      data.reference = reserved.reference;
      data.date = reserved.date;
      data.year = reserved.year;
      if (memo) data.number = /No\. (\d+)/.exec(reserved.reference)[1];
    }
  const id = memo && data.number ? 'Executive Memorandum No. ' + data.number + ', s. ' + data.year : simple && !autoReference ? CREATED_DOCUMENT_SHEETS[type] + '-' + request.requestId : data.reference;
  // Keep reservation prefixes stable across spreadsheet-tab renames.
  const prefixes = { 'Special Order': 'SO', 'Travel Order': 'TO', 'Authority to Travel Abroad': 'ATA', 'Certificate of Travel': 'CTA', 'Executive Memorandum': 'EM' };
  const key = memo && data.number ? 'EM-' + data.year + '-' + data.number : prefixes[type] + '-' + (data.year || 'AUTO') + '-' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, id.toUpperCase()));
    const properties = PropertiesService.getScriptProperties();
    state = JSON.parse(properties.getProperty(key) || 'null');
    const fingerprint = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(data)));
    const owner = CacheService.getScriptCache().get('session:' + request.token);
    const rows = sheetDataRows(sheet, 1, 5);
    const index = rows.findIndex(row => {
      const match = /^Executive Memorandum(?: Order)? No\.\s*0*(\d+),?\s*s\.\s*(\d{4})$/i.exec(row[1]);
      return String(row[1]).toUpperCase() === id.toUpperCase() || row[1] === key || (memo && match && Number(match[1]) === Number(data.number) && match[2] === data.year);
    });
    const creationSnapshot = createdDocumentLogSnapshot(creationSheet);
    const creationRows = creationSnapshot.rows;
    const hasLogEvidence = existingTypeLogRow(logSheet, id);
    const hasCreationEvidence = creationRows.some((row, i) => {
      if (row[0] === key) return true;
      try { return JSON.parse(creationSnapshot.notes[i][0] || '{}').createdDocumentId === key; }
      catch (error) { return false; }
    });
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
    if (completed && index >= 0) return jsonResponse({ success: true, document: documentFromRow(rows[index], sheet.getRange(index + 2, 2).getNote()) });
    if (recoverReservation) state.requestId = request.requestId;
    const saveState = () => properties.setProperty(key, JSON.stringify(state));
    if (!state) {
      state = { requestId: request.requestId, owner: owner, fingerprint: fingerprint, status: canChangeDocumentStatus(request.token) && DOCUMENT_STATUSES.includes(request.status) ? request.status : 'Draft' };
      if (automaticDate) state.createdDate = autoReference ? data.date : Utilities.formatDate(new Date(), appSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
    }
    // Persist resumed request ownership and any corrected draft before rendering.
    saveState();
    const name = (id + ' - ' + data.subject.slice(0, 90)).replace(/[<>:"/\\|?*\x00-\x1f]/g, '-');
    let freshDocument;
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
        freshDocument = doc;
      }
    }
    if (automaticDate) { data.date = state.createdDate; data.year = state.createdDate.slice(0, 4); }
    const file = DriveApp.getFileById(state.fileId);
    if (file.isTrashed()) throw new Error('File unavailable');
    if (state.allocationName) file.setName(name);
    if (!state.rendered) {
      stage = 'generate';
      if (memo || type === 'Special Order' || type === 'Certificate of Travel' || type === 'Authority to Travel Abroad') {
        if (typeof request.logo !== 'string' || request.logo.length > 1500000) throw new Error('Logo unavailable');
        const logo = Utilities.newBlob(Utilities.base64Decode(request.logo), 'image/png', 'jhcsclogo.png');
        if (memo) renderExecutiveMemorandum(freshDocument || DocumentApp.openById(state.fileId), data, logo);
        else renderCreatedDocument(freshDocument || DocumentApp.openById(state.fileId), data, type, logo);
      } else renderCreatedDocument(freshDocument || DocumentApp.openById(state.fileId), data, type);
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
    const storedData = storeRichBodyForm(data, file, state.bodyRichFileId);
    if (storedData.bodyRichFileId && state.bodyRichFileId !== storedData.bodyRichFileId) { state.bodyRichFileId = storedData.bodyRichFileId; saveState(); }
    const savedNote = JSON.stringify({ ...metadata, type: record.type, year: record.year, status: metadata.status || record.status, owner: owner, form: { ...storedData, travelFrom: request.travelFrom || '', travelUntil: request.travelUntil || '', templateVersion: request.templateVersion || 1, type: type, signatoryPosition: data.position || request.signatoryPosition || '' }, createdDocumentId: key });
    cell.setNote(savedNote);
    if (!hasLogEvidence) writeTypeLog(logSheet, logSheet.getLastRow() + 1, { ...record, date: new Date().toISOString() });
    logCreatedDocument(creationSheet, { ...record, status: metadata.status || record.status }, data, key, creationSnapshot);
    SpreadsheetApp.flush();
    state.completed = true;
    saveState();
    return jsonResponse({ success: true, document: documentFromRow([record.activity, id, record.date, record.subject, record.url], savedNote) });
  } catch (error) {
    console.error('Document creation failed during ' + stage + ': ' + String(error && error.message || error));
    if (stage.startsWith('checking ')) return jsonResponse({ success: false, message: 'Creation failed while ' + stage + '. ' + String(error && error.message || error) });
    if (type === 'Travel Order' && stage !== 'registry') return jsonResponse({ success: false, message: 'Unable to create Travel Order during ' + stage + ': ' + String(error && error.message || error) + ' Retry the same form after correcting this error.' });
    if (stage === 'allocate') return jsonResponse({ success: false, message: 'Google Docs creation could not finish. The deployment owner should run checkCreateDocumentSetup in Apps Script and authorize access, then update the web app deployment. Retry the same fields afterward; the reserved number can be recovered automatically.' });
    return jsonResponse({ success: false, message: stage === 'registry' ? 'Document was created, but MAIN Files or the ' + CREATED_DOCUMENT_SHEETS[type] + ' / category log could not be updated. Retry with the same fields to finish logging without creating another document.' : 'Unable to create ' + type + '. Please retry with the same fields. If this persists, ask the administrator to check document access and sheet configuration.' });
  } finally { if (locked) lock.releaseLock(); }
}

// Run as the deployment owner to request the document service's required scopes.
function checkCreateDocumentSetup() {
  checkUploadSetup();
  Object.keys(CREATED_DOCUMENT_SHEETS).forEach(type => {
    createdDocumentSheet(type);
    typeLogSheet(type);
  });
  const master = DocumentApp.openById(TRAVEL_ORDER_TEMPLATE_ID);
  const tables = master.getBody().getTables();
  if (tables.length < 2) throw new Error('Travel Order template is missing its heading or details table.');
  tables[0].getCell(0, 1);
  for (let row = 0; row < 7; row++) tables[1].getCell(row, 1);
  console.log('Travel Order template access and required cells OK.');
  console.log('Creation configuration checked. Update the web app deployment after authorizing access.');
}

const PASSWORD_PEPPER_KEY = 'OP_PASSWORD_PEPPER';
// Additional account state lives outside the existing four-column credentials schema.
function accountSettings(email) {
  return JSON.parse(PropertiesService.getScriptProperties().getProperty('account:' + email) || '{}');
}

function sessionRevoked(email, token) {
  const settings = accountSettings(email);
  return settings.disabled || (settings.revokedBefore && Number(CacheService.getScriptCache().get('issued:' + token) || 0) <= settings.revokedBefore);
}

function sessionAccount(token) {
  const account = authenticatedAccount(token);
  if (!account) throw new Error('Your session expired. Please sign in again.');
  return account;
}

function workflowRequest(request) {
  try {
    if (request.action === 'verify') return verifyRegisteredDocument(request.code);
    const user = sessionAccount(request.token);
    if (request.action === 'currentUser') return jsonResponse({ success: true, user: user });
    if (['createUser', 'updateUser', 'deleteUser'].includes(request.action)) return manageAccount(request, user);
    if (request.action === 'verificationLink') return documentVerificationLink(request);
    if (request.action === 'documentDetails') {
      if (!canChangeDocumentStatus(request.token)) throw new Error('Admin access is required.');
      const entry = workflowDocument(request.id);
      if (!entry.metadata.form) throw new Error('This record has no editable form. You can edit its registry title.');
      return jsonResponse({ success: true, form: loadRichBodyForm(entry.metadata.form) });
    }
    if (request.action === 'updateDocumentContent') return updateDocumentContent(request);
    if (request.action === 'sendDocument') return sendRegisteredDocument(request, user);
    throw new Error('Unsupported action.');
  } catch (error) { return jsonResponse({ success: false, message: error.message }); }
}

function manageAccount(request, user) {
  if (user.role !== 'super admin') throw new Error('Super admin access is required.');
  const email = String(request.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@jhcsc\.edu\.ph$/.test(email)) throw new Error('Use an institutional @jhcsc.edu.ph email.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = appSpreadsheet().getSheetByName('CREDENTIALS');
    const rows = sheetDataRows(sheet, 1, 4);
    const index = rows.findIndex(row => String(row[0]).trim().toLowerCase() === email);
    const creating = request.action === 'createUser';
    const deleting = request.action === 'deleteUser';
    if (creating && index >= 0) throw new Error('An account with this email already exists.');
    if (!creating && index < 0) throw new Error('Account was not found.');
    const role = normalizeRole(request.role);
    if (email === user.email && (deleting || request.status === 'Inactive' || role !== 'super admin')) throw new Error('You cannot remove, deactivate, or demote your own account.');
    if (!creating && normalizeRole(rows[index][3]) === 'super admin' && (deleting || role !== 'super admin' || request.status === 'Inactive')) {
      const others = rows.filter((row, i) => i !== index && normalizeRole(row[3]) === 'super admin' && !accountSettings(String(row[0]).trim().toLowerCase()).disabled);
      if (!others.length) throw new Error('At least one active super admin is required.');
    }
    const props = PropertiesService.getScriptProperties();
    if (deleting) {
      sheet.deleteRow(index + 2);
      // Preserve disabled state so old tokens cannot regain access if recreated.
      props.setProperty('account:' + email, JSON.stringify({ disabled: true }));
    } else {
      const name = String(request.name || '').trim();
      if (!name || name.length > 150) throw new Error('Enter a name up to 150 characters.');
      const password = String(request.password || '');
      if ((creating || password) && password.length < 12) throw new Error('Use a password of at least 12 characters.');
      if (password.length > 256) throw new Error('Password is too long.');
      const values = [email, name, password ? hashPassword_(password) : rows[index][2], role];
      sheet.getRange(creating ? sheet.getLastRow() + 1 : index + 2, 1, 1, 4).setRichTextValues([values.map(value => SpreadsheetApp.newRichTextValue().setText(value).build())]);
      const settings = accountSettings(email);
      settings.disabled = request.status === 'Inactive';
      if (creating || password || settings.disabled) settings.revokedBefore = Date.now();
      props.setProperty('account:' + email, JSON.stringify(settings));
    }
    logUserEvent(user.name, request.action + ': ' + email);
    return jsonResponse({ success: true });
  } finally { lock.releaseLock(); }
}

function workflowDocument(id) {
  const sheet = mainFilesSheet();
  const rows = sheetDataRows(sheet, 1, 5);
  const index = rows.findIndex(row => row[1] === id);
  if (index < 0) throw new Error('Document was not found.');
  const cell = sheet.getRange(index + 2, 2);
  const metadata = JSON.parse(cell.getNote() || '{}');
  const record = documentFromRow(rows[index], cell.getNote());
  if (record.deleted) throw new Error('Document was not found.');
  return { sheet: sheet, row: index + 2, cell: cell, metadata: metadata, record: record };
}

function documentVerificationLink(request) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const entry = workflowDocument(request.id);
    if (!entry.metadata.verificationCode) {
      entry.metadata.verificationCode = Utilities.getUuid() + Utilities.getUuid();
      entry.cell.setNote(JSON.stringify(entry.metadata));
    }
    return jsonResponse({ success: true, code: entry.metadata.verificationCode });
  } finally { lock.releaseLock(); }
}

function verifyRegisteredDocument(code) {
  if (!/^[a-f0-9-]{72}$/i.test(String(code || ''))) throw new Error('Invalid verification code.');
  const sheet = mainFilesSheet();
  const count = sheet.getLastRow() - 1;
  const notes = count > 0 ? sheet.getRange(2, 2, count, 1).getNotes() : [];
  const index = notes.findIndex(note => { try { return JSON.parse(note[0]).verificationCode === code; } catch (error) { return false; } });
  if (index < 0) throw new Error('No registered document matches this code.');
  const row = sheet.getRange(index + 2, 1, 1, 5).getDisplayValues()[0];
  const record = documentFromRow(row, notes[index][0]);
  if (record.deleted) throw new Error('This record is no longer available.');
  // Public verification reveals registry facts, never the Drive URL or full body.
  return jsonResponse({ success: true, document: { id: record.id, type: record.type, date: record.date, status: record.status } });
}

function updateDocumentContent(request) {
  if (!canChangeDocumentStatus(request.token)) throw new Error('Admin access is required.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const entry = workflowDocument(request.id);
    if (entry.record.status === 'Out') throw new Error('OUT documents are locked.');
    if (!entry.metadata.form || entry.metadata.form.templateVersion !== 2) throw new Error('This legacy document supports title editing only.');
    const data = validateTemplateDocument({ ...request, reference: entry.metadata.form.reference }, entry.record.type);
    data.date = data.date || entry.metadata.form.date;
    data.year = entry.record.year;
    const match = /\/d\/([a-zA-Z0-9_-]+)/.exec(entry.record.url);
    const file = match && DriveApp.getFileById(match[1]);
    if (!file || file.isTrashed() || file.getMimeType() !== 'application/vnd.google-apps.document') throw new Error('The editable document is unavailable.');
    let logo;
    if (['Executive Memorandum', 'Special Order', 'Certificate of Travel', 'Authority to Travel Abroad'].includes(entry.record.type)) {
      if (!request.logo || request.logo.length > 1500000) throw new Error('The college logo is required.');
      logo = Utilities.newBlob(Utilities.base64Decode(request.logo), 'image/png', 'jhcsclogo.png');
    }
    const doc = DocumentApp.openById(file.getId());
    if (entry.record.type === 'Executive Memorandum') renderExecutiveMemorandum(doc, data, logo);
    else renderCreatedDocument(doc, data, entry.record.type, logo);
    const storedData = storeRichBodyForm(data, file, entry.metadata.form.bodyRichFileId);
    entry.metadata.form = { ...storedData, travelFrom: request.travelFrom || '', travelUntil: request.travelUntil || '', type: entry.record.type, templateVersion: 2, signatoryPosition: data.position || request.signatoryPosition || '' };
    entry.metadata.updated = new Date().toISOString();
    entry.cell.setNote(JSON.stringify(entry.metadata));
    entry.sheet.getRange(entry.row, 4).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(data.subject).build());
    logCreatedDocument(createdDocumentSheet(entry.record.type), { ...entry.record, subject: data.subject }, data, entry.metadata.createdDocumentId);
    appendActivityEvent({ ...entry.record, activity: 'Document content edited', date: entry.metadata.updated });
    return jsonResponse({ success: true, document: { ...entry.record, subject: data.subject, updated: entry.metadata.updated } });
  } finally { lock.releaseLock(); }
}

function emailAddresses(value, required) {
  const addresses = [...new Set(String(value || '').split(/[;,\s]+/).filter(Boolean))];
  if ((required && !addresses.length) || addresses.length > 30 || addresses.some(address => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))) throw new Error('Enter valid email recipients (maximum 30 per field).');
  return addresses;
}

function sendRegisteredDocument(request, user) {
  if (!canChangeDocumentStatus(request.token)) throw new Error('Admin access is required to send documents.');
  const to = emailAddresses(request.to, true), cc = emailAddresses(request.cc, false);
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(String(request.requestId || ''))) throw new Error('Invalid send request.');
  const subject = String(request.subject || '').trim(), message = String(request.message || '').trim();
  if (!subject || subject.length > 200 || !message || message.length > 10000) throw new Error('Enter a subject and message within the allowed lengths.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const entry = workflowDocument(request.id);
    const props = PropertiesService.getScriptProperties();
    const key = 'sent:' + request.requestId;
    const prior = JSON.parse(props.getProperty(key) || 'null');
    const fingerprint = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify([request.id, to, cc, subject, message])));
    if (prior) {
      if (prior.id !== request.id || prior.owner !== user.email) throw new Error('Send request does not match.');
      if (prior.fingerprint !== fingerprint) throw new Error('This send request already used different recipients or content. Close and reopen the email form to start a new email.');
      if (prior.state !== 'sent') throw new Error('This send attempt has an uncertain result. Check the sender mailbox before starting another email.');
      return finishDocumentSend(entry, request, to, cc);
    }
    if (!['Approved', 'Out'].includes(entry.record.status)) throw new Error('Approve the document before sending it.');
    const match = /\/d\/([a-zA-Z0-9_-]+)/.exec(entry.record.url);
    const file = match && DriveApp.getFileById(match[1]);
    if (!file || file.isTrashed()) throw new Error('The registered file is unavailable.');
    const pdf = preparedDocumentPdf(file);
    if (pdf.getBytes().length > 20 * 1024 * 1024) throw new Error('This PDF exceeds the 20 MB email attachment limit.');
    if (MailApp.getRemainingDailyQuota() < to.length + cc.length) throw new Error('The sender has insufficient daily email quota.');
    const state = { id: request.id, owner: user.email, state: 'pending', fingerprint: fingerprint };
    props.setProperty(key, JSON.stringify(state));
    MailApp.sendEmail({ to: to.join(','), cc: cc.join(','), subject: subject, body: message, replyTo: user.email, name: user.name + ' — Office of the President', attachments: [pdf.setName(file.getName().replace(/\.pdf$/i, '') + '.pdf')] });
    state.state = 'sent';
    props.setProperty(key, JSON.stringify(state));
    return finishDocumentSend(entry, request, to, cc);
  } finally { lock.releaseLock(); }
}

function finishDocumentSend(entry, request, to, cc) {
  entry.metadata.status = 'Out';
  entry.metadata.updated = entry.metadata.updated || new Date().toISOString();
  entry.cell.setNote(JSON.stringify(entry.metadata));
  syncCreatedDocumentStatus(entry.record.type, entry.metadata.createdDocumentId, 'Out');
  if (entry.metadata.lastSendRequest !== request.requestId) {
    appendActivityEvent({ ...entry.record, activity: 'PDF emailed to ' + to.join(', ') + (cc.length ? '; CC: ' + cc.join(', ') : ''), date: new Date().toISOString() });
    entry.metadata.lastSendRequest = request.requestId;
    entry.cell.setNote(JSON.stringify(entry.metadata));
  }
  return jsonResponse({ success: true, document: { ...entry.record, status: 'Out', updated: entry.metadata.updated } });
}

// Run once as deployment owner to grant the mail scope without sending an email.
function checkEmailSetup() { console.log('Remaining email recipient quota: ' + MailApp.getRemainingDailyQuota()); }

function hashPassword_(password) {
  const props = PropertiesService.getScriptProperties();
  let pepper = props.getProperty(PASSWORD_PEPPER_KEY);
  if (!pepper) {
    pepper =
      Utilities.getUuid().replace(/-/g, "") +
      Utilities.getUuid().replace(/-/g, "");
    props.setProperty(PASSWORD_PEPPER_KEY, pepper);
  }
  const salt = Utilities.getUuid().replace(/-/g, "");
  const signature = Utilities.computeHmacSha256Signature(
    salt + String(password),
    pepper,
    Utilities.Charset.UTF_8
  );
  return "v2$" + salt + "$" + Utilities.base64EncodeWebSafe(signature);
}

function hashLegacyPassword_(password) {
  const raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(raw);
}

function constantTimeEqual_(left, right) {
  const first = String(left || "");
  const second = String(right || "");
  let difference = first.length ^ second.length;
  const length = Math.max(first.length, second.length);
  for (let index = 0; index < length; index++) {
    difference |= (first.charCodeAt(index) || 0) ^
      (second.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function verifyPassword_(plainPassword, hashedPassword) {
  const storedPassword = String(hashedPassword || "");
  if (!storedPassword.startsWith("v2$")) {
    // Transitional support for old rows that contain either the previous
    // SHA-256 value or a manually entered plaintext password. loginUser_()
    // replaces either format with a salted v2 value after the first match.
    return constantTimeEqual_(hashLegacyPassword_(plainPassword), storedPassword) ||
      constantTimeEqual_(plainPassword, storedPassword);
  }

  const parts = storedPassword.split("$");
  if (parts.length !== 3) return false;
  const pepper =
    PropertiesService.getScriptProperties().getProperty(PASSWORD_PEPPER_KEY) || "";
  if (!pepper) return false;
  const signature = Utilities.computeHmacSha256Signature(
    parts[1] + String(plainPassword),
    pepper,
    Utilities.Charset.UTF_8
  );
  return constantTimeEqual_(Utilities.base64EncodeWebSafe(signature), parts[2]);
}
