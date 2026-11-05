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

// A4 portrait dimensions in points, shared by every document renderer.
const DOCUMENT_PAGE_WIDTH = 595.28;
const DOCUMENT_PAGE_HEIGHT = 841.89;

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
  Trav_Ord: ['REFERENCE NUMBER', 'RECIPIENT LABEL (To or For)', 'NAME OF THE RECIPIENT', 'POSITION/OFFICE', 'PLACE', 'INCLUSIVE DATES', 'MODE OF TRANSPORTATION', 'PURPOSE', 'REMARKS', 'TYPE OF TRAVEL'],
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
    LEGACY_TRAVEL_ORDER_HEADERS.some(candidate => candidate.map(normalizeHeader).join('|') === actual.slice(0, 9).join('|') && !actual[9])
  );

  if (name === 'Trav_Ord' && acceptedTravelOrderHeader && !actual[9]) sheet.getRange(1, 10).setValue('TYPE OF TRAVEL');

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

function logCreatedDocument(sheet, record, data, internalId, snapshot, metadata) {
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
      ? [record.id, label, data.recipientName || data.recipient, data.recipientPosition, data.place || data.destination, data.inclusiveDate || data.travelDates, data.transportation, data.purpose, data.remarks, data.travelType || 'Official Time']
      : record.type === 'Executive Memorandum'
        ? [internalId, record.id, label, data.recipientName, data.recipientPosition, data.institution, data.thru, record.subject, record.date, data.body || data.content, record.status, data.additionalInstitution]
      : record.type === 'Special Order'
        ? [internalId, record.id, label, data.recipientName || data.recipient, data.recipientPosition, data.institution, data.thru, record.subject, record.date, data.body || data.content, record.status, data.additionalInstitution]
      : [internalId, record.id, label, data.recipientPosition, data.institution, data.thru, record.subject, record.date, data.body || data.content, record.status, data.additionalInstitution];
  // Keep the file URL on the ID, preserving the PDF's exact column count.
  sheet.getRange(row, 1, 1, values.length).setRichTextValues([values.map((value, index) => {
    const builder = SpreadsheetApp.newRichTextValue().setText(String(value || ''));
    if (index === 0 && record.type !== 'Travel Order') builder.setLinkUrl(record.url);
    return builder.build();
  })]);
  let previous = {};
  try { previous = JSON.parse(existing >= 0 ? notes[existing][0] || '{}' : '{}'); } catch (error) { /* Legacy note. */ }
  sheet.getRange(row, 1).setNote(JSON.stringify({ ...previous, ...metadata, createdDocumentId: internalId, reference: record.id, url: record.url,
    registry: [record.activity, record.id, record.date, record.subject, record.url] }));
  return row;
}

// Form-tab ID notes hold workflow metadata without adding visible columns.
function createdRegistryEntries(documentType, documentId) {
  const entries = [];
  const spreadsheet = appSpreadsheet();
  Object.entries(CREATED_DOCUMENT_SHEETS).forEach(([type, name]) => {
    if (documentType && type !== documentType) return;
    const sheet = spreadsheet.getSheetByName(name);
    if (!sheet) return;
    const count = sheet.getLastRow() - 1;
    if (count < 1) return;
    let firstRow = 2;
    let rowCount = count;
    // These forms store their public reference in a visible column. Search on
    // the Sheets server, then transfer only the matching row's metadata.
    if (documentId && ['Executive Memorandum', 'Special Order', 'Travel Order'].includes(type)) {
      const references = sheet.getRange(2, type === 'Travel Order' ? 1 : 2, count, 1);
      if (typeof references.createTextFinder === 'function') {
        const match = references.createTextFinder(documentId).matchEntireCell(true).matchCase(true).useRegularExpression(false).findNext();
        if (!match) return;
        firstRow = match.getRow();
        rowCount = 1;
      }
    }
    const range = sheet.getRange(firstRow, 1, rowCount, 1);
    const ids = range.getDisplayValues();
    const notes = range.getNotes();
    ids.forEach((value, index) => {
      if (!value[0]) return;
      let metadata;
      try { metadata = JSON.parse(notes[index][0] || '{}'); } catch (error) { return; }
      if (!metadata || !Array.isArray(metadata.registry) || metadata.deleted) return;
      const record = documentFromRow(metadata.registry, JSON.stringify(metadata));
      if (!record.id || record.type !== type || (documentId && record.id !== documentId)) return;
      entries.push({ sheet: sheet, row: index + firstRow, metadata: metadata, record: record, created: true });
    });
  });
  return entries;
}

function registeredDocuments(mainWidth) {
  const sheet = mainFilesSheet();
  const rows = sheetDataRows(sheet, 1, mainWidth || 5);
  const notes = rows.length ? sheet.getRange(2, 2, rows.length, 1).getNotes() : [];
  const records = rows.map((row, index) => documentFromRow(row, notes[index][0])).filter(record => record.id && !record.deleted);
  const seen = new Set(records.map(record => record.id));
  createdRegistryEntries().forEach(entry => { if (!seen.has(entry.record.id)) { records.push(entry.record); seen.add(entry.record.id); } });
  return records;
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
let requestCredentialRows;
function credentialRows(sheet) {
  if (requestAccounts && requestCredentialRows) return requestCredentialRows;
  const rows = sheet ? sheetDataRows(sheet, 1, 4) : [];
  if (requestAccounts) requestCredentialRows = rows;
  return rows;
}
function authenticatedAccount(token) {
  if (typeof token !== 'string' || !token) return null;
  if (requestAccounts && requestAccounts.has(token)) return requestAccounts.get(token);
  const email = CacheService.getScriptCache().get('session:' + token);
  let account = null;
  if (email && !sessionRevoked(email, token)) {
    const sheet = appSpreadsheet().getSheetByName('CREDENTIALS');
    const rows = credentialRows(sheet);
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

// Bundled from public/esign.png for approved native documents and PDF exports.
const PRESIDENT_SIGNATURE_PNG = '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';
function syncApprovalSignature(file, form, status) {
  if (!form || file.getMimeType() !== 'application/vnd.google-apps.document') return;
  const doc = DocumentApp.openById(file.getId());
  const body = doc.getBody();
  const marker = 'op-president-approval-signature';
  const name = String(form.signatory || 'EDGARDO H. ROSALES, JD, Ed.D.').trim();
  const signed = ['Approved', 'Out'].includes(status) && /^EDGARDO H\. ROSALES\b/i.test(name);
  let changed = false;
  function visit(container) {
    for (let i = container.getNumChildren() - 1; i >= 0; i--) {
      const child = container.getChild(i);
      if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
        const paragraph = child.asParagraph();
        for (let j = paragraph.getNumChildren() - 1; j >= 0; j--) {
          const part = paragraph.getChild(j);
          if (part.getType() === DocumentApp.ElementType.INLINE_IMAGE && part.asInlineImage().getAltTitle() === marker) {
            if (signed) return true;
            paragraph.removeChild(part);
            changed = true;
            if (!paragraph.getText() && i < container.getNumChildren() - 1) container.removeChild(paragraph);
            break;
          }
        }
      } else if (child.getType() === DocumentApp.ElementType.TABLE) {
        const table = child.asTable();
        for (let r = 0; r < table.getNumRows(); r++) for (let c = 0; c < table.getRow(r).getNumCells(); c++) {
          if (visit(table.getCell(r, c))) return true;
        }
      }
    }
    return false;
  }
  const existing = visit(body);
  if (signed && !existing) {
    const match = body.findText('EDGARDO H[.] ROSALES');
    if (!match) throw new Error('The president signature block could not be found.');
    const paragraph = match.getElement().getParent().asParagraph();
    const parent = paragraph.getParent();
    const signature = parent.insertParagraph(parent.getChildIndex(paragraph), '');
    signature.setIndentStart(paragraph.getIndentStart() || 0).setIndentFirstLine(paragraph.getIndentStart() || 0)
      .setSpacingBefore(paragraph.getSpacingBefore() || 0).setSpacingAfter(0);
    paragraph.setSpacingBefore(0);
    const image = signature.appendInlineImage(Utilities.newBlob(Utilities.base64Decode(PRESIDENT_SIGNATURE_PNG), 'image/png', 'esign.png'));
    const height = Math.round(135 * image.getHeight() / image.getWidth());
    image.setWidth(135).setHeight(height).setAltTitle(marker);
    changed = true;
  }
  if (changed) doc.saveAndClose();
}

function approvalTimestamp(previousStatus, status, previousTimestamp, now) {
  if (!['Approved', 'Out'].includes(status)) return '';
  return ['Approved', 'Out'].includes(previousStatus) && previousTimestamp ? previousTimestamp : now;
}

function updateDocumentStatus(request) {
  if (!canChangeDocumentStatus(request.token)) return jsonResponse({ success: false, message: 'Admin access is required to change document status.' });
  if (!DOCUMENT_STATUSES.includes(request.status)) return jsonResponse({ success: false, message: 'Choose a valid document status.' });
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const entry = workflowDocument(request.id, true, request.type);
    const cell = entry.cell;
    if (entry.record.status === 'Out') {
      return jsonResponse({ success: false, message: 'This document is Out and locked. It can only be previewed or downloaded.' });
    }
    const metadata = entry.metadata;
    const fileMatch = /\/d\/([a-zA-Z0-9_-]+)/.exec(entry.record.url);
    // Unsigned workflow transitions need only spreadsheet writes. Open Docs
    // when entering or leaving a state that can carry the approval signature.
    if (metadata.form && fileMatch && [entry.record.status, request.status].some(status => ['Approved', 'Out'].includes(status))) {
      syncApprovalSignature(DriveApp.getFileById(fileMatch[1]), metadata.form, request.status);
    }
    metadata.status = request.status;
    metadata.updated = new Date().toISOString();
    metadata.approvedAt = approvalTimestamp(entry.record.status, request.status, metadata.approvedAt, metadata.updated);
    if (entry.created && ['Executive Memorandum', 'Special Order'].includes(entry.record.type)) entry.sheet.getRange(entry.row, 11).setValue(request.status);
    else syncCreatedDocumentStatus(metadata.type, metadata.createdDocumentId, request.status);
    cell.setNote(JSON.stringify(metadata));
    appendActivityEvent({ ...entry.record, activity: 'Status changed to ' + request.status, date: new Date().toISOString() });
    SpreadsheetApp.flush();
    return jsonResponse({ success: true, document: { ...entry.record, status: metadata.status, updated: metadata.updated, approvedAt: metadata.approvedAt || '' } });
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
    const created = createdRegistryEntries().find(entry => entry.record.id === request.id);
    if (created) {
      if (created.record.status === 'Out') throw new Error('OUT documents are locked.');
      if (request.action === 'deleteDocument') {
        deleteDocumentFiles(created.record, created.sheet, created.row, created.metadata.form?.bodyRichFileId, true);
        appendActivityEvent({ ...created.record, activity: 'Deleted', date: new Date().toISOString() });
        return jsonResponse({ success: true, deletedId: request.id, storageDeleted: true });
      }
      created.metadata.registry[3] = subject;
      if (['Executive Memorandum', 'Special Order'].includes(created.record.type)) created.sheet.getRange(created.row, 8).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(subject).build());
      created.sheet.getRange(created.row, 1).setNote(JSON.stringify(created.metadata));
      SpreadsheetApp.flush();
      return jsonResponse({ success: true, document: { ...created.record, subject: subject } });
    }
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

function deleteDocumentFiles(record, mainSheet, mainRow, bodyRichFileId, created) {
  const match = /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/(view|preview)$/.exec(record.url);
  if (!match) throw new Error('The document has an invalid Drive link. Nothing was deleted.');
  // Resolve all sheets and the exact file before making any changes.
  const logs = FILING_TYPES.map(type => {
    if (created && !appSpreadsheet().getSheetByName(TYPE_LOG_SHEETS[type])) return { rows: [] };
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

function requireApprovalPassword(request) {
  if (!['updateDocumentStatus', 'createDocument', 'createExecutiveMemorandum', 'updateDocumentContent'].includes(request.action) || !['Approved', 'Out'].includes(request.status)) return;
  const expected = PropertiesService.getScriptProperties().getProperty('PRESIDENT_APPROVAL_PASSWORD') || 'JHCSC-president';
  if (request.approvalPassword !== expected) throw new Error('Incorrect approval password. The e-signature was not attached.');
  // Do not persist the submitted password in document metadata or recovery state.
  delete request.approvalPassword;
}

function doPost(e) {
  requestAccounts = new Map();
  requestCredentialRows = undefined;
  let overviewMayChange = false;
  try {
    const request = JSON.parse(e.postData.contents || '{}');
    if (request.action === 'deleteEmail') return deleteRegisteredEmail(request);
    if (request.action === 'emails') return getEmailRegister(request);
    if (request.action === 'emailThread') return getEmailThread(request);
    if (request.action === 'emailAttachment') return getEmailThread(request);
    if (request.action === 'replyEmail') return getEmailThread(request);
    if (request.action === 'forwardEmail') return getEmailThread(request);
    if (request.action === 'updateEmailRemarks') return updateEmailRemarks(request);
    if (request.action === 'updateEmailRowColor') return updateEmailRowColor(request);
    try { requireApprovalPassword(request); }
    catch (error) { return jsonResponse({ success: false, message: error.message }); }
    overviewMayChange = ['createDocument', 'createExecutiveMemorandum', 'uploadDocument', 'editDocument', 'deleteDocument', 'updateDocumentStatus', 'updateDocumentContent', 'sendDocument', 'documentSendStatus', 'prepareDocumentPreview'].includes(request.action);
    if (request.action === 'editorCapabilities') {
      if (!getDocumentSession(request.token)) return jsonResponse({ success: false, message: 'Your session expired. Please sign in again.' });
      return jsonResponse({ success: true, richBodyVersion: 1, richBodyLayoutVersion: 1, richBodyRowHeightVersion: 1, previewEmailPdfVersion: 1 });
    }
    if (['currentUser', 'createUser', 'updateUser', 'deleteUser', 'verificationLink', 'verify', 'sendDocument', 'documentSendStatus', 'documentDetails', 'updateDocumentContent'].includes(request.action)) return workflowRequest(request);
    if (request.action === 'documentPage') return documentPage(request);
    if (request.action === 'prepareEmailAttachment') return prepareEmailAttachment(request);
    if (request.action === 'prepareDocumentPreview') return prepareDocumentPreview(request);
    if (request.action === 'createExecutiveMemorandum') return createExecutiveMemorandum(request);
    if (request.action === 'createDocument') return createDocument(request);
    if (request.action === 'activityLogs' && !isSuperAdminSession(request.token)) {
      return jsonResponse({ success: false, message: 'Super admin access is required.' });
    }
    if (request.action === 'logout') return logoutUser(request.token);
    if (['editDocument', 'deleteDocument'].includes(request.action)) return mutateDocument(request);
    if (request.action === 'updateDocumentStatus') return updateDocumentStatus(request);

    if (['uploadDocument', 'documents', 'activityLogs', 'overview'].includes(request.action)) {
      if (!getDocumentSession(request.token)) {
        return jsonResponse({ success: false, message: 'Your session expired. Please sign in again.' });
      }
      if (request.action === 'uploadDocument') return uploadDocument(request);
      if (request.action === 'overview') return getOverview(request);
      return request.action === 'documents' ? getDocuments(request) : getActivityLogs();
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
      // A warm summary costs only a cache read; never scan documents during login.
      summary: cachedOverviewSummary(),
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
    if (overviewMayChange) {
      try { CacheService.getScriptCache().remove('overview:v1'); } catch (error) { /* Optional summary cache. */ }
      try { CacheService.getScriptCache().remove('documents:v1'); } catch (error) { /* Optional registry cache. */ }
    }
    requestAccounts = undefined;
    requestCredentialRows = undefined;
  }
}

// Page content loads independently from the background PDF export.
function documentPage(request) {
  if (!getDocumentSession(request.token)) return jsonResponse({ success: false, message: 'Your session expired. Please sign in again.' });
  try {
    if (request.type && !Object.prototype.hasOwnProperty.call(CREATED_DOCUMENT_SHEETS, request.type)) throw new Error('Unsupported document type.');
    const entry = workflowDocument(request.id, true, request.type);
    if (request.type && entry.record.type !== request.type) throw new Error('Document was not found in this document type.');
    return jsonResponse({ success: true, form: entry.metadata.form ? { ...loadRichBodyForm(entry.metadata.form), status: entry.record.status, approvedAt: entry.record.approvedAt } : null, type: entry.record.type });
  } catch (error) { return jsonResponse({ success: false, message: error.message }); }
}

// Server-owned Google Docs export cache, keyed by Drive revision.
// Preview email attachments are validated separately by previewEmailPdf.
// Missing/evicted chunks safely fall back to a fresh export.
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
    if (cache && key && key === 'pdf:' + file.getId() + ':' + file.getLastUpdated().getTime()) {
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
    const entry = workflowDocument(request.id, true, request.type);
    const match = /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/(view|preview)$/.exec(entry.record.url);
    if (!match) throw new Error('Invalid document link.');
    const file = DriveApp.getFileById(match[1]);
    if (file.isTrashed()) throw new Error('Document is in Trash.');
    const mimeType = file.getMimeType();
    const native = mimeType === 'application/vnd.google-apps.document';
    if (!native && mimeType !== 'application/pdf') throw new Error('Unsupported document format.');
    let certificateLayoutVersion, authorityLayoutVersion;
    if (native) {
      const metadata = entry.metadata;
      authorityLayoutVersion = metadata.form && metadata.form.authorityLayoutVersion;
      certificateLayoutVersion = metadata.form && metadata.form.certificateLayoutVersion;
      if (metadata.type === 'Authority to Travel Abroad' && metadata.form && authorityLayoutVersion !== 3) {
        const lock = LockService.getScriptLock();
        lock.waitLock(30000);
        try {
          const cell = workflowDocument(request.id, true, request.type).cell;
          const current = JSON.parse(cell.getNote() || '{}');
          if (current.form.authorityLayoutVersion !== 3) {
            const doc = DocumentApp.openById(file.getId());
            doc.getBody().replaceText('This is to AUTHORIZED that, where applicable to personal travel', 'This is to CERTIFY that, where applicable to personal travel');
            doc.saveAndClose();
            current.form.body = current.form.authorityStructured ? travelAuthorityBody(current.form) : String(current.form.body || current.form.content || '').replace('This is to AUTHORIZED that, where applicable to personal travel', 'This is to CERTIFY that, where applicable to personal travel');
            current.form.authorityLayoutVersion = 3;
            cell.setNote(JSON.stringify(current));
            SpreadsheetApp.flush();
          }
          authorityLayoutVersion = current.form.authorityLayoutVersion;
        } finally { lock.releaseLock(); }
      }
      if (metadata.type === 'Certificate of Travel' && metadata.form && certificateLayoutVersion !== 3) {
        const lock = LockService.getScriptLock();
        lock.waitLock(30000);
        try {
          const cell = workflowDocument(request.id, true, request.type).cell;
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
    syncApprovalSignature(file, entry.metadata.form, entry.record.status);
    const pdf = preparedDocumentPdf(file);
    return jsonResponse({ success: true, certificateLayoutVersion: certificateLayoutVersion, authorityLayoutVersion: authorityLayoutVersion, native: native, fileId: file.getId(), name: String(entry.record.id).replace(/\.pdf$/i, '') + '.pdf', data: Utilities.base64Encode(pdf.getBytes()) });
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
  const rows = credentialRows(sheet);
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
  const current = registeredDocuments();
  let events = [];
  const sheet = appSpreadsheet().getSheetByName('ACTIVITY LOG');
  if (sheet && sheet.getLastRow() > 1) events = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getDisplayValues().map(activityFromRow).filter(record => record.id);
  return jsonResponse({ success: true, activities: current.concat(events) });
}

// Share the registry between overview and document-list requests. Navigation
// should not scan all six tabs again just to return the same records.
function cachedRegisteredDocuments(request) {
  let cache;
  try {
    cache = CacheService.getScriptCache();
    const stored = !(request && request.refresh) && cache.get('documents:v1');
    if (stored) {
      const documents = JSON.parse(stored);
      if (Array.isArray(documents)) return documents;
      if (documents && typeof documents.generation === 'string' && Number.isInteger(documents.chunks) && documents.chunks > 0 && documents.chunks <= 100) {
        const keys = Array.from({ length: documents.chunks }, (_, i) => 'documents:chunk:' + documents.generation + ':' + i);
        const chunks = cache.getAll(keys);
        if (keys.every(key => typeof chunks[key] === 'string')) {
          const restored = JSON.parse(keys.map(key => chunks[key]).join(''));
          if (Array.isArray(restored)) return restored;
        }
      }
    }
  } catch (error) { /* Cache is optional. */ }
  const documents = registeredDocuments().reverse();
  try {
    const serialized = JSON.stringify(documents);
    // Stay below CacheService's 100 KB per-key limit, including Unicode text.
    if (cache && serialized.length < 24000) cache.put('documents:v1', serialized, 30);
    else if (cache && serialized.length <= 2400000) {
      // Unique generations prevent concurrent writers from mixing chunks.
      // Publish the manifest last; evicted chunks simply trigger a live read.
      const generation = Utilities.getUuid();
      const count = Math.ceil(serialized.length / 24000);
      const chunks = {};
      for (let i = 0; i < count; i++) chunks['documents:chunk:' + generation + ':' + i] = serialized.slice(i * 24000, (i + 1) * 24000);
      cache.putAll(chunks, 30);
      cache.put('documents:v1', JSON.stringify({ generation: generation, chunks: count }), 30);
    }
  } catch (error) { /* Large registers and cache failures use live reads. */ }
  return documents;
}

function getDocuments(request) {
  const documents = cachedRegisteredDocuments(request);
  // Older clients still receive the original response. New clients keep their
  // list when its exact serialized contents have not changed.
  if (request && request.conditional === true) {
    const revision = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(documents)));
    if (!request.refresh && request.revision === revision) return jsonResponse({ success: true, unchanged: true, revision: revision });
    return jsonResponse({ success: true, documents: documents, revision: revision });
  }
  return jsonResponse({ success: true, documents: documents });
}

// Return chart counts only. No activity history, document bodies or Drive reads.
function cachedOverviewSummary() {
  try {
    const stored = CacheService.getScriptCache().get('overview:v1');
    const summary = stored && JSON.parse(stored);
    if (summary && typeof summary.total === 'number' && summary.types && summary.statuses && summary.months) return summary;
  } catch (error) { /* Optional startup shortcut. */ }
  return undefined;
}

function getOverview(request) {
  // doPost already authenticated this token; reuse that account within this
  // execution instead of making the browser start a second Apps Script call.
  const user = request && request.includeUser ? authenticatedAccount(request.token) : undefined;
  let cache;
  try {
    cache = CacheService.getScriptCache();
    const stored = !(request && request.refresh) && cache.get('overview:v1');
    if (stored) {
      const summary = JSON.parse(stored);
      if (summary && typeof summary.total === 'number' && summary.types && summary.statuses && summary.months) return jsonResponse({ success: true, summary: summary, user: user });
    }
  } catch (error) { /* Cache failures fall back to reading the register. */ }
  const summary = { total: 0, types: {}, statuses: {}, months: {} };
  cachedRegisteredDocuments(request).forEach(record => {
    if (!record.id || record.deleted || record.id === '1cb7ca84-b1d8-420a-a4ce-84dc89f79281') return;
    summary.total++;
    const type = record.type || 'Unclassified';
    summary.types[type] = (summary.types[type] || 0) + 1;
    summary.statuses[record.status] = (summary.statuses[record.status] || 0) + 1;
    const date = new Date(record.updated);
    if (!isNaN(date.getTime())) {
      const month = Utilities.formatDate(date, 'Asia/Manila', 'yyyy-MM');
      summary.months[month] = (summary.months[month] || 0) + 1;
    }
  });
  try { if (cache) cache.put('overview:v1', JSON.stringify(summary), 30); } catch (error) { /* Summary remains available. */ }
  return jsonResponse({ success: true, summary: summary, user: user });
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
  const contentWidth = DOCUMENT_PAGE_WIDTH - leftMargin - rightMargin;
  body.setPageWidth(DOCUMENT_PAGE_WIDTH).setPageHeight(DOCUMENT_PAGE_HEIGHT).setMarginTop(30).setMarginBottom(36).setMarginLeft(leftMargin).setMarginRight(rightMargin);
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
  const title = heading || String(data.number ? 'Executive Memorandum Order No. ' + data.number : data.reference).replace(/,?\s*s\.\s*\d{4}\s*$/i, '');
  const banner = body.appendTable([[String(title).toUpperCase(), 'Series of ' + data.year]]);
  banner.setBorderColor(green).setBorderWidth(0.5).setColumnWidth(0, contentWidth * 290 / 508).setColumnWidth(1, contentWidth * 218 / 508);
  for (let col = 0; col < 2; col++) {
    banner.getCell(0, col).setBackgroundColor('#f4f6f5').setPaddingTop(0).setPaddingBottom(0).setPaddingLeft(0)
      .editAsText().setFontFamily('Arial').setFontSize(10).setBold(false);
  }
  body.appendParagraph('').setSpacingAfter(12).editAsText().setFontSize(1);
  const recipient = data.recipients && data.recipients.length ? data.recipients.map(item => [item.name, item.position, item.institution].filter(Boolean).join('\n')).join('\n\n') : [data.recipientName || data.recipient, data.recipientPosition, data.institution, data.additionalInstitution].filter(Boolean).join('\n');
  const details = [[(data.recipientLabel || 'For').toUpperCase() + ':', recipient]];
  if (data.thru) details.push(['THRU:', data.thru]);
  const orderDateParts = String(data.date || '').split('-');
  const orderMonth = executiveMemoDate(data.date).split(' ')[0].toUpperCase();
  details.push(['SUBJECT:', String(data.subject || '').toUpperCase()], ['DATE:', orderDateParts[2] + ' ' + orderMonth + ' ' + orderDateParts[0]]);
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
  body.setPageWidth(DOCUMENT_PAGE_WIDTH).setPageHeight(DOCUMENT_PAGE_HEIGHT).setMarginTop(54).setMarginBottom(54).setMarginLeft(64.8).setMarginRight(64.8);
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
    'This is to CERTIFY that, where applicable to personal travel, the personnel concerned shall not represent the institution and shall not utilize government funds for the approved travel.',
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
  const width = DOCUMENT_PAGE_WIDTH - 51.75 * 2;
  body.setPageWidth(DOCUMENT_PAGE_WIDTH).setPageHeight(DOCUMENT_PAGE_HEIGHT).setMarginLeft(51.75).setMarginRight(51.75).setMarginTop(30).setMarginBottom(36);
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
  const banner = body.appendTable([[authority ? 'AUTHORITY TO TRAVEL ABROAD' : 'TRAVEL CERTIFICATE']]);
  banner.setBorderWidth(0).setColumnWidth(0, width);
  const titleCell = banner.getCell(0, 0).setPaddingLeft(0).setPaddingTop(6).setPaddingBottom(6);
  style(titleCell.getChild(0).asParagraph(), 14, true);
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
  if (authority) data.authorityLayoutVersion = 3;
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
  // Override the master paper size for the generated copy only.
  doc.getBody().setPageWidth(DOCUMENT_PAGE_WIDTH).setPageHeight(DOCUMENT_PAGE_HEIGHT);
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
  const travelType = data.travelType || 'Official Time';
  const typeParagraph = tables[1].getCell(0, 0).getChild(0).asParagraph().copy();
  typeParagraph.editAsText().setText('TYPE OF TRAVEL: ' + travelType);
  const orderBody = doc.getBody();
  orderBody.insertParagraph(orderBody.getChildIndex(tables[1]), typeParagraph);
  orderBody.replaceText('travel on official time,', 'travel on ' + travelType.toLowerCase() + ',');
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
  const banner = tables[0];
  banner.setBorderColor('#356442').setBorderWidth(0.5).setColumnWidth(0, contentWidth * 290 / 508).setColumnWidth(1, contentWidth * 218 / 508);
  for (let col = 0; col < 2; col++) {
    const cell = banner.getCell(0, col).setBackgroundColor('#f4f6f5').setPaddingTop(0).setPaddingBottom(0).setPaddingLeft(0);
    cell.editAsText().setFontFamily('Arial').setFontSize(10).setBold(false);
  }
  banner.getCell(0, 1).getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
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
    if (matches.hasNext()) {
      file = matches.next();
      file.setContent(source);
    } else file = folder.createFile(name, source, 'application/json');
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
      clean.attrs = { textAlign: ['left', 'center', 'right', 'justify'].includes(attrs.textAlign) ? attrs.textAlign : 'left', indent: Math.max(0, Math.min(8, Number(attrs.indent) || 0)), firstLineIndent: Math.max(0, Math.min(8, Number(attrs.firstLineIndent) || 0)), lineSpacing: [1, 1.15, 1.5, 2].includes(Number(attrs.lineSpacing)) ? Number(attrs.lineSpacing) : 1.15 };
      if (node.type === 'heading') clean.attrs.level = [1, 2, 3].includes(attrs.level) ? attrs.level : 1;
    }
    if (node.type === 'orderedList') clean.attrs = { start: Math.max(1, Math.min(9999, Number(attrs.start) || 1)) };
    if (node.type === 'tableRow' && attrs.height != null) {
      if (!Number.isFinite(attrs.height) || attrs.height < 24 || attrs.height > 1000) throw new Error('Invalid table row height.');
      clean.attrs = { height: Math.round(attrs.height) };
    }
    if (node.type === 'table' && (!node.content?.length || node.content.length > 100)) throw new Error('Tables must have between 1 and 100 rows.');
    if (node.type === 'tableRow' && (!node.content?.length || node.content.length > 12)) throw new Error('Tables must have between 1 and 12 columns.');
    if (['tableCell', 'tableHeader'].includes(node.type) && ((attrs.colspan || 1) !== 1 || (attrs.rowspan || 1) !== 1)) throw new Error('Merged table cells are not supported. Split the cells before saving.');
    if (['tableCell', 'tableHeader'].includes(node.type) && attrs.colwidth != null) {
      if (!Array.isArray(attrs.colwidth) || attrs.colwidth.length !== 1 || !Number.isFinite(attrs.colwidth[0]) || attrs.colwidth[0] < 40 || attrs.colwidth[0] > 2000) throw new Error('Invalid table column width.');
      clean.attrs = { colwidth: [attrs.colwidth[0]] };
    }
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
    p.setAlignment(alignment[attrs.textAlign] || alignment.left).setIndentStart((attrs.indent || 0) * 24 + (opts.indent || 0)).setIndentFirstLine(((attrs.indent || 0) + (attrs.firstLineIndent || 0)) * 24 + (opts.indent || 0))
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
        const widths = node.content[0].content.map(cell => cell.attrs?.colwidth?.[0] || 100);
        const totalWidth = widths.reduce((total, width) => total + width, 0);
        for (let col = 0; col < columns; col++) table.setColumnWidth(col, (opts.width || 508) * widths[col] / totalWidth);
        node.content.forEach((row, r) => {
          if (row.attrs?.height) table.getRow(r).setMinimumHeight(row.attrs.height * 0.75);
        });
        node.content.forEach((row, r) => row.content.forEach((cell, c) => {
          const target = table.getCell(r, c);
          target.setPaddingTop(6).setPaddingBottom(6).setPaddingLeft(6).setPaddingRight(6);
          if (cell.type === 'tableHeader') target.setBackgroundColor('#f1f3f5');
          render(target, cell.content || [], { header: cell.type === 'tableHeader', width: (opts.width || 508) * widths[c] / totalWidth - 12 });
          // appendTable creates one empty paragraph per cell; remove it after filling.
          if (target.getNumChildren() > 1) target.removeChild(target.getChild(0));
        }));
      }
    });
  }
  render(body, source.content || [], { width: DOCUMENT_PAGE_WIDTH - 72 * (source.attrs.marginLeft + source.attrs.marginRight) });
}

function validateTemplateDocument(request, type) {
  const simple = ['Authority to Travel Abroad', 'Certificate of Travel'].includes(type);
  const travel = type === 'Travel Order';
  const data = {};
  if (['Executive Memorandum', 'Special Order'].includes(type) && request.recipients !== undefined) {
    if (!Array.isArray(request.recipients) || !request.recipients.length) throw new Error('Please add at least one recipient.');
    data.recipients = request.recipients.map(item => {
      if (!item || typeof item !== 'object') throw new Error('Invalid recipient.');
      const recipient = {};
      ['name', 'position', 'institution'].forEach(key => {
        recipient[key] = String(item[key] || '').trim();
        if (recipient[key].length > 2000) throw new Error('Recipient ' + key + ' is too long.');
      });
      if (!recipient.name) throw new Error('Please enter a name for every recipient.');
      return recipient;
    });
    request = { ...request, recipientName: data.recipients.map(item => item.name).join('\n'), recipientPosition: data.recipients.map(item => item.position).join('\n'), institution: data.recipients.map(item => item.institution).join('\n'), additionalInstitution: '' };
  }
  if (['Executive Memorandum', 'Special Order'].includes(type) && request.bodyRich) {
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
  const optional = ['thru', 'additionalInstitution', 'cc', ...(travel ? ['remarks'] : []), ...(['Executive Memorandum', 'Special Order'].includes(type) ? ['recipientPosition', 'institution'] : [])];
  fields.forEach(key => {
    data[key] = String(request[key] || '').trim();
    if (!optional.includes(key) && !data[key]) throw new Error('Please enter ' + key.replace(/([A-Z])/g, ' $1').toLowerCase() + '.');
    if (data[key].length > (key === 'body' ? 50000 : 2000)) throw new Error('The ' + key + ' is too long.');
  });
  if (data.bodyRich) data.body = richBodyPlainText(data.bodyRich);
  if (travel) {
    data.travelType = request.travelType === undefined ? 'Official Time' : String(request.travelType).trim();
    if (!['Official Business', 'Official Time'].includes(data.travelType)) throw new Error('Choose Official Business or Official Time as the type of travel.');
  }
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
function creationReferenceLog(sheet, type) {
  const snapshot = createdDocumentLogSnapshot(sheet);
  const referenceColumn = ['Executive Memorandum', 'Special Order'].includes(type) ? 2 : 1;
  const values = snapshot.rows.length ? sheet.getRange(2, referenceColumn, snapshot.rows.length, 1).getDisplayValues() : [];
  const rows = values.map((row, index) => {
    let note = {};
    try { note = JSON.parse(snapshot.notes[index][0] || '{}'); } catch (error) { /* Legacy note. */ }
    const reference = note.reference || row[0];
    const year = note.year || /(?:s\.\s*|[- ])((?:19|20)\d{2})\b/.exec(reference || '')?.[1] || '';
    return [reference, year];
  });
  // Include existing sent/legacy category references without requiring that tab.
  const category = appSpreadsheet().getSheetByName(TYPE_LOG_SHEETS[type]);
  if (category && category.getLastRow() > 1) rows.push(...sheetDataRows(category, 2, 2));
  return { getLastRow: () => rows.length + 1, getRange: () => ({ getDisplayValues: () => rows }) };
}

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
    stage = 'checking ' + CREATED_DOCUMENT_SHEETS[type] + ' first-row headers';
    const creationSheet = createdDocumentSheet(type);
    stage = 'prepare';
    if (autoReference) {
      const reserved = reserveDocumentReference(request, data, automaticDate, creationReferenceLog(creationSheet, type));
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
    const hasCreationEvidence = creationRows.some((row, i) => {
      if (row[0] === key) return true;
      try { return Boolean(row[0]) && JSON.parse(creationSnapshot.notes[i][0] || '{}').createdDocumentId === key; }
      catch (error) { return false; }
    });
    const hasMainRowEvidence = index >= 0;
    const hasRecoveryEvidence = Boolean(state && (state.fileId || state.allocationName));
    // Ignore orphaned reservations with no saved row or recoverable Drive allocation.
    if (state && !hasMainRowEvidence && !hasCreationEvidence && !hasRecoveryEvidence) {
      properties.deleteProperty(key);
      state = null;
    }
    // Legacy attempts need form and register evidence; new saves have a completion flag.
    const completed = state && (state.completed === true || (state.completed === undefined && hasMainRowEvidence && hasCreationEvidence));
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
    const savedEntry = createdRegistryEntries().find(entry => entry.metadata.createdDocumentId === key);
    if (completed && !savedEntry && index < 0) throw new Error('The saved form row was removed. Start a new creation request.');
    if (completed && savedEntry) return jsonResponse({ success: true, document: savedEntry.record });
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
      if (['Approved', 'Out'].includes(state.status) && !state.approvedAt) state.approvedAt = new Date().toISOString();
      syncApprovalSignature(file, data, state.status);
      state.rendered = true;
      saveState();
    }
    stage = 'registry';
    const record = { activity: type.toUpperCase(), id: id, date: executiveMemoDate(data.date), subject: data.subject, url: 'https://drive.google.com/file/d/' + state.fileId + '/view', type: type, year: data.year, status: state.status };
    const metadata = savedEntry ? savedEntry.metadata : {};
    if (['Approved', 'Out'].includes(metadata.status || record.status) && !metadata.approvedAt) metadata.approvedAt = state.approvedAt || new Date().toISOString();
    const storedData = storeRichBodyForm(data, file, state.bodyRichFileId);
    if (storedData.bodyRichFileId && state.bodyRichFileId !== storedData.bodyRichFileId) { state.bodyRichFileId = storedData.bodyRichFileId; saveState(); }
    const savedNote = JSON.stringify({ ...metadata, type: record.type, year: record.year, status: metadata.status || record.status, owner: owner, form: { ...storedData, travelFrom: request.travelFrom || '', travelUntil: request.travelUntil || '', templateVersion: request.templateVersion || 1, type: type, signatoryPosition: data.position || request.signatoryPosition || '' }, createdDocumentId: key });
    logCreatedDocument(creationSheet, { ...record, status: metadata.status || record.status }, data, key, creationSnapshot, JSON.parse(savedNote));
    SpreadsheetApp.flush();
    state.completed = true;
    saveState();
    return jsonResponse({ success: true, document: documentFromRow([record.activity, id, record.date, record.subject, record.url], savedNote) });
  } catch (error) {
    console.error('Document creation failed during ' + stage + ': ' + String(error && error.message || error));
    if (stage.startsWith('checking ')) return jsonResponse({ success: false, message: 'Creation failed while ' + stage + '. ' + String(error && error.message || error) });
    if (type === 'Travel Order' && stage !== 'registry') return jsonResponse({ success: false, message: 'Unable to create Travel Order during ' + stage + ': ' + String(error && error.message || error) + ' Retry the same form after correcting this error.' });
    if (stage === 'allocate') return jsonResponse({ success: false, message: 'Google Docs creation could not finish. The deployment owner should run checkCreateDocumentSetup in Apps Script and authorize access, then update the web app deployment. Retry the same fields afterward; the reserved number can be recovered automatically.' });
    return jsonResponse({ success: false, message: stage === 'registry' ? 'Document was created, but the ' + CREATED_DOCUMENT_SHEETS[type] + ' form tab could not be updated. Retry with the same fields to finish logging without creating another document.' : 'Unable to create ' + type + '. Please retry with the same fields. If this persists, ask the administrator to check document access and sheet configuration.' });
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
      const entry = workflowDocument(request.id, true);
      if (!entry.metadata.form) throw new Error('This record has no editable form. You can edit its registry title.');
      return jsonResponse({ success: true, form: loadRichBodyForm(entry.metadata.form) });
    }
    if (request.action === 'updateDocumentContent') return updateDocumentContent(request);
    if (request.action === 'sendDocument') return sendRegisteredDocument(request, user);
    if (request.action === 'documentSendStatus') return documentSendStatus(request, user);
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

// Preview reads transfer one row rather than the entire growing register.
// Resolve again under the migration lock: deletes can shift row positions.
function workflowDocument(id, targeted, documentType) {
  if (typeof id !== 'string' || !id) throw new Error('Document was not found.');
  if (documentType && !Object.prototype.hasOwnProperty.call(CREATED_DOCUMENT_SHEETS, documentType)) throw new Error('Unsupported document type.');
  const typedEntry = documentType ? createdRegistryEntries(documentType, id).find(entry => entry.record.id === id) : null;
  if (typedEntry) return { ...typedEntry, cell: typedEntry.sheet.getRange(typedEntry.row, 1) };
  function fromForm() {
    const entry = documentType ? null : createdRegistryEntries().find(entry => entry.record.id === id);
    if (!entry) throw new Error('Document was not found.');
    return { ...entry, cell: entry.sheet.getRange(entry.row, 1) };
  }
  const sheet = mainFilesSheet();
  let row, values;
  if (targeted) {
    const lastRow = sheet.getLastRow();
    if (typeof id !== 'string' || !id) throw new Error('Document was not found.');
    if (lastRow < 2) return fromForm();
    const match = sheet.getRange(2, 2, lastRow - 1, 1).createTextFinder(id)
      .matchEntireCell(true).matchCase(true).useRegularExpression(false).findNext();
    if (!match) return fromForm();
    row = match.getRow();
    values = sheet.getRange(row, 1, 1, 5).getDisplayValues()[0];
    if (values[1] !== id) throw new Error('Document was not found. Please retry.');
  } else {
    const rows = sheetDataRows(sheet, 1, 5);
    const index = rows.findIndex(value => value[1] === id);
    if (index < 0) return fromForm();
    row = index + 2;
    values = rows[index];
  }
  const cell = sheet.getRange(row, 2);
  const note = cell.getNote();
  let metadata;
  try { metadata = JSON.parse(note || '{}'); } catch (error) {
    if (!targeted) throw error;
    metadata = {}; // Uploaded legacy PDFs may have non-JSON filing notes.
  }
  if (targeted && (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))) metadata = {};
  const record = documentFromRow(values, note);
  if (record.deleted) throw new Error('Document was not found.');
  return { sheet: sheet, row: row, cell: cell, metadata: metadata, record: record };
}

function documentVerificationLink(request) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const entry = workflowDocument(request.id, true);
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
  if (index < 0) {
    const created = createdRegistryEntries().find(entry => entry.metadata.verificationCode === code);
    if (!created) throw new Error('No registered document matches this code.');
    const record = created.record;
    return jsonResponse({ success: true, document: publicVerificationRecord(record) });
  }
  const row = sheet.getRange(index + 2, 1, 1, 5).getDisplayValues()[0];
  const record = documentFromRow(row, notes[index][0]);
  if (record.deleted) throw new Error('This record is no longer available.');
  return jsonResponse({ success: true, document: publicVerificationRecord(record) });
}

function publicVerificationRecord(record) {
  const match = /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/(view|preview)$/.exec(record.url || '');
  // Drive enforces the registered file's existing access permissions.
  return { id: record.id, type: record.type, date: record.date, status: record.status,
    ...(match ? { previewUrl: 'https://drive.google.com/file/d/' + match[1] + '/preview' } : {}) };
}

function updateDocumentContent(request) {
  if (!canChangeDocumentStatus(request.token)) throw new Error('Admin access is required.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const entry = workflowDocument(request.id, true);
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
    syncApprovalSignature(file, data, entry.record.status);
    const storedData = storeRichBodyForm(data, file, entry.metadata.form.bodyRichFileId);
    entry.metadata.form = { ...storedData, travelFrom: request.travelFrom || '', travelUntil: request.travelUntil || '', type: entry.record.type, templateVersion: 2, signatoryPosition: data.position || request.signatoryPosition || '' };
    entry.metadata.updated = new Date().toISOString();
    entry.cell.setNote(JSON.stringify(entry.metadata));
    if (entry.created) {
      entry.metadata.registry[3] = data.subject;
      entry.cell.setNote(JSON.stringify(entry.metadata));
    } else entry.sheet.getRange(entry.row, 4).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(data.subject).build());
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

// Warm the revision-keyed server PDF cache while the sender fills in the email.
// Return metadata only; attachment bytes always come from registered Drive files.
function prepareEmailAttachment(request) {
  if (!canChangeDocumentStatus(request.token)) return jsonResponse({ success: false, message: 'Admin access is required to send documents.' });
  try {
    const entry = workflowDocument(request.id, true);
    if (!['Approved', 'Out'].includes(entry.record.status)) throw new Error('Approve the document before sending it.');
    const match = /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/(view|preview)$/.exec(entry.record.url);
    const file = match && DriveApp.getFileById(match[1]);
    if (!file || file.isTrashed()) throw new Error('The registered file is unavailable.');
    if (!['application/vnd.google-apps.document', 'application/pdf'].includes(file.getMimeType())) throw new Error('Unsupported document format.');
    syncApprovalSignature(file, entry.metadata.form, entry.record.status);
    const pdf = preparedDocumentPdf(file);
    if (pdf.getBytes().length > 20 * 1024 * 1024) throw new Error('This PDF exceeds the 20 MB email attachment limit.');
    return jsonResponse({ success: true, name: String(entry.record.id).replace(/\.pdf$/i, '') + '.pdf', revision: file.getLastUpdated ? String(file.getLastUpdated().getTime()) : '' });
  } catch (error) { return jsonResponse({ success: false, message: error.message }); }
}

// An authenticated admin may email the preview PDF, including its registry QR.
// Bind it to the current registered revision and enforce the attachment limit.
function previewPdfHash(preview) {
  if (!preview || typeof preview.data !== 'string' || !preview.data.length || preview.data.length > Math.ceil(20 * 1024 * 1024 / 3) * 4 || !/^[A-Za-z0-9+/=]+$/.test(preview.data)) throw new Error('Invalid or oversized preview PDF.');
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, preview.data));
}
function previewEmailPdf(preview, entry) {
  if (!preview.revision || preview.revision !== entry.record.updated) throw new Error('The document changed after this preview was prepared. Close and reopen the preview.');
  const bytes = Utilities.base64Decode(preview.data);
  if (bytes.length > 20 * 1024 * 1024 || bytes.slice(0, 5).map(byte => String.fromCharCode(byte)).join('') !== '%PDF-') throw new Error('The preview attachment is not a valid PDF.');
  const name = String(preview.name || 'Document.pdf');
  if (name.length > 250 || !/\.pdf$/i.test(name) || /[\r\n]/.test(name)) throw new Error('Invalid preview PDF filename.');
  return Utilities.newBlob(bytes, 'application/pdf', name);
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
    const entry = workflowDocument(request.id, true);
    const props = PropertiesService.getScriptProperties();
    const key = 'sent:' + request.requestId;
    const prior = JSON.parse(props.getProperty(key) || 'null');
    const fingerprint = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify([request.id, to, cc, subject, message])));
    const previewHash = request.previewPdf ? previewPdfHash(request.previewPdf) : '';
    if (prior) {
      if (prior.id !== request.id || prior.owner !== user.email) throw new Error('Send request does not match.');
      if ((prior.previewHash || '') !== previewHash) throw new Error('This send request already used a different PDF. Close and reopen the email form.');
      if (prior.fingerprint !== fingerprint) throw new Error('This send request already used different recipients or content. Close and reopen the email form to start a new email.');
      if (prior.state !== 'sent') throw new Error('This send attempt has an uncertain result. Check the sender mailbox before starting another email.');
      return finishDocumentSend(entry, request, to, cc);
    }
    if (!['Approved', 'Out'].includes(entry.record.status)) throw new Error('Approve the document before sending it.');
    const match = /\/d\/([a-zA-Z0-9_-]+)/.exec(entry.record.url);
    const file = match && DriveApp.getFileById(match[1]);
    if (!file || file.isTrashed()) throw new Error('The registered file is unavailable.');
    if (request.attachmentRevision && String(file.getLastUpdated().getTime()) !== request.attachmentRevision) throw new Error('The document changed after its attachment was prepared. Close and reopen the email form to prepare the current PDF.');
    if (!request.previewPdf) syncApprovalSignature(file, entry.metadata.form, entry.record.status);
    const pdf = request.previewPdf ? previewEmailPdf(request.previewPdf, entry) : preparedDocumentPdf(file);
    if (pdf.getBytes().length > 20 * 1024 * 1024) throw new Error('This PDF exceeds the 20 MB email attachment limit.');
    const profile = Gmail.Users.getProfile('me');
    const raw = gmailPdfMessage(user, profile.emailAddress, to, cc, subject, message, pdf, entry.record.id);
    const state = { id: request.id, owner: user.email, state: 'pending', fingerprint: fingerprint, previewHash: previewHash };
    props.setProperty(key, JSON.stringify(state));
    const sent = Gmail.Users.Messages.send({ raw: raw }, 'me');
    if (!sent || !sent.id) throw new Error('Gmail did not confirm the send. Check the sender mailbox before starting another email.');
    state.state = 'sent';
    state.gmailMessageId = sent.id;
    state.document = { ...entry.record, status: 'Out', updated: new Date().toISOString() };
    props.setProperty(key, JSON.stringify(state));
    const result = finishDocumentSend(entry, request, to, cc);
    state.registryComplete = true;
    props.setProperty(key, JSON.stringify(state));
    return result;
  } finally { lock.releaseLock(); }
}

// Recover a lost HTTP response without issuing another Gmail send.
function documentSendStatus(request, user) {
  if (!canChangeDocumentStatus(request.token)) throw new Error('Admin access is required.');
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(String(request.requestId || ''))) throw new Error('Invalid send request.');
  const lock = LockService.getScriptLock();
  // Read the Gmail receipt before waiting for spreadsheet work owned by the
  // original send. That work can be slow even though the email is already sent.
  const receipt = JSON.parse(PropertiesService.getScriptProperties().getProperty('sent:' + request.requestId) || 'null');
  if (!receipt) return jsonResponse({ success: true, confirmed: false });
  if (receipt.id !== request.id || receipt.owner !== user.email) throw new Error('Send request does not match.');
  if (receipt.state !== 'sent') return jsonResponse({ success: true, confirmed: false });
  const receiptTo = emailAddresses(request.to, true), receiptCc = emailAddresses(request.cc, false);
  const receiptFingerprint = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify([request.id, receiptTo, receiptCc, String(request.subject || '').trim(), String(request.message || '').trim()])));
  if (receipt.fingerprint !== receiptFingerprint) throw new Error('Send request does not match.');
  if (receipt.registryComplete && receipt.document) return jsonResponse({ success: true, confirmed: true, document: receipt.document });
  if (typeof lock.tryLock === 'function') {
    if (!lock.tryLock(1)) {
      return jsonResponse({ success: true, confirmed: !!receipt.document, registryPending: true, document: receipt.document });
    }
  } else lock.waitLock(30000);
  try {
    const state = JSON.parse(PropertiesService.getScriptProperties().getProperty('sent:' + request.requestId) || 'null');
    if (!state) return jsonResponse({ success: true, confirmed: false });
    if (state.id !== request.id || state.owner !== user.email) throw new Error('Send request does not match.');
    if (state.state !== 'sent') return jsonResponse({ success: true, confirmed: false });
    const to = emailAddresses(request.to, true), cc = emailAddresses(request.cc, false);
    const fingerprint = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify([request.id, to, cc, String(request.subject || '').trim(), String(request.message || '').trim()])));
    if (state.fingerprint !== fingerprint) throw new Error('Send request does not match.');
    return finishDocumentSend(workflowDocument(request.id, true), request, to, cc);
  } finally { lock.releaseLock(); }
}

function finishDocumentSend(entry, request, to, cc) {
  // This runs only after a confirmed Gmail receipt, including recovery retries.
  if (entry.created) {
    const log = typeLogSheet(entry.record.type);
    if (!existingTypeLogRow(log, entry.record.id)) writeTypeLog(log, log.getLastRow() + 1, { ...entry.record, date: new Date().toISOString() });
  }
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

// Gmail requires a base64url-encoded MIME message, including the PDF attachment.
function gmailPdfMessage(user, sender, to, cc, subject, message, pdf, fileName) {
  const encodedHeader = value => {
    const bytes = Utilities.newBlob(String(value).replace(/[\r\n]/g, ' ')).getBytes();
    // Each encoded word stays within RFC 2047's 75-character limit. Split by
    // Unicode code point so multibyte characters survive long subjects/names.
    const words = []; let chunk = '';
    for (const char of String(value).replace(/[\r\n]/g, ' ')) {
      if (Utilities.newBlob(chunk + char).getBytes().length > 42) {
        words.push('=?UTF-8?B?' + Utilities.base64Encode(Utilities.newBlob(chunk).getBytes()) + '?='); chunk = '';
      }
      chunk += char;
    }
    if (chunk || !bytes.length) words.push('=?UTF-8?B?' + Utilities.base64Encode(Utilities.newBlob(chunk).getBytes()) + '?=');
    return words.join('\r\n ');
  };
  const address = value => {
    const text = String(value || '');
    if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(text)) throw new Error('Invalid sender or recipient email address.');
    return text;
  };
  const lines = data => (Utilities.base64Encode(data).match(/.{1,76}/g) || []).join('\r\n');
  const boundary = 'op_pdf_' + Utilities.getUuid();
  const name = String(fileName || 'Document').replace(/\.pdf$/i, '') + '.pdf';
  const fallbackName = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\\r\n]/g, '_');
  const headers = [
    'From: ' + encodedHeader('J.H. Cerilles State College Office of the President') + ' <' + address(sender) + '>',
    'To: ' + to.map(address).join(', '),
    'Reply-To: ' + address(user.email),
    'Subject: ' + encodedHeader(subject),
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="' + boundary + '"',
  ];
  if (cc.length) headers.splice(2, 0, 'Cc: ' + cc.map(address).join(', '));
  const mime = headers.concat([
    '', '--' + boundary, 'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64', '', lines(Utilities.newBlob(message).getBytes()),
    '--' + boundary, 'Content-Type: application/pdf',
    'Content-Disposition: attachment; filename="' + fallbackName + '"; filename*=UTF-8\'\'' + encodeURIComponent(name).replace(/['()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase()),
    'Content-Transfer-Encoding: base64', '', lines(pdf.getBytes()), '--' + boundary + '--', '',
  ]).join('\r\n');
  return Utilities.base64EncodeWebSafe(Utilities.newBlob(mime).getBytes()).replace(/=+$/, '');
}

// Run as deployment owner to authorize/check Gmail without sending an email.
function checkEmailSetup() {
  const profile = Gmail.Users.getProfile('me');
  console.log('Gmail API ready. Sender account: ' + profile.emailAddress);
}

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

// Email register: run setupEmailSheet once, then syncEmailSheet as the mailbox owner.
const EMAIL_SHEET_HEADERS = ['Timestamp', 'Reference No', 'Date Received', 'Received From', 'Subject', 'Remarks', 'Links'];
// Fixed Manila start date: future runs can catch up without importing earlier mail.
const EMAIL_IMPORT_START_DATE = '2026-10-12';
const EMAIL_REMARKS = ['Incoming', 'For Information', 'Acknowledge', 'Invitations', 'Memorandum', 'Forwarded'];

// Automatic replies share the existing Gmail conversation and reply safeguards.
function emailRemarksMessage(remarks, reference) {
  const templates = {
    Acknowledge: 'We acknowledge receipt of your inqury/email. It has been received by the Office of the President for review.',
    Forwarded: 'Your inquiry/email has been forwarded to the concerned office for review and appropriate action by the Office of the President. Further updates will be communicated as available.',
    Invitations: 'Thank you for your invitation. It has been received by the Office of the President for consideration. Attendance or participation will be confirmed separately.',
  };
  return templates[remarks] ? ['Greetings!,', templates[remarks], 'Reference No: ' + reference, 'Thank you.\nOffice of the President\nJ.H. Cerilles State College'].join('\n\n') : '';
}

// Email-sized copy of public/jhcsclogo.png, embedded as a CID inline image.
const EMAIL_JHCSC_LOGO_PNG = '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';

// Table layout and inline styles work across Gmail, Outlook and mobile clients.
// All variable text is escaped; this HTML is generated only on the server.
function emailRemarksHtml(remarks, reference, forward) {
  const text = emailRemarksMessage(remarks, reference);
  if (!text && !forward) return '';
  const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const styles = {
    Acknowledge: ['Acknowledgment of receipt', '#356442', '#edf5ef', 'RECEIVED'],
    Forwarded: ['Your Inquiry/Email has been forwarded', '#356442', '#edf5ef', 'FORWARDED'],
    Invitations: ['Thank you for your INVITATION', '#425a89', '#edf1fa', 'INVITATION RECEIVED'],
  };
  const [heading, color, background, badge] = forward ? ['Forwarded correspondence', '#356442', '#edf5ef', 'FORWARDED EMAIL'] : styles[remarks];
  const message = forward ? forward.message : text.split('\n\n')[1];
  return '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;background-color:#f3f5f3;color:#25332c;font-family:Arial,Helvetica,sans-serif;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f5f3;"><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #dde5df;border-radius:12px;">' +
    '<tr><td align="center" style="padding:26px 28px;background-color:#244d36;border-radius:12px 12px 0 0;text-align:center;">' +
    '<img src="cid:jhcsc-email-logo" width="88" height="88" alt="JHCSC logo" style="display:block;width:88px;height:88px;margin:0 auto 18px;border:0;">' +
    '<p style="margin:0 0 8px;color:#d2e5d7;font-size:11px;font-weight:bold;letter-spacing:2px;">J.H. CERILLES STATE COLLEGE</p>' +
    '<p style="margin:0;color:#ffffff;font-size:23px;line-height:30px;font-weight:bold;">Office of the President</p>' +
    '<p style="margin:8px 0 0;color:#d2e5d7;font-size:12px;line-height:18px;">Mati, San Miguel, Zamboanga del Sur</p></td></tr>' +
    '<tr><td style="padding:30px 28px 12px;"><span style="display:inline-block;padding:7px 11px;border-radius:4px;background-color:' + background + ';color:' + color + ';font-size:11px;font-weight:bold;letter-spacing:1px;">' + badge + '</span>' +
    '<h1 style="margin:18px 0 24px;font-size:24px;line-height:32px;font-weight:bold;color:#244d36;">' + heading + '</h1>' +
    '<p style="margin:0 0 16px;font-size:15px;line-height:25px;">Greetings,</p>' +
    '<p style="margin:0 0 24px;font-size:15px;line-height:25px;">' + escape(message).replace(/\r?\n/g, '<br>') + '</p>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:17px 18px;background-color:#f4f7f4;border-left:3px solid #356442;">' +
    '<p style="margin:0 0 7px;font-size:10px;letter-spacing:1.5px;font-weight:bold;color:#607368;">' + (forward ? 'SUBJECT' : 'REFERENCE NUMBER') + '</p>' +
    '<p style="margin:0;font-size:15px;line-height:23px;font-weight:bold;color:#244d36;overflow-wrap:anywhere;word-break:break-word;">' + escape(reference) + '</p></td></tr></table>' +
    '<p style="margin:26px 0 6px;font-size:14px;line-height:23px;">Thank you,</p>' +
    '<p style="margin:0 0 24px;font-size:14px;line-height:23px;"><strong>Office of the President</strong><br>J.H. Cerilles State College</p></td></tr>' +
    '<tr><td style="padding:18px 28px;border-top:1px solid #e5ebe6;background-color:#fafbf9;border-radius:0 0 12px 12px;">' +
    '<p style="margin:0;color:#65756b;font-size:12px;line-height:20px;">' + (forward ? 'The original email, including its attachments, is enclosed as forwarded-email.eml.' : 'For questions about this correspondence, reply to this email and include your reference number.') + '</p></td></tr>' +
    '</table></td></tr></table></body></html>';
}

function sendEmailRemarksReply(request, reference) {
  const match = /^https:\/\/mail\.google\.com\/mail\/u\/\d+\/#(?:all|inbox)\/([a-zA-Z0-9_-]+)$/.exec(request.link);
  if (!match) throw new Error('This email has no valid Gmail conversation link.');
  const anchor = Gmail.Users.Messages.get('me', match[1], { format: 'minimal' });
  const thread = Gmail.Users.Threads.get('me', anchor.threadId, { format: 'full' });
  const incoming = (thread.messages || []).filter(message => !(message.labelIds || []).some(label => ['DRAFT', 'SPAM', 'TRASH', 'SENT'].includes(label)))
    .sort((a, b) => Number(b.internalDate || 0) - Number(a.internalDate || 0));
  if (!incoming.length) throw new Error('No incoming message is available for the automatic reply.');
  const props = PropertiesService.getScriptProperties();
  const key = 'email-remark:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, request.link));
  const previous = JSON.parse(props.getProperty(key) || 'null');
  if (previous && previous.remarks !== request.remarks) throw new Error('Finish the previous remarks update before choosing another remark.');
  const pending = previous || { remarks: request.remarks, requestId: Utilities.getUuid(), messageId: incoming[0].id };
  props.setProperty(key, JSON.stringify(pending));
  const result = replyToRegisteredThread({ token: request.token, link: request.link, requestId: pending.requestId, messageId: pending.messageId, message: emailRemarksMessage(request.remarks, reference) }, thread, true, emailRemarksHtml(request.remarks, reference));
  // The caller clears this state only after the sheet update is persisted.
  return { result: result, key: key };
}

// Background formatting survives mailbox sync without changing thread metadata.
function deleteRegisteredEmail(request) {
  if (!getDocumentSession(request.token)) return jsonResponse({ success: false, message: 'Your session expired. Please sign in again.' });
  const match = typeof request.link === 'string' && /^https:\/\/mail\.google\.com\/mail\/u\/\d+\/#(?:all|inbox)\/([a-zA-Z0-9_-]+)$/.exec(request.link);
  if (!match) return jsonResponse({ success: false, message: 'Choose a registered email.' });
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = appSpreadsheet().getSheetByName('Email');
    if (!sheet || sheet.getLastRow() < 2) throw new Error('Email record was not found.');
    const range = sheet.getRange(2, 7, sheet.getLastRow() - 1, 1);
    const values = range.getDisplayValues(), rich = range.getRichTextValues();
    const rows = values.map((row, index) => {
      const cell = rich[index][0];
      const url = (cell && cell.getLinkUrl()) || (cell && cell.getRuns().map(run => run.getLinkUrl()).find(Boolean)) || row[0];
      return url === request.link ? index + 2 : 0;
    }).filter(Boolean);
    if (rows.length !== 1) throw new Error('Email record could not be uniquely identified.');
    const anchor = Gmail.Users.Messages.get('me', match[1], { format: 'minimal' });
    // Trash first: a Gmail failure must preserve the register so deletion can be retried.
    const trashed = Gmail.Users.Threads.trash('me', anchor.threadId);
    if (!trashed || trashed.id !== anchor.threadId) throw new Error('Gmail did not confirm moving this conversation to Trash.');
    sheet.deleteRow(rows[0]);
    SpreadsheetApp.flush();
    return jsonResponse({ success: true, deletedLink: request.link, trashed: true });
  } catch (error) { return jsonResponse({ success: false, message: error.message }); }
  finally { lock.releaseLock(); }
}

function updateEmailRowColor(request) {
  if (!getDocumentSession(request.token)) return jsonResponse({ success: false, message: 'Your session expired. Please sign in again.' });
  const colors = ['', '#f4cccc', '#fff2cc', '#e2f0d9'];
  if (!colors.includes(request.color) || typeof request.link !== 'string' || !request.link) return jsonResponse({ success: false, message: 'Choose a valid row color.' });
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = appSpreadsheet().getSheetByName('Email');
    if (!sheet || sheet.getLastRow() < 2) throw new Error('Email record was not found.');
    const links = sheet.getRange(2, 7, sheet.getLastRow() - 1, 1);
    const values = links.getDisplayValues();
    const rich = links.getRichTextValues();
    const matches = values.map((row, index) => {
      const cell = rich[index][0];
      const url = (cell && cell.getLinkUrl()) || (cell && cell.getRuns().map(run => run.getLinkUrl()).find(Boolean)) || row[0];
      return url === request.link ? index + 2 : 0;
    }).filter(Boolean);
    if (matches.length !== 1) throw new Error('Email record could not be uniquely identified.');
    sheet.getRange(matches[0], 1, 1, 7).setBackground(request.color || null);
    SpreadsheetApp.flush();
    return jsonResponse({ success: true, rowColor: request.color });
  } catch (error) { return jsonResponse({ success: false, message: error.message }); }
  finally { lock.releaseLock(); }
}

function updateEmailRemarks(request) {
  if (!getDocumentSession(request.token)) return jsonResponse({ success: false, message: 'Your session expired. Please sign in again.' });
  if (!EMAIL_REMARKS.includes(request.remarks) || typeof request.link !== 'string' || !request.link) return jsonResponse({ success: false, message: 'Choose valid email remarks.' });
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = appSpreadsheet().getSheetByName('Email');
    if (!sheet || sheet.getLastRow() < 2) throw new Error('Email record was not found.');
    const links = sheet.getRange(2, 7, sheet.getLastRow() - 1, 1);
    const values = links.getDisplayValues();
    const rich = links.getRichTextValues();
    const matches = values.map((row, index) => {
      const cell = rich[index][0];
      const url = (cell && cell.getLinkUrl()) || (cell && cell.getRuns().map(run => run.getLinkUrl()).find(Boolean)) || row[0];
      return url === request.link ? index + 2 : 0;
    }).filter(Boolean);
    if (matches.length !== 1) throw new Error('Email record could not be uniquely identified.');
    const cell = sheet.getRange(matches[0], 6);
    if (cell.getDisplayValue() === request.remarks) return jsonResponse({ success: true, remarks: request.remarks, emailSent: false });
    const reference = sheet.getRange(matches[0], 2).getDisplayValue();
    const notification = emailRemarksMessage(request.remarks, reference) ? sendEmailRemarksReply(request, reference) : null;
    cell.setValue(request.remarks);
    SpreadsheetApp.flush();
    if (notification) PropertiesService.getScriptProperties().deleteProperty(notification.key);
    return jsonResponse({ success: true, remarks: request.remarks, emailSent: !!notification });
  } catch (error) { return jsonResponse({ success: false, message: error.message }); }
  finally { lock.releaseLock(); }
}

// Run once as the mailbox owner to enable unattended imports.
function enableAutomaticEmailSync() {
  setupEmailSheet();
  // Request Gmail access before installing the background trigger.
  Gmail.Users.getProfile('me');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const triggers = ScriptApp.getProjectTriggers().filter(trigger => trigger.getHandlerFunction() === 'syncEmailSheet');
    ScriptApp.newTrigger('syncEmailSheet').timeBased().everyMinutes(5).create();
    // Replace the old schedule only after the new trigger is installed.
    triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  } finally { lock.releaseLock(); }
  console.log('Automatic email import enabled every 5 minutes for this mailbox.');
  syncEmailSheet();
}

function setupEmailSheet() {
  const spreadsheet = appSpreadsheet();
  const sheet = spreadsheet.getSheetByName('Email') || spreadsheet.insertSheet('Email');
  const existing = sheet.getRange(1, 1, 1, 7).getDisplayValues()[0];
  if (existing.some((value, index) => value && value !== EMAIL_SHEET_HEADERS[index])) {
    throw new Error('Email headers differ from the expected layout. Check A1:G1 before setup.');
  }
  sheet.getRange(1, 1, 1, 7).setValues([EMAIL_SHEET_HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

// Imports received messages from the fixed start date onward, including archived mail.
// Each conversation keeps its original row; Links notes track incoming replies.
// New rows receive a reference and Incoming remarks; existing rows stay intact.
function syncEmailSheet() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = setupEmailSheet();
    const labelName = 'JHCSC_OPDOCS';
    const labels = Gmail.Users.Labels.list('me').labels || [];
    const label = labels.find(item => item.name === labelName) || Gmail.Users.Labels.create({ name: labelName, labelListVisibility: 'labelShow', messageListVisibility: 'show' }, 'me');
    const known = new Set(sheet.getLastRow() > 1
      ? sheet.getRange(2, 7, sheet.getLastRow() - 1, 1).getValues().map(row => String(row[0])) : []);
    const linkRows = sheet.getLastRow() > 1 ? sheet.getRange(2, 7, sheet.getLastRow() - 1, 1) : null;
    const linkNotes = linkRows && typeof linkRows.getNotes === 'function' ? linkRows.getNotes() : [];
    const linkValues = linkRows ? linkRows.getValues() : [];
    const threadRows = new Map();
    linkNotes.forEach((note, index) => {
      try { const metadata = JSON.parse(note[0] || '{}'); if (metadata.threadId) threadRows.set(metadata.threadId, index + 2); } catch (error) { /* Legacy note. */ }
    });
    const today = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd');
    const references = new Set(sheet.getLastRow() > 1
      ? sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().map(row => String(row[0])) : []);
    function nextReference() {
      let reference;
      do { reference = 'JHCSC-' + today.replace(/-/g, '') + '-' + Math.floor(100000 + Math.random() * 900000); }
      while (references.has(reference));
      references.add(reference);
      return reference;
    }
    const startMillis = new Date(EMAIL_IMPORT_START_DATE + 'T00:00:00+08:00').getTime();
    const query = 'in:anywhere -in:sent -in:drafts -in:spam -in:trash -label:' + labelName + ' after:' + (startMillis / 1000 - 1);
    const threads = new Map();
    const subjectKey = value => String(value || '').replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/i, '').trim().toLowerCase();
    const messageHeader = (message, name) => (((message.payload || {}).headers || []).find(value => value.name.toLowerCase() === name.toLowerCase()) || {}).value || '';
    const properties = PropertiesService.getScriptProperties();
    properties.deleteProperty('EMAIL_REGISTER_PAGE_TOKEN');
    properties.deleteProperty('EMAIL_REGISTER_SCAN_DATE');
    // One small page per execution leaves quota available for document sending.
    for (let page = 0; page < 1; page++) {
      const options = { q: query, maxResults: 25 };
      const result = Gmail.Users.Messages.list('me', options);
      const rows = [];
      const labelIds = new Set();
      const pendingNotes = new Map();
      try {
      (result.messages || []).forEach(item => {
        const url = 'https://mail.google.com/mail/u/0/#all/' + item.id;
        if (known.has(url) && !item.threadId) { labelIds.add(item.id); return; }
        let message = Gmail.Users.Messages.get('me', item.id, { format: 'metadata', metadataHeaders: ['From', 'Subject'] });
        if (Number(message.internalDate) < startMillis) return;
        let threadMetadata;
        if (message.threadId) {
          if (!threads.has(message.threadId)) {
            threads.set(message.threadId, Gmail.Users.Threads.get('me', message.threadId, { format: 'metadata', metadataHeaders: ['From', 'Subject'] }).messages || []);
          }
          const matching = threads.get(message.threadId).filter(candidate =>
            !(candidate.labelIds || []).some(label => ['SENT', 'DRAFT', 'SPAM', 'TRASH'].includes(label)) &&
            subjectKey(messageHeader(candidate, 'Subject')) === subjectKey(messageHeader(message, 'Subject'))
          ).sort((a, b) => Number(a.internalDate) - Number(b.internalDate) || String(a.id).localeCompare(String(b.id)));
          if (!matching.length) return;
          const eligible = matching.filter(candidate => Number(candidate.internalDate) >= startMillis);
          if (!eligible.length) return;
          const latest = matching[matching.length - 1];
          threadMetadata = { threadId: message.threadId, latestMessageId: latest.id,
            latestReceivedAt: new Date(Number(latest.internalDate)).toISOString(),
            latestSender: messageHeader(latest, 'From'), replyCount: Math.max(0, matching.length - 1) };
          const existingRow = threadRows.get(message.threadId) || linkValues.findIndex(row => matching.some(candidate => String(row[0]) === 'https://mail.google.com/mail/u/0/#all/' + candidate.id)) + 2;
          if (existingRow >= 2) {
            pendingNotes.set(existingRow, threadMetadata);
            threadRows.set(message.threadId, existingRow);
            eligible.forEach(candidate => labelIds.add(candidate.id));
            return;
          }
          message = eligible[0];
          if (!message) return;
          eligible.forEach(candidate => labelIds.add(candidate.id));
        }
        const firstUrl = 'https://mail.google.com/mail/u/0/#all/' + (message.id || item.id);
        if (known.has(firstUrl)) return;
        const headers = (message.payload && message.payload.headers) || [];
        const header = name => (headers.find(value => value.name.toLowerCase() === name.toLowerCase()) || {}).value || '';
        // A leading apostrophe prevents email text being interpreted as a Sheets formula.
        const text = value => /^[=+\-@]/.test(value) ? "'" + value : value;
        rows.push([new Date(), nextReference(), new Date(Number(message.internalDate)), text(header('From')), text(header('Subject')), 'Incoming', firstUrl]);
        if (threadMetadata) {
          const newRow = sheet.getLastRow() + rows.length;
          pendingNotes.set(newRow, threadMetadata);
          threadRows.set(threadMetadata.threadId, newRow);
        }
        known.add(firstUrl);
        labelIds.add(message.id || item.id);
      });
      } finally {
      // Preserve completed reads even if a later Gmail request hits its quota.
      // Unlabeled messages remain eligible on failure; retries skip saved URLs.
      if (rows.length) {
        const first = sheet.getLastRow() + 1;
        sheet.getRange(first, 1, rows.length, 7).setValues(rows);
        sheet.getRange(first, 1, rows.length, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
        sheet.getRange(first, 3, rows.length, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
        SpreadsheetApp.flush();
      }
      pendingNotes.forEach((metadata, row) => {
        // Keep the visible received date aligned with the newest incoming reply.
        sheet.getRange(row, 3).setValue(new Date(metadata.latestReceivedAt));
        sheet.getRange(row, 3).setNumberFormat('yyyy-mm-dd hh:mm:ss');
        sheet.getRange(row, 7).setNote(JSON.stringify(metadata));
      });
      if (pendingNotes.size) SpreadsheetApp.flush();
      // Label only after the sheet write succeeds. A failed label request keeps
      // this page for retry; saved links prevent another row being imported.
      const savedIds = [...labelIds];
      for (let offset = 0; offset < savedIds.length; offset += 1000) {
        Gmail.Users.Messages.batchModify({ ids: savedIds.slice(offset, offset + 1000), addLabelIds: [label.id] }, 'me');
      }
      }
      // Always start at the first remaining batch: labeling shrinks this query.
      // A page token would skip messages as earlier results disappear.
      console.log('Email import saved ' + rows.length + ' conversations. Remaining unlabeled mail will be checked automatically on the next run.');
    }
  } finally { lock.releaseLock(); }
}

// Read the register only; visiting the page never imports Gmail or modifies cells.
function decodeGmailBytes(data) {
  // Advanced services can expose byte fields as already-decoded byte arrays.
  // String(array) produces comma-separated numbers, which are not base64.
  let bytes;
  if (data != null && typeof data !== 'string' && typeof data.length === 'number') {
    bytes = Array.from(data);
    if (bytes.some(value => !Number.isInteger(value) || value < -128 || value > 255)) throw new Error('Invalid email body bytes.');
    bytes = bytes.map(value => value > 127 ? value - 256 : value);
  } else if (typeof data === 'string') {
    const encoded = data.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
    if (!/^[A-Za-z0-9+/]*$/.test(encoded) || encoded.length % 4 === 1) throw new Error('Invalid email body encoding.');
    const padded = encoded + '='.repeat((4 - encoded.length % 4) % 4);
    bytes = Utilities.base64Decode(padded);
  } else throw new Error('Unsupported email body format.');
  return bytes;
}

function decodeGmailBody(data, charset) {
  const blob = Utilities.newBlob(decodeGmailBytes(data));
  try { return blob.getDataAsString(charset || 'UTF-8'); }
  catch (error) { return blob.getDataAsString('UTF-8'); }
}

function getEmailThread(request) {
  if (!getDocumentSession(request.token)) return jsonResponse({ success: false, message: 'Your session expired. Please sign in again.' });
  try {
    // Resolve only a saved register link; client-supplied Gmail IDs grant no access.
    const sheet = appSpreadsheet().getSheetByName('Email');
    if (!sheet || sheet.getLastRow() < 2 || typeof request.link !== 'string') throw new Error('Email record was not found.');
    const range = sheet.getRange(2, 7, sheet.getLastRow() - 1, 1);
    const values = range.getDisplayValues(), rich = range.getRichTextValues();
    const matches = values.filter((row, index) => {
      const cell = rich[index][0];
      const link = (cell && cell.getLinkUrl()) || (cell && cell.getRuns().map(run => run.getLinkUrl()).find(Boolean)) || row[0];
      return link === request.link;
    });
    const match = /^https:\/\/mail\.google\.com\/mail\/u\/\d+\/#(?:all|inbox)\/([a-zA-Z0-9_-]+)$/.exec(request.link);
    if (matches.length !== 1 || !match) throw new Error('Email record could not be uniquely identified.');
    const anchor = Gmail.Users.Messages.get('me', match[1], { format: 'minimal' });
    const thread = Gmail.Users.Threads.get('me', anchor.threadId, { format: 'full' });
    if (request.action === 'replyEmail') return replyToRegisteredThread(request, thread);
    if (request.action === 'forwardEmail') return forwardRegisteredEmail(request, thread);
    if (request.action === 'emailAttachment') {
      if (typeof request.messageId !== 'string' || typeof request.partId !== 'string') throw new Error('Choose a valid attachment.');
      const message = (thread.messages || []).find(item => item.id === request.messageId && !(item.labelIds || []).some(label => ['DRAFT', 'SPAM', 'TRASH'].includes(label)));
      let attachment;
      function findAttachment(part) {
        if (part.filename && part.partId === request.partId) attachment = part;
        (part.parts || []).forEach(findAttachment);
      }
      if (message) findAttachment(message.payload || {});
      if (!attachment) throw new Error('Attachment was not found in this conversation.');
      if ((attachment.body || {}).size > 20 * 1024 * 1024) throw new Error('This attachment exceeds the 20 MB preview limit.');
      const body = attachment.body || {};
      const data = body.attachmentId ? Gmail.Users.Messages.Attachments.get('me', message.id, body.attachmentId).data : body.data;
      if (data == null) throw new Error('The attachment content is unavailable.');
      const encoded = typeof data === 'string' ? data.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '') : '';
      const bytes = typeof data === 'string' ? Utilities.base64Decode(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')) : Array.from(data).map(value => value > 127 ? value - 256 : value);
      if (bytes.length > 20 * 1024 * 1024) throw new Error('This attachment exceeds the 20 MB preview limit.');
      return jsonResponse({ success: true, name: attachment.filename, mimeType: attachment.mimeType || 'application/octet-stream', data: Utilities.base64Encode(bytes) });
    }
    const messages = (thread.messages || []).filter(message => !(message.labelIds || []).some(label => ['DRAFT', 'SPAM', 'TRASH'].includes(label)))
      .sort((a, b) => Number(a.internalDate) - Number(b.internalDate)).map(message => {
        const header = name => (((message.payload || {}).headers || []).find(item => item.name.toLowerCase() === name.toLowerCase()) || {}).value || '';
        const bodies = { html: '', text: '' }, attachments = [], inlineParts = [];
        function visit(part) {
          const contentId = ((part.headers || []).find(item => item.name.toLowerCase() === 'content-id') || {}).value || '';
          if (contentId && /^image\/(png|jpeg|gif|webp)$/i.test(part.mimeType || '')) inlineParts.push({ id: contentId.trim().replace(/^<|>$/g, ''), part: part });
          if (part.filename) attachments.push({ name: part.filename, partId: part.partId, mimeType: part.mimeType, size: (part.body || {}).size || 0 });
          else if (['text/html', 'text/plain'].includes(part.mimeType)) {
            let data = (part.body || {}).data;
            if (!data && part.body && part.body.attachmentId) data = Gmail.Users.Messages.Attachments.get('me', message.id, part.body.attachmentId).data;
            if (data) {
              const contentType = ((part.headers || []).find(item => item.name.toLowerCase() === 'content-type') || {}).value || '';
              const charset = /charset=["']?([^;\s"']+)/i.exec(contentType);
              const content = decodeGmailBody(data, charset ? charset[1] : 'UTF-8');
              bodies[part.mimeType === 'text/html' ? 'html' : 'text'] += content;
            }
          }
          (part.parts || []).forEach(visit);
        }
        visit(message.payload || {});
        // Browsers cannot resolve MIME cid: URLs. Resolve only referenced raster
        // images from this authenticated message; external images stay opt-in.
        let inlineBytes = 0;
        const inlineSources = Object.create(null);
        inlineParts.forEach(item => {
          try {
          const imageBody = item.part.body || {};
          if (!bodies.html.includes('cid:' + item.id) || imageBody.size > 2 * 1024 * 1024 || inlineBytes + (imageBody.size || 0) > 5 * 1024 * 1024) return;
          let data = imageBody.data;
          if (!data && imageBody.attachmentId) data = Gmail.Users.Messages.Attachments.get('me', message.id, imageBody.attachmentId).data;
          if (!data) return;
          const bytes = decodeGmailBytes(data);
          if (bytes.length > 2 * 1024 * 1024 || inlineBytes + bytes.length > 5 * 1024 * 1024) return;
          inlineBytes += bytes.length;
          inlineSources[item.id] = 'data:' + item.part.mimeType.toLowerCase() + ';base64,' + Utilities.base64Encode(bytes);
          } catch (error) { /* An unavailable inline image must not hide the conversation. */ }
        });
        bodies.html = bodies.html.replace(/\bcid:([^\s"'<>]+)/gi, (source, id) => inlineSources[id] || source);
        return { id: message.id, canReply: !(message.labelIds || []).includes('SENT'), replyTo: header('Reply-To') || header('From'), from: header('From'), to: header('To'), cc: header('Cc'), subject: header('Subject'), date: new Date(Number(message.internalDate)).toISOString(), ...bodies, attachments };
      });
    const incoming = messages.filter(message => !(thread.messages.find(item => item.id === message.id).labelIds || []).includes('SENT'));
    // Mark only the messages loaded here; a reply arriving afterward stays unread.
    if (request.action === 'emailThread') {
      const unreadIds = messages.filter(message => (thread.messages.find(item => item.id === message.id).labelIds || []).includes('UNREAD')).map(message => message.id);
      if (unreadIds.length) Gmail.Users.Messages.batchModify({ ids: unreadIds, removeLabelIds: ['UNREAD'] }, 'me');
    }
    return jsonResponse({ success: true, messages: messages, latestMessageId: incoming.length ? incoming[incoming.length - 1].id : '' });
  } catch (error) { return jsonResponse({ success: false, message: 'Unable to load the conversation. ' + error.message }); }
}

function getEmailRegister(request) {
  if (!getDocumentSession(request.token)) return jsonResponse({ success: false, message: 'Your session expired. Please sign in again.' });
  const sheet = appSpreadsheet().getSheetByName('Email');
  if (!sheet) return jsonResponse({ success: false, message: 'The Email sheet is missing.' });
  if (sheet.getLastRow() < 2) return jsonResponse({ success: true, emails: [] });
  const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7);
  const rows = range.getDisplayValues();
  const richText = range.getRichTextValues();
  const backgrounds = typeof range.getBackgrounds === 'function' ? range.getBackgrounds() : [];
  const notes = typeof range.getNotes === 'function' ? range.getNotes() : [];
  const emails = rows.map((row, index) => {
    const cell = richText[index][6];
    const runs = cell ? cell.getRuns() : [];
    const link = (cell && cell.getLinkUrl()) || runs.map(run => run.getLinkUrl()).find(Boolean) || row[6];
    let thread = {};
    try { thread = JSON.parse(notes[index]?.[6] || '{}') || {}; } catch (error) { /* Legacy note. */ }
    const background = backgrounds[index]?.[0];
    const rowColor = ['#f4cccc', '#fff2cc', '#e2f0d9'].includes(background) ? background : '';
    return { rowColor: rowColor, threadId: thread.threadId || '', latestMessageId: thread.latestMessageId || '', latestReceivedAt: thread.latestReceivedAt || '', latestSender: thread.latestSender || '', replyCount: thread.replyCount || 0, timestamp: row[0], reference: row[1], dateReceived: row[2], receivedFrom: row[3], subject: row[4], remarks: row[5], link: /^https?:\/\//i.test(link) ? link : '' };
  }).filter(email => email.timestamp || email.reference || email.dateReceived || email.receivedFrom || email.subject || email.remarks || email.link);
  return jsonResponse({ success: true, emails: emails.reverse() });
}

// Reply targets and threading headers come only from the registered conversation.
function forwardedEmailBase64(raw) {
  // Advanced Gmail may deserialize its bytes field before returning it.
  if (Array.isArray(raw)) {
    if (!raw.length || raw.length > 20 * 1024 * 1024 || raw.some(byte => !Number.isInteger(byte) || byte < -128 || byte > 255)) throw new Error('The original email is unavailable or too large to forward here.');
    return Utilities.base64Encode(raw);
  }
  if (typeof raw !== 'string' || !raw.length || raw.length > Math.ceil(20 * 1024 * 1024 / 3) * 4) throw new Error('The original email is unavailable or too large to forward here.');
  const base64 = raw.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (!/^[A-Za-z0-9+/]+$/.test(base64) || base64.length % 4 === 1) throw new Error('The original email could not be decoded.');
  return base64 + '='.repeat((4 - base64.length % 4) % 4);
}

// Called under the forward lock; updating remarks must not send another reply.
function forwardedEmailRemarksCell(link) {
  const sheet = appSpreadsheet().getSheetByName('Email');
  if (!sheet || sheet.getLastRow() < 2) throw new Error('Email record was not found.');
  const links = sheet.getRange(2, 7, sheet.getLastRow() - 1, 1);
  const values = links.getDisplayValues(), rich = links.getRichTextValues();
  const matches = values.map((row, index) => {
    const cell = rich[index][0];
    const url = (cell && cell.getLinkUrl()) || (cell && cell.getRuns().map(run => run.getLinkUrl()).find(Boolean)) || row[0];
    return url === link ? index + 2 : 0;
  }).filter(Boolean);
  if (matches.length !== 1) throw new Error('Email record could not be uniquely identified.');
  return sheet.getRange(matches[0], 6);
}

function forwardRegisteredEmail(request, thread) {
  const user = sessionAccount(request.token);
  const target = (thread.messages || []).find(message => message.id === request.messageId && !(message.labelIds || []).some(label => ['DRAFT', 'SPAM', 'TRASH'].includes(label)));
  if (!target) throw new Error('Choose a message from this conversation.');
  const recipients = emailAddresses(request.to, true);
  if (recipients.some(address => /[<>\r\n]/.test(address))) throw new Error('Enter plain email addresses.');
  const header = name => (((target.payload || {}).headers || []).find(item => item.name.toLowerCase() === name.toLowerCase()) || {}).value || '';
  const subject = header('Subject').replace(/[\r\n]/g, ' ');
  const messageId = header('Message-ID');
  if (!/^<[^<>\s]+>$/.test(messageId)) throw new Error('This email has no valid threading header. Open it in Gmail to forward.');
  const references = (header('References').match(/<[^<>\s]+>/g) || []).slice(-15).concat(messageId).join(' ');
  const body = String(request.message || '').trim();
  if (!body || body.length > 20000) throw new Error('Enter a body up to 20,000 characters.');
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(String(request.requestId || ''))) throw new Error('Invalid forward request.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'email-forward:' + request.requestId;
    const fingerprint = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify([user.email, request.link, target.id, recipients, subject, body])));
    const previous = JSON.parse(props.getProperty(key) || 'null');
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new Error('This forward attempt used different content. Close and reopen Forward to start a new send.');
      if (previous.state === 'sent') {
        if (!previous.remarksComplete) {
          forwardedEmailRemarksCell(request.link).setValue('Forwarded');
          SpreadsheetApp.flush();
          props.setProperty(key, JSON.stringify({ ...previous, remarksComplete: true }));
        }
        return jsonResponse({ success: true, remarks: 'Forwarded' });
      }
      throw new Error('Delivery is uncertain. Check Gmail Sent before starting another forward.');
    }
    const remarksCell = forwardedEmailRemarksCell(request.link);
    const original = Gmail.Users.Messages.get('me', target.id, { format: 'raw' });
    const padded = forwardedEmailBase64(original.raw);
    const encode = value => Utilities.base64Encode(Utilities.newBlob(value).getBytes());
    const wrap = value => (value.match(/.{1,76}/g) || []).join('\r\n');
    const boundary = 'op_forward_' + Utilities.getUuid();
    const sender = emailAddresses(Gmail.Users.getProfile('me').emailAddress, true).join(', ');
    const raw = ['From: ' + sender, 'To: ' + recipients.join(', '), 'Subject: =?UTF-8?B?' + encode(subject) + '?=',
      'In-Reply-To: ' + messageId, 'References: ' + references,
      'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary="' + boundary + '"', '',
      '--' + boundary, 'Content-Type: multipart/alternative; boundary="' + boundary + '_alt"', '',
      '--' + boundary + '_alt', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(encode(body)),
      '--' + boundary + '_alt', 'Content-Type: multipart/related; boundary="' + boundary + '_related"', '',
      '--' + boundary + '_related', 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(encode(emailRemarksHtml('Incoming', subject, { message: body }))),
      '--' + boundary + '_related', 'Content-Type: image/png', 'Content-ID: <jhcsc-email-logo>', 'Content-Disposition: inline; filename="jhcsc-logo.png"', 'Content-Transfer-Encoding: base64', '', wrap(EMAIL_JHCSC_LOGO_PNG),
      '--' + boundary + '_related--', '--' + boundary + '_alt--',
      '--' + boundary, 'Content-Type: application/octet-stream; name="forwarded-email.eml"',
      'Content-Disposition: attachment; filename="forwarded-email.eml"', 'Content-Transfer-Encoding: base64', '', wrap(padded), '--' + boundary + '--', ''].join('\r\n');
    props.setProperty(key, JSON.stringify({ state: 'pending', fingerprint: fingerprint }));
    const sent = Gmail.Users.Messages.send({ threadId: thread.id || target.threadId, raw: Utilities.base64EncodeWebSafe(Utilities.newBlob(raw).getBytes()) }, 'me');
    if (!sent || !sent.id) throw new Error('Delivery is uncertain. Check Gmail Sent before starting another forward.');
    props.setProperty(key, JSON.stringify({ state: 'sent', fingerprint: fingerprint }));
    remarksCell.setValue('Forwarded');
    SpreadsheetApp.flush();
    props.setProperty(key, JSON.stringify({ state: 'sent', fingerprint: fingerprint, remarksComplete: true }));
    return jsonResponse({ success: true, remarks: 'Forwarded' });
  } finally { lock.releaseLock(); }
}

function replyToRegisteredThread(request, thread, lockHeld, templateHtml) {
  const user = sessionAccount(request.token);
  const attachments = validateReplyAttachments(request.attachments);
  const rich = request.bodyRich ? validateRichBody(request.bodyRich) : null;
  const body = rich ? richBodyPlainText(rich).trim() : String(request.message || '').trim();
  if (!body || body.length > 20000) throw new Error('Enter a reply up to 20,000 characters.');
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(String(request.requestId || ''))) throw new Error('Invalid reply request.');
  const target = (thread.messages || []).find(message => message.id === request.messageId && !(message.labelIds || []).some(label => ['DRAFT', 'SPAM', 'TRASH', 'SENT'].includes(label)));
  if (!target) throw new Error('Choose an incoming message from this conversation.');
  const header = name => (((target.payload || {}).headers || []).find(item => item.name.toLowerCase() === name.toLowerCase()) || {}).value || '';
  // Parse the normal display-name address form without trusting client recipients.
  const recipient = /<([^<>]+)>/.exec(header('Reply-To') || header('From'));
  const to = recipient ? emailAddresses(recipient[1], true) : emailAddresses(header('Reply-To') || header('From'), true);
  const messageId = header('Message-ID');
  if (!/^<[^<>\s]+>$/.test(messageId)) throw new Error('This email has no valid reply header. Open it in Gmail to reply.');
  const subject = header('Subject').replace(/[\r\n]/g, ' ');
  const lock = LockService.getScriptLock();
  if (!lockHeld) lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'email-reply:' + request.requestId;
    const fingerprint = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify([request.link, target.id, body, user.email, rich, attachments])));
    const previous = JSON.parse(props.getProperty(key) || 'null');
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new Error('This reply attempt used different content.');
      if (previous.state === 'sent') return jsonResponse({ success: true });
      throw new Error('Delivery is uncertain. Check Gmail Sent before sending another reply.');
    }
    const sender = Gmail.Users.getProfile('me').emailAddress;
    const encodedSubject = Utilities.base64Encode(Utilities.newBlob(/^re:/i.test(subject) ? subject : 'Re: ' + subject).getBytes());
    const references = (header('References').match(/<[^<>\s]+>/g) || []).slice(-15).concat(messageId).join(' ');
    let raw = ['From: ' + emailAddresses(sender, true).join(', '), 'To: ' + to.join(', '),
      'Subject: =?UTF-8?B?' + encodedSubject + '?=', 'In-Reply-To: ' + messageId, 'References: ' + references,
      'MIME-Version: 1.0', 'Content-Type: ' + (rich ? 'text/html' : 'text/plain') + '; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
      (Utilities.base64Encode(Utilities.newBlob(rich ? replyRichHtml(rich) : body).getBytes()).match(/.{1,76}/g) || []).join('\r\n')].join('\r\n');
    if (templateHtml) {
      const alternative = 'op_status_' + Utilities.getUuid();
      const split = raw.indexOf('MIME-Version: 1.0');
      const encodePart = value => (Utilities.base64Encode(Utilities.newBlob(value).getBytes()).match(/.{1,76}/g) || []).join('\r\n');
      raw = raw.slice(0, split) + ['MIME-Version: 1.0', 'Content-Type: multipart/alternative; boundary="' + alternative + '"', '',
        '--' + alternative, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', encodePart(body),
        '--' + alternative, 'Content-Type: multipart/related; boundary="' + alternative + '_images"', '',
        '--' + alternative + '_images', 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', encodePart(templateHtml),
        '--' + alternative + '_images', 'Content-Type: image/png', 'Content-ID: <jhcsc-email-logo>', 'Content-Disposition: inline; filename="jhcsc-logo.png"',
        'Content-Transfer-Encoding: base64', '', (EMAIL_JHCSC_LOGO_PNG.match(/.{1,76}/g) || []).join('\r\n'),
        '--' + alternative + '_images--', '--' + alternative + '--', ''].join('\r\n');
    }
    if (attachments.length) {
      const boundary = 'op_reply_' + Utilities.getUuid();
      const split = raw.indexOf('MIME-Version: 1.0');
      const content = raw.slice(split + 'MIME-Version: 1.0\r\n'.length);
      raw = raw.slice(0, split) + 'MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="' + boundary + '"\r\n\r\n--' + boundary + '\r\n' + content;
      attachments.forEach(file => {
        const fallback = file.name.replace(/[^\x20-\x7e]|["\\]/g, '_');
        raw += '\r\n--' + boundary + '\r\nContent-Type: ' + file.mimeType + '\r\nContent-Disposition: attachment; filename="' + fallback + '"; filename*=UTF-8\'\'' + encodeURIComponent(file.name).replace(/['()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase()) + '\r\nContent-Transfer-Encoding: base64\r\n\r\n' + (file.data.match(/.{1,76}/g) || []).join('\r\n');
      });
      raw += '\r\n--' + boundary + '--\r\n';
    }
    props.setProperty(key, JSON.stringify({ state: 'pending', fingerprint: fingerprint }));
    const sent = Gmail.Users.Messages.send({ threadId: thread.id || target.threadId, raw: Utilities.base64EncodeWebSafe(Utilities.newBlob(raw).getBytes()) }, 'me');
    if (!sent || !sent.id) throw new Error('Delivery is uncertain. Check Gmail Sent before sending another reply.');
    props.setProperty(key, JSON.stringify({ state: 'sent', fingerprint: fingerprint }));
    return jsonResponse({ success: true });
  } finally { if (!lockHeld) lock.releaseLock(); }
}

// Serialize validated editor nodes; browser-provided HTML is never sent directly.
function replyRichHtml(node) {
  const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  if (node.type === 'text') {
    let text = escape(node.text);
    (node.marks || []).forEach(mark => {
      const tags = { bold: 'strong', italic: 'em', underline: 'u', strike: 's' };
      if (tags[mark.type]) text = '<' + tags[mark.type] + '>' + text + '</' + tags[mark.type] + '>';
      if (mark.type === 'textStyle') {
        const attrs = mark.attrs || {};
        const style = [attrs.color && 'color:' + attrs.color, attrs.fontFamily && 'font-family:' + attrs.fontFamily, attrs.fontSize && 'font-size:' + attrs.fontSize].filter(Boolean).join(';');
        text = '<span style="' + escape(style) + '">' + text + '</span>';
      }
    });
    return text;
  }
  if (node.type === 'hardBreak') return '<br>';
  const tags = { paragraph: 'p', bulletList: 'ul', orderedList: 'ol', listItem: 'li', blockquote: 'blockquote' };
  const content = (node.content || []).map(replyRichHtml).join('');
  if (node.type === 'doc') return content;
  const tag = tags[node.type];
  if (!tag) throw new Error('Unsupported reply formatting.');
  const attributes = node.type === 'paragraph' ? ' style="text-align:' + escape(node.attrs.textAlign) + '"' : node.type === 'orderedList' ? ' start="' + node.attrs.start + '"' : '';
  return '<' + tag + attributes + '>' + (content || '<br>') + '</' + tag + '>';
}

function validateReplyAttachments(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 10) throw new Error('Choose up to 10 attachments.');
  let total = 0;
  return value.map(file => {
    if (!file || typeof file.name !== 'string' || !file.name.trim() || file.name.length > 250 || /[\r\n\x00]/.test(file.name)) throw new Error('Invalid attachment filename.');
    if (typeof file.data !== 'string' || file.data.length > Math.ceil(20 * 1024 * 1024 / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data)) throw new Error('Invalid attachment data.');
    const bytes = Utilities.base64Decode(file.data);
    total += bytes.length;
    if (total > 20 * 1024 * 1024) throw new Error('Attachments must total 20 MB or less.');
    const mimeType = typeof file.mimeType === 'string' && /^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(file.mimeType) ? file.mimeType : 'application/octet-stream';
    return { name: file.name, mimeType: mimeType, data: file.data };
  });
}
