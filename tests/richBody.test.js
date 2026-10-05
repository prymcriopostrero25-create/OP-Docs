import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { plainBodyDocument, richBodyText, safeBodyLink } from '../src/lib/richBody.js'

const source = fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8')
function context(extras = {}) { const ctx = vm.createContext(extras); vm.runInContext(source, ctx); return ctx }
const text = (value, marks = []) => ({ type: 'text', text: value, marks })
const paragraph = (...content) => ({ type: 'paragraph', content })
const doc = (...content) => ({ type: 'doc', attrs: { marginLeft: 1, marginRight: 0.75 }, content })
const image = { type: 'image', attrs: { src: 'data:image/png;base64,aGVsbG8=', alt: 'Seal', width: 480 } }
const sample = doc(
  { type: 'heading', attrs: { level: 2 }, content: [text('Heading')] },
  { ...paragraph(text('Bold', [{ type: 'bold' }]), text(' normal '), text('Link', [{ type: 'link', attrs: { href: 'https://example.com' } }])), attrs: { textAlign: 'center', indent: 1, lineSpacing: 1.5 } },
  { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [paragraph(text('First'))] }, { type: 'listItem', content: [paragraph(text('Second'))] }] },
  { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [paragraph(text('Header'))] }, { type: 'tableCell', content: [paragraph(text('Cell'))] }] }] },
  image, { type: 'pageBreak' }, paragraph(text('New page')),
)

test('plain text imports preserve line breaks without interpreting HTML', () => {
  const value = '<script>alert(1)</script>\n\nLast line'
  assert.equal(richBodyText(plainBodyDocument(value)), value)
  assert.equal(safeBodyLink('javascript:alert(1)'), undefined)
})

test('validated rich content keeps formatting and derives the spreadsheet plain text', () => {
  const ctx = context()
  const clean = ctx.validateRichBody(sample)
  assert.equal(clean.attrs.marginLeft, 1)
  assert.equal(clean.content[1].attrs.textAlign, 'center')
  assert.equal(clean.content[1].content[0].marks[0].type, 'bold')
  assert.equal(ctx.richBodyPlainText(clean), richBodyText(sample))
  for (const type of ['Executive Memorandum', 'Special Order']) {
    const data = ctx.validateTemplateDocument({ reference: '001', recipientLabel: 'For', recipientName: 'Recipient', subject: 'Subject', date: '2026-09-30', body: 'STALE', bodyRich: sample }, type)
    assert.equal(data.body, richBodyText(sample))
    assert.ok(data.bodyRich)
  }
})

test('rejects unsafe links, external images, oversized input, merged cells and invalid structures', () => {
  const ctx = context()
  for (const value of [doc(paragraph(text('Bad', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]))), doc({ type: 'image', attrs: { src: 'https://internal/image.png' } }), doc({ type: 'script', content: [] }), doc(paragraph(text('x'.repeat(50001)))), doc(paragraph()), doc({ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 2 }, content: [paragraph(text('Merged'))] }] }] })]) assert.throws(() => ctx.validateRichBody(value))
})

test('source round trip preserves images and marks without putting them in spreadsheet notes', () => {
  const files = new Map()
  let created = 0
  const folder = { getFilesByName: () => ({ hasNext: () => false }), createFile(name, value) { created++; const file = { value, getId: () => 'source1', isTrashed: () => false, setContent(next) { this.value = next }, getBlob() { return { getDataAsString: () => this.value } } }; files.set('source1', file); return file } }
  const ctx = context({ DriveApp: { getFileById: id => files.get(id) } })
  const documentFile = { getId: () => 'doc1', getParents: () => ({ hasNext: () => true, next: () => folder }) }
  const bodyRich = ctx.validateRichBody(sample)
  const stored = ctx.storeRichBodyForm({ body: richBodyText(sample), bodyRich }, documentFile)
  assert.equal(stored.bodyRich, undefined)
  assert.equal(stored.bodyRichFileId, 'source1')
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.loadRichBodyForm(stored).bodyRich)), JSON.parse(JSON.stringify(bodyRich)))
  ctx.storeRichBodyForm({ bodyRich }, documentFile, stored.bodyRichFileId)
  assert.equal(created, 1)
})

function renderFixture() {
  const paragraphs = [], tables = [], images = [], breaks = []
  function styled(node) { return new Proxy(node, { get(target, key) { if (key in target) return target[key]; if (key.startsWith('set')) return (...args) => { (target.calls ||= []).push([key, ...args]); return target.proxy }; return undefined } }) }
  function makeParagraph(value) {
    const runs = { calls: [] }; runs.proxy = styled(runs)
    const p = { value, runs, editAsText: () => runs.proxy, appendInlineImage() { const img = { getWidth: () => 640, getHeight: () => 320, calls: [] }; img.proxy = styled(img); images.push(img); return img.proxy } }; p.proxy = styled(p); paragraphs.push(p); return p.proxy
  }
  function section() { const children = []; return { children, appendParagraph(value) { const p = makeParagraph(value); children.push(p); return p }, appendPageBreak: () => breaks.push('page'), appendHorizontalRule: () => breaks.push('rule'), appendTable(rows) { const cells = rows.map(row => row.map(() => { const cell = section(); cell.appendParagraph(''); cell.proxy = styled(cell); return cell.proxy })); const table = { cells, getCell: (r, c) => cells[r][c] }; table.proxy = styled(table); tables.push(table); return table.proxy }, getNumChildren: () => children.length, getChild: i => children[i], removeChild: p => children.splice(children.indexOf(p), 1) } }
  const attrs = Object.fromEntries(['FONT_FAMILY', 'FONT_SIZE', 'BOLD', 'ITALIC', 'UNDERLINE', 'STRIKETHROUGH', 'FOREGROUND_COLOR', 'BACKGROUND_COLOR', 'LINK_URL'].map(key => [key, key]))
  const ctx = context({ DocumentApp: { Attribute: attrs, HorizontalAlignment: { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFY: 'justify' } }, Utilities: { newBlob: value => value, base64Decode: value => value } })
  return { ctx, body: section(), paragraphs, tables, images, breaks }
}

test('Docs rendering preserves text ranges, paragraph layout, numbering, tables, images and breaks', () => {
  const f = renderFixture()
  f.ctx.renderRichBody(f.body, f.ctx.validateRichBody(sample))
  const p = f.paragraphs.find(item => item.value === 'Bold normal Link')
  assert.ok(p.calls.some(call => call[0] === 'setAlignment' && call[1] === 'center'))
  assert.ok(p.calls.some(call => call[0] === 'setLineSpacing' && call[1] === 1.5))
  assert.ok(p.runs.calls.some(call => call[0] === 'setBold' && call[1] === 0 && call[2] === 3 && call[3] === true))
  assert.ok(p.runs.calls.some(call => call[0] === 'setAttributes' && call[1] === 4 && call[3].BOLD === false))
  assert.ok(p.runs.calls.some(call => call[0] === 'setLinkUrl' && call[1] === 12 && call[2] === 15))
  assert.ok(f.paragraphs.some(item => item.value === '3. First'))
  assert.ok(f.paragraphs.some(item => item.value === '4. Second'))
  assert.equal(f.tables[0].cells[0][0].children[0].value, 'Header')
  assert.equal(f.tables[0].cells[0][1].children[0].value, 'Cell')
  assert.ok(f.images[0].calls.some(call => call[0] === 'setWidth' && call[1] === 360))
  assert.deepEqual(f.breaks, ['page'])
})
