// Stop on failure so a later file never starts before the current one succeeds.
export async function uploadSequentially(items, upload) {
  for (const item of items) {
    if (item.status === 'complete') continue
    await upload(item)
  }
}
