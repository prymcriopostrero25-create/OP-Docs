export async function readAppsScriptResponse(response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    if (/^\s*</.test(text)) {
      throw new Error('The document service returned a webpage instead of data. Check that the Apps Script web app deployment is accessible and its /exec URL is configured, then refresh and try again.')
    }
    throw new Error('The document service returned an invalid response. Please try again.')
  }
}
