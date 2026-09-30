import PreviewLayout from './PreviewLayout'

export default function PreviewTravelOrder({ form, reference }) {
  const fields = [
    [form.recipientLabel || 'For', form.recipientName || form.recipient],
    ['Position/Office', form.recipientPosition], ['Place', form.place || form.destination],
    ['Inclusive dates', form.inclusiveDate || form.travelDates],
    ['Mode of transportation', form.transportation], ['Purpose', form.purpose], ['Remarks', form.remarks],
  ]
  return <PreviewLayout form={form} reference={reference} type="Travel Order" fields={fields} letterhead />
}
