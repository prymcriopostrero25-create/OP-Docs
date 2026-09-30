import PreviewFooter from './PreviewFooter'
import { Fragment } from 'react'

export default function PreviewLayout({ form, type, reference, fields = [], letterhead = false, signature = false }) {
  return <div className="document-page-wrap"><article className="document-paper flex flex-col" aria-label={`${type} preview`}>
    {letterhead && <div className="document-letterhead"><img src="/jhcsclogo.png" alt="College seal" /><div><strong>J.H. CERILLES STATE COLLEGE</strong><small>Mati, San Miguel, Zamboanga del Sur</small><b>OFFICE OF THE PRESIDENT</b></div></div>}
    <h3>{form.reference || reference || type}</h3>
    <dl>{fields.filter(([, value]) => value).map(([label, value], index) => <Fragment key={`${label}-${index}`}><dt>{label.toUpperCase()}:</dt><dd>{value}</dd></Fragment>)}</dl>
    <div className="document-paper-body">{form.body || form.content || ''}</div>
    {signature && <div className="document-signatory">{form.signatory || 'EDGARDO H. ROSALES, JD, Ed.D.'}<br />{form.signatoryPosition || form.position || 'SUC President II'}</div>}
    {form.cc && <p className="document-paper-cc">cc: {form.cc}</p>}
    <PreviewFooter />
  </article><p className="document-page-caption">Page preview. Final pagination and formatting are applied in the PDF.</p></div>
}
