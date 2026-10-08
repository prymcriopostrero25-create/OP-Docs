import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { Buffer } from 'node:buffer'

function fixture() {
  let saves = 0
  const elements = []
  function paragraph(text = '') {
    const parts = []
    const p = { getType: () => 'paragraph', asParagraph: () => p, getText: () => text,
      getNumChildren: () => parts.length, getChild: i => parts[i], removeChild: part => parts.splice(parts.indexOf(part), 1),
      getParent: () => body, getIndentStart: () => 200, getSpacingBefore: () => 24,
      setIndentStart: () => p, setIndentFirstLine: () => p, setSpacingBefore: () => p, setSpacingAfter: () => p,
      appendInlineImage: () => {
        let title = ''
        const image = { getType: () => 'image', asInlineImage: () => image, getAltTitle: () => title,
          getWidth: () => 300, getHeight: () => 100, setWidth: () => image, setHeight: () => image,
          setAltTitle: value => { title = value; return image } }
        parts.push(image)
        return image
      } }
    return p
  }
  const name = paragraph('EDGARDO H. ROSALES, JD, Ed.D.')
  elements.push(name)
  const body = { getNumChildren: () => elements.length, getChild: i => elements[i],
    getChildIndex: p => elements.indexOf(p), removeChild: p => elements.splice(elements.indexOf(p), 1),
    insertParagraph: (i, text) => { const p = paragraph(text); elements.splice(i, 0, p); return p },
    findText: () => ({ getElement: () => ({ getParent: () => name }) }) }
  const ctx = vm.createContext({ DocumentApp: { ElementType: { PARAGRAPH: 'paragraph', TABLE: 'table', INLINE_IMAGE: 'image' },
    openById: () => ({ getBody: () => body, saveAndClose: () => { saves++ } }) },
    Utilities: { base64Decode: value => Buffer.from(value, 'base64'), newBlob: value => value } })
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), ctx)
  const file = { getMimeType: () => 'application/vnd.google-apps.document', getId: () => 'doc' }
  return { run: status => ctx.syncApprovalSignature(file, {}, status), elements, saves: () => saves, ctx }
}

test('approval inserts the signature above the name, retains it for Out, and withdrawal removes it', () => {
  const f = fixture()
  f.run('Draft')
  assert.equal(f.elements.length, 1)
  f.run('Approved')
  assert.equal(f.elements.length, 2)
  assert.equal(f.elements[0].getChild(0).getAltTitle(), 'op-president-approval-signature')
  f.run('Approved')
  f.run('Out')
  assert.equal(f.elements.length, 2)
  assert.equal(f.saves(), 1)
  f.run('For Review')
  assert.equal(f.elements.length, 1)
  f.run('Approved')
  assert.equal(f.elements.length, 2)
})

test('approval timestamp records approval, survives Out, and resets after withdrawal', () => {
  const { ctx } = fixture()
  const first = '2026-10-08T02:23:45.000Z'
  const later = '2026-10-09T03:00:00.000Z'
  assert.equal(ctx.approvalTimestamp('For Signature', 'Approved', '', first), first)
  assert.equal(ctx.approvalTimestamp('Approved', 'Approved', first, later), first)
  assert.equal(ctx.approvalTimestamp('Approved', 'Out', first, later), first)
  assert.equal(ctx.approvalTimestamp('Approved', 'For Review', first, later), '')
  assert.equal(ctx.approvalTimestamp('For Review', 'Approved', first, later), later)
})

test('bundled backend signature matches public/esign.png', () => {
  const f = fixture()
  const bundled = vm.runInContext('PRESIDENT_SIGNATURE_PNG', f.ctx)
  assert.deepEqual(Buffer.from(bundled, 'base64'), fs.readFileSync(new URL('../public/esign.png', import.meta.url)))
})

test('signature authorization rejects missing or incorrect passwords and removes valid credentials', () => {
  const f = fixture()
  f.ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: () => null }) }
  for (const status of ['Approved', 'Out']) {
    for (const approvalPassword of [undefined, '', 'incorrect']) {
      assert.throws(() => f.ctx.requireApprovalPassword({ action: 'updateDocumentStatus', status, approvalPassword }), /Incorrect approval password/)
    }
    const request = { action: 'createDocument', status, approvalPassword: 'JHCSC-president' }
    f.ctx.requireApprovalPassword(request)
    assert.equal('approvalPassword' in request, false)
  }
  assert.doesNotThrow(() => f.ctx.requireApprovalPassword({ action: 'updateDocumentStatus', status: 'Draft' }))
  f.ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'custom-password' }) }
  assert.throws(() => f.ctx.requireApprovalPassword({ action: 'updateDocumentStatus', status: 'Approved', approvalPassword: 'JHCSC-president' }), /Incorrect approval password/)
  assert.doesNotThrow(() => f.ctx.requireApprovalPassword({ action: 'updateDocumentStatus', status: 'Approved', approvalPassword: 'custom-password' }))
})
