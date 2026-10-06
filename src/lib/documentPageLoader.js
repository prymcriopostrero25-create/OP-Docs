export async function loadDocumentPage(id, request, type) {
  try {
    return await request({ action: 'documentPage', id, ...(type ? { type } : {}) })
  } catch (error) {
    if (!/^Unsupported action\.?$/i.test(error.message || '')) throw error
    // Older deployments already expose saved forms to administrators.
    try {
      const result = await request({ action: 'documentDetails', id })
      if (result.form) return { form: result.form, type: result.form.type }
    } catch {
      // The registered PDF remains available to authorized viewers.
    }
    return { form: null, deploymentRequired: true }
  }
}
