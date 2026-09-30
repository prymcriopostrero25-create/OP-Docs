// Edit the on-screen memo layout and styling here. Saved Docs/PDFs use
// their own renderer in Google Apps Script.
function displayDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value || ''
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export default function PreviewExecutiveMemo({ form, reference }) {
  const recipient = [form.recipientName || form.recipient, form.recipientPosition, form.institution, form.additionalInstitution].filter(Boolean).join('\n')
  const fields = [[form.recipientLabel || 'For', recipient], ['Thru', form.thru], ['Subject', form.subject?.toUpperCase()], ['Date', displayDate(form.date).toUpperCase()]]
  const title = form.reference || reference || (form.number ? `Executive Memorandum Order No. ${form.number}` : 'Executive Memorandum')
  const year = form.year || form.date?.slice(0, 4)

  return <div className="px-4 py-8">
    <article className="box-border mx-auto min-h-[1056px] w-full max-w-[816px] bg-white px-[69px] pt-10 pb-12 font-[Arial,sans-serif] text-[16px] leading-[1.2] text-[#202820] shadow-[0_8px_30px_#0005] [overflow-wrap:anywhere] max-[600px]:min-h-[780px]" aria-label="Executive Memorandum preview">
      <div className="mb-7 flex items-center justify-start gap-2 border-0 border-b-[3px] border-solid border-[#356442] pb-[14px]">
        <img src="/jhcsclogo.png" alt="College seal" className="h-auto w-[57px] shrink-0" />
        <div>
          <strong className="block text-[20px] font-bold text-[#356442]">J.H. CERILLES STATE COLLEGE</strong>
          <small className="mt-1 block text-[11px] text-[#707875]">Mati, San Miguel, Zamboanga del Sur | main@jhcsc.edu.ph | +63 915 2484 538</small>
          <b className="mt-1 block text-[11px]">OFFICE OF THE PRESIDENT</b>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap justify-between gap-2 border border-solid border-[#356442] bg-[#f4f6f5] p-1 text-[13px]">
        <span>{title.toUpperCase()}</span>
        {year && <span>Series of {year}</span>}
      </div>

      <dl className="m-0 grid grid-cols-[minmax(70px,28%)_minmax(0,1fr)] gap-x-0 gap-y-2 text-[13px]">
        {fields.filter(([, value]) => value).map(([label, value], index) => <div key={`${label}-${index}`} className="contents">
          <dt className="font-normal">{label.toUpperCase()}:</dt>
          <dd className="m-0 whitespace-pre-wrap">{value}</dd>
        </div>)}
      </dl>

      <div className="mt-6">
        {(form.body || form.content || '').split(/\r?\n/).map((line, index) => <p key={index} className="m-0 mb-2 min-h-[1.2em] indent-[29px] whitespace-pre-wrap">{line || '\u00a0'}</p>)}
      </div>

      <div className="mt-15 mr-0 mb-4 ml-[2%] whitespace-pre-wrap">
        {form.signatory || 'EDGARDO H. ROSALES, JD, Ed.D.'}<br />
        {form.signatoryPosition || form.position || 'SUC President II'}
      </div>
      {form.cc && <p className="text-[12px] whitespace-pre-wrap">cc:{'\n'}{form.cc}</p>}
    </article>
    <p className="text-center text-[13px] text-[#aeb8c8]">On-screen preview. Saved Google Docs and PDFs use separate formatting.</p>
  </div>
}
