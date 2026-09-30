import PreviewLayout from './PreviewLayout'

export default function PreviewTravelAuthority({ form, reference }) {
  return <PreviewLayout form={form} reference={reference} type="Authority to Travel Abroad" fields={[["Date", form.date]]} />
}
