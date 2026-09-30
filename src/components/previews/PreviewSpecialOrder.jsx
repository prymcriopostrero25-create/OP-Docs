import PreviewLayout from './PreviewLayout'

export default function PreviewSpecialOrder({ form, reference }) {
  const recipient = [form.recipientName || form.recipient, form.recipientPosition, form.institution, form.additionalInstitution].filter(Boolean).join('\n')
  const fields = [[form.recipientLabel || 'For', recipient], ['Thru', form.thru], ['Subject', form.subject], ['Date', form.date]]
  return <PreviewLayout form={form} reference={reference} type="Special Order" fields={fields} letterhead signature />
}
