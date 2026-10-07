import PreviewFooter from './PreviewFooter'
import ApprovalSignature from './ApprovalSignature'
import { certificateTravelDates, certificateBody } from '../../lib/travelCertificate'

// Preview and downloaded PDF template. The saved Google Doc uses Apps Script.
export default function PreviewCertificateOfTravel({ form, reference }) {
  const certificateReference = String(reference || form.reference || '').replace(/^Certificate of Travel\s*/i, '')
  const employee = form.recipientName || form.recipient || '[FULL NAME OF EMPLOYEE]'
  const destination = form.place || '[COUNTRY / DESTINATION]'
  const travelDates = certificateTravelDates(form)
  const body = form.certificateStructured ? certificateBody(form) : form.body || form.content || certificateBody(form)
  const paragraphs = body.split(/\r?\n/)

  return <div className="px-4 py-8">
    <article className="box-border mx-auto flex min-h-[1123px] w-full max-w-[794px] flex-col bg-white px-[69px] pt-10 pb-6 font-[Arial,sans-serif] text-[14px] leading-[1.2] text-[#202820] shadow-[0_8px_30px_#0005] [overflow-wrap:anywhere] max-[600px]:px-6" aria-label="Travel Certificate preview">
      <div className="mb-8 flex items-center justify-start gap-2">
        <img src="/jhcsclogo.png" alt="College seal" className="w-[60px] shrink-0" />
        <div>
          <strong className="block text-[21px] text-[#356442]">J.H. CERILLES STATE COLLEGE</strong>
          <small className="block text-[11px] text-[#707875]">Mati, San Miguel, Zamboanga del Sur | main@jhcsc.edu.ph | +63 915 2484 538</small>
          <b className="block text-[12px]">OFFICE OF THE PRESIDENT</b>
        </div>
      </div>

      <div className="mb-6 border-0 border-t-[3px] border-solid border-[#356442]">
        <h3 className="m-0 py-2 text-[16px] font-bold">Travel Certificate{certificateReference && <> <span className="text-black">{certificateReference}</span></>}</h3>
      </div>

      <dl className="m-0 mb-7 grid grid-cols-2 text-[13px]">
        {[[ 'Employee', employee ], [ 'Destination', destination ], [ 'Travel date/s', travelDates ]].map(([label, value]) => <div key={label} className="contents">
          <dt className="border-0 border-b border-solid border-[#e1e6e3] bg-[#f3f6f4] px-1 py-[5px] text-[11px] font-bold text-[#356442]">{label.toUpperCase()}</dt>
          <dd className="m-0 whitespace-pre-wrap border-0 border-b border-solid border-[#e1e6e3] px-1 py-[5px]">{value}</dd>
        </div>)}
      </dl>

      <div>{paragraphs.map((paragraph, index) => <p key={index} className="m-0 mb-3 min-h-[1.2em] whitespace-pre-wrap text-justify indent-[27px]">{paragraph || '\u00a0'}</p>)}</div>

      <div className="mt-6 ml-[49%] whitespace-pre-wrap">
        <p className="m-0 mb-1 text-[12px] font-bold text-[#707875]">CERTIFIED BY:</p>
        <ApprovalSignature form={form} />
        <div className="leading-[1.2]">
          <strong className="block">{form.signatory || '[NAME OF CERTIFYING AUTHORITY]'}</strong>
          <p className="m-0 text-[12px] text-[#707875]">{form.signatoryPosition || form.position || '[POSITION]'}</p>
        </div>
      </div>
      <p className="mt-7 mb-0 whitespace-pre-wrap text-[11px] text-[#707875]"><b>cc:</b> {form.cc || '[HRMO / Records / Other concerned office]'}</p>

      <PreviewFooter />
    </article>
    <p className="text-center text-[13px] text-[#aeb8c8]">Save as PDF downloads this preview layout.</p>
  </div>
}
