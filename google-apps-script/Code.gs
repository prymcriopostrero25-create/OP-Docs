function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents || '{}');

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

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CREDENTIALS');

    if (!sheet) {
      return jsonResponse({ success: false, message: 'CREDENTIALS sheet was not found.' });
    }

    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      return jsonResponse({ success: false, message: 'No user accounts are configured.' });
    }

    // CREDENTIALS columns: A blank, B EMAIL, C NAME, D PASSWORD, E ROLE.
    const accounts = sheet.getRange(2, 2, lastRow - 1, 4).getDisplayValues();
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
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let logsSheet = spreadsheet.getSheetByName('USER LOGS');

  if (!logsSheet) {
    logsSheet = spreadsheet.insertSheet('USER LOGS');
    logsSheet.getRange(1, 1, 1, 2).setValues([['TIMESTAMP', 'MESSAGE']]);
  }

  logsSheet.appendRow([new Date(), `${userName} logged in`]);
  logsSheet.getRange(logsSheet.getLastRow(), 1).setNumberFormat('m/d/yyyy h:mma');
}

function getUserLogs() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('USER LOGS');

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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CREDENTIALS');

  if (!sheet || sheet.getLastRow() < 2) {
    return jsonResponse({ success: true, users: [] });
  }

  // CREDENTIALS columns: A blank, B EMAIL, C NAME, D PASSWORD, E ROLE.
  const rows = sheet.getRange(2, 2, sheet.getLastRow() - 1, 4).getDisplayValues();
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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CREDENTIALS');
  if (!sheet || sheet.getLastRow() < 2) return false;
  const account = sheet.getRange(2, 2, sheet.getLastRow() - 1, 4).getDisplayValues()
    .find((row) => String(row[0]).trim().toLowerCase() === email);
  return !!account && normalizeRole(account[3]) === 'super admin';
}
