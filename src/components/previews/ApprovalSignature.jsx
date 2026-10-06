// Shared across all document types; adjust these Tailwind classes for every e-sign.
export default function ApprovalSignature({ form, className = 'w-[120px] left-[5px] top-[20px]' }) {
  const name = form.signatory || 'EDGARDO H. ROSALES, JD, Ed.D.'
  if (!['Approved', 'Out'].includes(form.status) || !/^EDGARDO H\. ROSALES\b/i.test(name.trim())) return null
  const approved = form.approvedAt ? new Date(form.approvedAt) : null
  const validDate = approved && !Number.isNaN(approved.getTime())
  const options = { timeZone: 'Asia/Manila' }
  return <div className={`relative mb-1 ${className}`}>
    <img src="/esign.png" alt="Signature of Edgardo H. Rosales" className="block h-auto w-full" />
    {/* Edit left/top/margin for position and text-[10px] for timestamp size. */}
    {validDate && <time dateTime={form.approvedAt} className="absolute left-20 top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap text-[10px] leading-tight">
      {approved.toLocaleDateString('en-US', { ...options, month: '2-digit', day: '2-digit', year: 'numeric' })}{' '}
      {approved.toLocaleTimeString('en-US', { ...options, hour: 'numeric', minute: '2-digit', hour12: true })}
    </time>}
  </div>
}
