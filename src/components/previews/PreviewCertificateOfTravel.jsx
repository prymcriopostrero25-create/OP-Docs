import PreviewLayout from './PreviewLayout'

export default function PreviewCertificateOfTravel({ form, reference }) {
  return <PreviewLayout form={form} reference={reference} type="Certificate of Travel" fields={[["Date", form.date]]} />
}
