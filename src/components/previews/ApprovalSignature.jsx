// Shared across all document types and their exported preview PDFs.
// Change width for the overall size and position to move the signature.
// Change textSize independently; 8px matches the compact reference stamp.
// Change leading in text to adjust the space between lines.
const signatureClasses = {
  width: 'w-[320px]',
  position: 'relative mb-2',
  layout: 'flex items-center gap-2 font-[Arial,sans-serif] text-black',
  image: 'block h-auto w-[80px] shrink-0',
  textSize: 'text-[8px]',
  text: 'min-w-0 flex-1 whitespace-normal leading-[1.25] font-normal',
}

export default function ApprovalSignature({ form, className = signatureClasses.width }) {
  const name = form.signatory || 'EDGARDO H. ROSALES, JD, Ed.D.'
  if (!['Approved', 'Out'].includes(form.status) || !/^EDGARDO H\. ROSALES\b/i.test(name.trim())) return null
  const approved = form.approvedAt ? new Date(form.approvedAt) : null
  const validDate = approved && !Number.isNaN(approved.getTime())
  const options = { timeZone: 'Asia/Manila' }
  const date = validDate ? approved.toLocaleDateString('en-CA', { ...options, year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('-', '.') : ''
  const time = validDate ? approved.toLocaleTimeString('en-GB', { ...options, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : ''
  return <div className={`max-w-full ${signatureClasses.position} ${className}`}>
    <div className={signatureClasses.layout}>
      <img src="/esign.png" alt="Signature of Edgardo H. Rosales" className={signatureClasses.image} />
      <div className={`${signatureClasses.text} ${signatureClasses.textSize}`}>
        <span className="block">Digitally signed by <br/> Rosales Edgardo Hermitaño</span>
        {validDate && <time dateTime={form.approvedAt} className="block">
          Date: {date} {time} +08'00'
        </time>}
      </div>
    </div>
  </div>
}
