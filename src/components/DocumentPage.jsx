import PreviewExecutiveMemo from './previews/PreviewExecutiveMemo'
import PreviewSpecialOrder from './previews/PreviewSpecialOrder'
import PreviewTravelOrder from './previews/PreviewTravelOrder'
import PreviewTravelAuthority from './previews/PreviewTravelAuthority'
import PreviewCertificateOfTravel from './previews/PreviewCertificateOfTravel'
import PreviewLayout from './previews/PreviewLayout'

const previews = {
  'Executive Memorandum': PreviewExecutiveMemo,
  'Special Order': PreviewSpecialOrder,
  'Travel Order': PreviewTravelOrder,
  'Authority to Travel Abroad': PreviewTravelAuthority,
  'Certificate of Travel': PreviewCertificateOfTravel,
}

export default function DocumentPage({ form, type, reference }) {
  const documentType = type || form.type
  const Preview = previews[documentType] || PreviewLayout
  return <Preview form={form} type={documentType} reference={reference} />
}
