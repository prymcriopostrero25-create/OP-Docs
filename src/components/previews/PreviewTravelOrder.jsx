import { Fragment } from 'react'
import ApprovalSignature from './ApprovalSignature'
import PreviewFooter from './PreviewFooter'

export default function PreviewTravelOrder({ form, reference }) {
  const fields = [
    ['Type of Travel', (form.travelType || 'Official Time').toUpperCase()],
    [form.recipientLabel || 'For', form.recipientName || form.recipient],
    ['Position/Office', form.recipientPosition], ['Destination', form.place || form.destination],
    ['Inclusive dates', form.inclusiveDate || form.travelDates],
    ['Mode of\ntransportation', form.transportation], ['Purpose', form.purpose], ['Remarks', form.remarks?.trim()],
  ]
  const number = String(form.reference || reference || '').match(/\d+/)
  const year = form.year || String(form.date || '').slice(0, 4) || new Date().getFullYear()
  return <div className="px-4 py-8">
    <article className="box-border mx-auto flex min-h-[1123px] w-full max-w-[794px] flex-col bg-white px-[68px] pt-[42px] pb-4 font-[Arial,sans-serif] text-[16px] leading-[1.5] text-black shadow-[0_8px_30px_#0005] [overflow-wrap:anywhere] max-[600px]:px-6 max-[600px]:pt-7" aria-label="Travel Order preview">
      <div className="mb-9 flex items-center gap-[14px] border-0 border-b-2 border-solid border-[#356442] pb-[22px] leading-[1.15]">
        <img src="/jhcsclogo.png" alt="College seal" className="h-auto w-[58px] shrink-0" />
        <div>
          <strong className="block text-[20px] font-bold text-[#356442] max-[600px]:text-[16px]">J.H. CERILLES STATE COLLEGE</strong>
          <small className="block text-[10px] text-[#707875]">Mati, San Miguel, Zamboanga del Sur | main@jhcsc.edu.ph | +63 915 2484 538</small>
          <b className="block text-[12px] font-bold">OFFICE OF THE PRESIDENT</b>
        </div>
      </div>
      <h3 className="mt-0 mb-6 flex flex-wrap justify-between gap-2 border border-solid border-[#356442] bg-[#f4f6f5] p-1 text-[13px] font-bold leading-[1.2] max-[600px]:gap-3">
        <span>TRAVEL ORDER NO. {number ? String(Number(number[0])).padStart(3, '0') : '___'}</span>
        <span>Series of {year}</span>
      </h3>
      <dl className="m-0 grid grid-cols-[180px_minmax(0,1fr)] items-baseline gap-x-[17px] gap-y-[5px] text-[14px] leading-[1.2] max-[600px]:grid-cols-[120px_minmax(0,1fr)] max-[600px]:gap-x-3">
        {fields.filter(([, value]) => value).map(([label, value], index) => <Fragment key={`${label}-${index}`}>
          <dt className="whitespace-pre-line font-bold">{label.toUpperCase()}:</dt>
          <dd className={`m-0 whitespace-pre-wrap ${label === 'Mode of\ntransportation' ? 'self-start pt-[1.2em]' : ''}`}>{value}</dd>
        </Fragment>)}
      </dl>
      <div className="mt-4 whitespace-normal text-[14px] leading-[1.2]" contentEditable={false}>
        <p className="mt-0 mb-3 text-justify indent-[30px]">The above-named personnel is/are hereby authorized to travel on {(form.travelType || 'Official Time').toLowerCase()}, subject to existing government accounting, auditing, and travel regulations.</p>
        <p className="mt-0 mb-3 text-justify indent-[30px]">It is understood that the traveler/s shall submit the required travel report and supporting documents upon completion of the travel.</p>
        <p className="mt-0 mb-3">For information and compliance.</p>
      </div>
      <div className="mt-[60px] mr-0 mb-4 ml-[2%] whitespace-pre-wrap text-[16px] leading-[1.2]">
        <ApprovalSignature form={form} />
        <div className="leading-[1.2]">
          {/* Adjust text-[16px] below to change the signatory name font size. */}
          <span className="block font-bold text-[15px]">{form.signatory || 'EDGARDO H. ROSALES, JD, Ed.D.'}</span>
          {/* Adjust text-[16px] below to change the signatory position font size. */}
          <span className="block text-[14px]">{form.signatoryPosition || form.position || 'SUC President II'}</span>
        </div>
      </div>
      {form.cc && <p className="my-[1em] whitespace-pre-wrap">cc: {form.cc}</p>}
      <PreviewFooter />
    </article>
    <p className="my-[1em] text-center text-[13px] text-[#aeb8c8]">Save as PDF downloads this preview layout.</p>
  </div>
}
