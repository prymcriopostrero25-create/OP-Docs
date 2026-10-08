import ApprovalSignature from './ApprovalSignature'
import PreviewFooter from './PreviewFooter'
import RichBodyPreview from '../RichBodyPreview'
import { Fragment } from 'react'

// Edit the on-screen special order layout and Tailwind classes here.
// Save as PDF captures this layout. The saved Google Doc uses Apps Script.
export default function PreviewSpecialOrder({ form, reference }) {
  const recipient = form.recipients?.length ? form.recipients.map(item => [item.name, item.position, item.institution].filter(Boolean).join('\n')).join('\n\n') : [form.recipientName || form.recipient, form.recipientPosition, form.institution, form.additionalInstitution].filter(Boolean).join('\n')
  const fields = [[form.recipientLabel || 'For', recipient], ['Thru', form.thru], ['Subject', form.subject], ['Date', form.date]]
  const fullReference = form.reference || reference || 'Special Order'
  const title = fullReference.replace(/,?\s*s\.\s*\d{4}\s*$/i, '')
  const year = form.year || form.date?.slice(0, 4) || fullReference.match(/s\.\s*(\d{4})\s*$/i)?.[1]

  return <div className="px-4 py-8">
    <article style={form.bodyRich ? { paddingLeft: `${form.bodyRich.attrs?.marginLeft ?? 0.75}in`, paddingRight: `${form.bodyRich.attrs?.marginRight ?? 0.75}in` } : undefined} className="box-border mx-auto flex min-h-[1123px] w-full max-w-[794px] flex-col bg-white px-16 pt-12 pb-4 font-[Arial,sans-serif] text-[16px] leading-[1.5] text-[#202820] shadow-[0_8px_30px_#0005] [overflow-wrap:anywhere] max-[600px]:px-6 max-[600px]:pt-6" aria-label="Special Order preview">
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
      <div className="mb-6 flex flex-wrap justify-between gap-2 border border-solid border-[#356442] bg-[#f4f6f5] p-1 text-[13px] leading-[1.2] font-bold">
        <span>{title.toUpperCase()}</span>
        {year && <span>Series of {year}</span>}
      </div>
      <dl className="my-[1em] grid grid-cols-[160px_1fr] gap-x-4 gap-y-2 text-[14px] max-[600px]:grid-cols-[100px_1fr] font-bold">
        {fields.filter(([, value]) => value).map(([label, value], index) => <Fragment key={`${label}-${index}`}>
          <dt className="font-bold">{label.toUpperCase()}:</dt>
          <dd className="m-0 whitespace-pre-wrap">{value}</dd>
        </Fragment>)}
      </dl>

      {/* Body and signature */}
      <div className="mt-7">{form.bodyRich ? <RichBodyPreview value={form.bodyRich} /> : <div className="whitespace-pre-wrap">{form.body || form.content || ''}</div>}</div>
      <div className="mt-12 mr-0 mb-0 ml-[0%] whitespace-pre-wrap max-[600px]:ml-[20%]">
        <ApprovalSignature form={form} />
        <div className="leading-[1.2]">
          {/* Adjust text-[15px] below to change the president name font size. */}
          <span className="block font-bold text-[15px]">{form.signatory || 'EDGARDO H. ROSALES, JD, Ed.D.'}</span>
          {/* Adjust text-[13px] below to change the designation font size. */}
          <span className="block text-[13px]">{form.signatoryPosition || form.position || 'SUC President II'}</span>
        </div>
      </div>
      {form.cc && <p className="my-[1em] whitespace-pre-wrap">cc: {form.cc}</p>}
      <PreviewFooter />
    </article>
    <p className="my-[1em] text-center text-[13px] text-[#aeb8c8]">Save as PDF downloads this preview layout.</p>
  </div>
}
