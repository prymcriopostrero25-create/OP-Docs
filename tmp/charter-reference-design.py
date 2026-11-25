from pathlib import Path
p=Path('src/components/CitizenCharter.jsx')
s=p.read_text(encoding='utf-8')
s=s.replace('<h3 className="charter-section-title">List of Services</h3>', '<div className="charter-directory-title"><h3 className="charter-section-title">List of Services</h3><p>Browse the services provided by the Office of the President.</p></div>')
s=s.replace('>External Services (5)</button>', '><Icon kind="building" />External Services (5)</button>').replace('>Internal Services (3)</button>', '><Icon kind="people" />Internal Services (3)</button>')
s=s.replace('<span className="charter-service-number"', '<span className="charter-directory-icon" aria-hidden="true"><Icon kind={(category === \'external\' ? [\'document\', \'calendar\', \'people\', \'mail\', \'building\'] : [\'document\', \'mail\', \'calendar\'])[index]} /></span>\n              <span className="charter-service-number"')
s=s.replace('<span>{service.classification}</span>', '<span className={service.classification === \'Complex\' ? \'charter-complex\' : \'charter-simple\'}>{service.classification}</span>')
s=s.replace('<span className="charter-no-fee">No fees</span>', '<span className="charter-no-fee"><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 8 3 3 7-7" /></svg>No fees</span>')
a=s.index('              <span className="charter-service-open-label">')
b=s.index('\n            </summary>',a)
s=s[:a]+'''              <span className="charter-service-action"><span className="charter-action-closed">View details</span><span className="charter-action-expanded">Hide details</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-5-5 5 5-5 5" /></svg></span>'''+s[b:]
p.write_text(s,encoding='utf-8')
p=Path('src/components/CitizenCharter.css')
s=p.read_text(encoding='utf-8')
a=s.index('/* Service directory */')
b=s.index('.charter-service-body {',a)
s=s[:a]+'''/* Service directory */
.citizen-charter .charter-services-heading { justify-content: space-between; align-items: center; gap: 24px; scroll-margin-top: 120px; }
.charter-directory-title { position: relative; padding-left: 23px; }
.charter-directory-title::before { content: ''; position: absolute; left: 0; top: 2px; bottom: 2px; width: 5px; border-radius: 5px; background: #a51638; }
.charter-directory-title .charter-section-title { padding: 0; color: #15182f; font-size: 29px; letter-spacing: -1px; }
.charter-directory-title .charter-section-title::before { display: none; }
.charter-directory-title p { margin: 6px 0 0; color: #59627b; font-size: 13px; line-height: 1.6; }
.citizen-charter .charter-service-tabs { gap: 10px; padding: 0; border: 0; border-radius: 0; background: transparent; }
.citizen-charter .charter-service-tabs button { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 42px; padding: 10px 18px; border: 1px solid #d8dce8; border-radius: 10px; color: #242a41; background: #f8f9fd; box-shadow: 0 3px 8px #23315408; font-weight: 650; font-size: 12px; }
.citizen-charter .charter-service-tabs button.is-active { border-color: #b02548; color: #fff; background: linear-gradient(120deg, #b51940, #7c0724); box-shadow: 0 4px 10px #8b102b20; }
.charter-service-tabs svg { width: 20px; height: 20px; flex-shrink: 0; }
.charter-service-list { display: grid; gap: 12px; margin: 24px 0 28px; }
.charter-service-entry { position: relative; min-width: 0; border: 1px solid #dce0eb; border-radius: 14px; background: linear-gradient(105deg, #fff, #f8faff); overflow: hidden; box-shadow: 0 4px 9px #2635570a, 0 1px 2px #26355705; }
.charter-service-entry > summary { display: flex; align-items: center; gap: 18px; min-height: 88px; padding: 14px 22px; cursor: pointer; list-style: none; }
.charter-service-entry > summary::-webkit-details-marker { display: none; }
.charter-directory-icon { display: grid; place-items: center; flex: 0 0 48px; height: 48px; border-radius: 11px; background: #f7eaf0; color: #9b1237; }
.charter-directory-icon svg { width: 29px; height: 29px; }
.charter-service-number { display: grid; place-items: center; flex: 0 0 52px; height: 42px; border-inline: 1px solid #d9dce6; color: #971133; font: 750 19px/1 'Manrope', sans-serif; }
.charter-service-copy { flex: 1; min-width: 0; }
.charter-service-entry > summary strong { display: block; color: #171a30; font: 700 14px/1.5 'Manrope', sans-serif; overflow-wrap: anywhere; }
.charter-service-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 7px; }
.charter-service-badges > span { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 6px; font: 650 11px/1.5 'DM Sans', sans-serif; }
.charter-service-badges > .charter-complex { background: #f8dfe7; color: #9b1237; }
.charter-service-badges > .charter-simple { background: #deefff; color: #235a86; }
.charter-service-badges > .charter-no-fee { background: #dff5e9; color: #08743c; }
.charter-no-fee svg { width: 14px; height: 14px; }
.charter-service-action { display: inline-flex; align-items: center; justify-content: center; gap: 9px; flex-shrink: 0; min-height: 34px; padding: 7px 13px; border: 1px solid #cf97a9; border-radius: 8px; color: #8b102b; background: #ffffffb3; font: 700 11px/1.4 'DM Sans', sans-serif; }
.charter-service-action svg { display: block; width: 16px; height: 16px; }
.charter-action-expanded { display: none; }
.charter-service-entry[open] { border-color: #d7a5b5; box-shadow: 0 5px 16px #8b102b0d; }
.charter-service-entry[open] > summary { position: relative; background: linear-gradient(110deg, #fff, #f8edf2); border-bottom: 1px solid #ecdbe3; }
.charter-service-entry[open] > summary::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 5px; background: #b51643; }
.charter-service-entry[open] .charter-service-action { border-color: #a8173c; color: #fff; background: linear-gradient(120deg, #b51940, #7c0724); }
.charter-service-entry[open] .charter-action-closed { display: none; }
.charter-service-entry[open] .charter-action-expanded { display: inline; }
.charter-service-entry[open] .charter-service-action svg { transform: rotate(-90deg); }
'''+s[b:]
s=s.replace('  .charter-service-number { flex-basis: 36px; height: 40px; font-size: 14px; }','  .charter-service-number { flex-basis: 34px; height: 36px; font-size: 15px; }')
s+='''
@media (max-width: 900px) {
  .citizen-charter .charter-services-heading { align-items: flex-start; }
  .charter-directory-icon { flex-basis: 40px; height: 42px; }
  .charter-service-entry > summary { gap: 12px; padding-inline: 16px; }
}
@media (max-width: 650px) {
  .charter-directory-title .charter-section-title { font-size: 25px; }
  .charter-service-entry > summary { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px 12px; padding: 16px; }
  .charter-directory-icon { display: none; }
  .charter-service-number { width: 34px; align-self: start; border-left: 0; }
  .charter-service-entry > summary strong { font-size: 13px; }
  .charter-service-action { grid-column: 2; justify-self: start; min-height: 36px; }
  .citizen-charter .charter-service-tabs { width: 100%; flex-wrap: wrap; gap: 8px; }
  .citizen-charter .charter-service-tabs button { flex: 1; padding-inline: 10px; }
}
'''
p.write_text(s,encoding='utf-8')
