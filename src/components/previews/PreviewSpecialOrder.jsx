import { Fragment } from 'react'

// Edit the on-screen special order layout and Tailwind classes here.
// Saved Google Docs and PDFs use their own renderer in Google Apps Script.
export default function PreviewSpecialOrder({ form, reference }) {
  const recipient = [form.recipientName || form.recipient, form.recipientPosition, form.institution, form.additionalInstitution].filter(Boolean).join('\n')
  const fields = [[form.recipientLabel || 'For', recipient], ['Thru', form.thru], ['Subject', form.subject], ['Date', form.date]]
  const title = form.reference || reference || 'Special Order'

  return <div className="px-4 py-8">
    <article className="box-border mx-auto min-h-[1056px] w-full max-w-[816px] bg-white px-16 py-12 font-[Arial,sans-serif] text-[16px] leading-[1.5] text-[#202820] shadow-[0_8px_30px_#0005] [overflow-wrap:anywhere] max-[600px]:min-h-[780px] max-[600px]:p-6" aria-label="Special Order preview">
      {/* Letterhead */}
      <div className="mb-7 flex items-center gap-[18px] border-0 border-b-[3px] border-solid border-[#356442] pb-[14px]">
        <img src="/jhcsclogo.png" alt="College seal" className="h-auto w-[58px]" />
        <div>
          <strong className="block text-[20px] font-bold text-[#356442]">J.H. CERILLES STATE COLLEGE</strong>
          <small className="block text-[12px]">Mati, San Miguel, Zamboanga del Sur</small>
          <b className="block text-[12px] font-bold">OFFICE OF THE PRESIDENT</b>
        </div>
      </div>

      {/* Reference and recipient details */}
      <h3 className="my-[1em] border border-solid border-[#356442] p-2 text-[16px] font-normal uppercase">{title}</h3>
      <dl className="my-[1em] grid grid-cols-[160px_1fr] gap-x-4 gap-y-2 text-[14px] max-[600px]:grid-cols-[100px_1fr]">
        {fields.filter(([, value]) => value).map(([label, value], index) => <Fragment key={`${label}-${index}`}>
          <dt className="font-normal">{label.toUpperCase()}:</dt>
          <dd className="m-0 whitespace-pre-wrap">{value}</dd>
        </Fragment>)}
      </dl>

      {/* Body and signature */}
      <div className="mt-7 whitespace-pre-wrap">{form.body || form.content || ''}</div>
      <div className="mt-12 mr-0 mb-0 ml-[0%] whitespace-pre-wrap max-[600px]:ml-[20%]">
        {form.signatory || 'EDGARDO H. ROSALES, JD, Ed.D.'}<br />
        {form.signatoryPosition || form.position || 'SUC President II'}
      </div>
      {form.cc && <p className="my-[1em] whitespace-pre-wrap">cc: {form.cc}</p>}
    </article>
    <p className="my-[1em] text-center text-[13px] text-[#aeb8c8]">Page preview. Final pagination and formatting are applied in the PDF.</p>
  </div>
}
