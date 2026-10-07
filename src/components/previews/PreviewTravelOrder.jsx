import PreviewLayout from './PreviewLayout'

export default function PreviewTravelOrder({ form, reference }) {
  const fields = [
    ['Type of Travel', form.travelType || 'Official Time'],
    [form.recipientLabel || 'For', form.recipientName || form.recipient],
    ['Position/Office', form.recipientPosition], ['Destination', form.place || form.destination],
    ['Inclusive dates', form.inclusiveDate || form.travelDates],
    ['Mode of\ntransportation', form.transportation], ['Purpose', form.purpose], ['Remarks', form.remarks],
  ]
  const number = String(form.reference || reference || '').match(/\d+/)
  const year = form.year || String(form.date || '').slice(0, 4) || new Date().getFullYear()
  const heading = <h3 className="travel-order-heading"><span>TRAVEL ORDER NO. {number ? String(Number(number[0])).padStart(3, '0') : '___'}</span><span>Series of {year}</span></h3>
  const authorization = <div className="travel-order-authorization" contentEditable={false}>
    <p>The above-named personnel is/are hereby authorized to travel on {(form.travelType || 'Official Time').toLowerCase()}, subject to existing government accounting, auditing, and travel regulations.</p>
    <p>It is understood that the traveler/s shall submit the required travel report and supporting documents upon completion of the travel.</p>
    <p>For information and compliance.</p>
  </div>
  return <PreviewLayout form={form} reference={reference} type="Travel Order" fields={fields} letterhead contact signature heading={heading} paperClass="travel-order-paper" bodyContent={authorization} />
}
