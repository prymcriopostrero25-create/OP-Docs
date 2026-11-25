from pathlib import Path
p=Path('src/components/CitizenCharter.jsx')
s=p.read_text(encoding='utf-8')
s=s.replace('<summary><span className="charter-service-icon"><Icon kind={category === \'internal\' ? \'building\' : \'document\'} /></span><span><strong>{index + 1}. {service.title}</strong><small>{service.classification} · No fees · Pages {service.pages}</small></span><span className="charter-chevron" aria-hidden="true">›</span></summary>', '''<summary>
              <span className="charter-service-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className="charter-service-copy"><strong>{service.title}</strong><span className="charter-service-badges"><span>{service.classification}</span><span className="charter-no-fee">No fees</span></span></span>
              <span className="charter-service-open-label">View details</span>
              <span className="charter-chevron" aria-hidden="true">⌄</span>
            </summary>''')
p.write_text(s,encoding='utf-8')
p=Path('src/components/CitizenCharter.css')
s=p.read_text(encoding='utf-8')
a=s.index('.charter-service-list {')
s=s[:a]+'''/* Service directory */
.citizen-charter .charter-services-heading { justify-content: space-between; gap: 18px; scroll-margin-top: 120px; }
.citizen-charter .charter-service-tabs { padding: 4px; border: 1px solid #e9dce1; border-radius: 10px; background: #f5ebef; }
.citizen-charter .charter-service-tabs button { min-height: 42px; border-radius: 7px; font-weight: 600; }
.charter-service-list { display: grid; gap: 14px; margin: 22px 0 28px; }
.charter-service-entry { min-width: 0; border: 1px solid #e5dce1; border-radius: 12px; background: #fff; overflow: hidden; box-shadow: 0 2px 6px #3b061003; }
.charter-service-entry > summary { display: flex; align-items: center; gap: 20px; min-height: 106px; padding: 22px 26px; cursor: pointer; list-style: none; }
.charter-service-entry > summary::-webkit-details-marker { display: none; }
.charter-service-number { display: grid; place-items: center; flex: 0 0 48px; height: 48px; border: 1px solid #eddee4; border-radius: 10px; background: #fbf5f7; color: #8b102b; font: 700 17px/1 'Manrope', sans-serif; }
.charter-service-copy { flex: 1; min-width: 0; }
.charter-service-entry > summary strong { display: block; color: #292135; font: 650 16px/1.55 'Manrope', sans-serif; overflow-wrap: anywhere; }
.charter-service-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.charter-service-badges > span { padding: 3px 9px; border: 1px solid #e9e1e6; border-radius: 5px; background: #f7f4f6; color: #645367; font: 500 12px/1.5 'DM Sans', sans-serif; }
.charter-service-badges > .charter-no-fee { background: #f1f7f3; border-color: #dce9df; color: #356246; }
.charter-service-open-label { flex-shrink: 0; color: #8b102b; font-size: 13px; font-weight: 600; }
.citizen-charter .charter-chevron { display: grid; place-items: center; width: 30px; height: 30px; flex-shrink: 0; margin-left: 0; border-radius: 50%; background: #f8f0f3; color: #8b102b; font: 600 22px/1 'DM Sans', sans-serif; }
.charter-service-entry[open] { border-color: #caa8b3; box-shadow: 0 6px 24px #3b061008; }
.charter-service-entry[open] > summary { background: #fcf7f9; border-bottom: 1px solid #eadce4; }
.charter-service-entry[open] .charter-chevron { transform: rotate(180deg); }
.charter-service-body { padding: 12px 28px 26px; color: #302a39; font-size: 15px; line-height: 1.75; }
.charter-service-body h5 { margin: 26px 0 12px; font: 700 18px/1.5 'Manrope', sans-serif; color: #7c0d25; }
.charter-service-body li { margin-bottom: 10px; }
.charter-service-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.charter-service-meta div { padding: 16px; background: #faf7f9; border: 1px solid #eee6eb; border-radius: 8px; }
.charter-service-meta dt { font-size: 13px; font-weight: 700; color: #7c0d25; }
.charter-service-meta dd { margin: 6px 0 0; }
.charter-table-scroll { max-width: 100%; overflow-x: auto; border: 1px solid #e3d7de; border-radius: 8px; }
.citizen-charter .charter-procedure-table { width: 100%; min-width: 960px; table-layout: fixed; border-collapse: collapse; font-family: 'DM Sans', 'Segoe UI', sans-serif; }
.citizen-charter .charter-procedure-table th, .citizen-charter .charter-procedure-table td { height: auto; padding: 18px 20px; border: 0; border-right: 1px solid #e8dfe4; border-bottom: 1px solid #e8dfe4; text-align: left; vertical-align: top; white-space: normal; overflow-wrap: anywhere; font-size: 15px; line-height: 1.75; letter-spacing: normal; text-transform: none; }
.citizen-charter .charter-procedure-table th { color: #fff; background: #7c0d25; font-size: 14px; font-weight: 700; line-height: 1.5; }
.citizen-charter .charter-procedure-table td { color: #302a39; font-weight: 400; }
.citizen-charter .charter-procedure-table tbody tr:nth-child(even) { background: #faf7f9; }
.citizen-charter .charter-procedure-table tr:last-child td { border-bottom: 0; }
.citizen-charter .charter-procedure-table tr > :last-child { border-right: 0; }
.citizen-charter .charter-procedure-table th:nth-child(1) { width: 23%; }
.citizen-charter .charter-procedure-table th:nth-child(2) { width: 36%; }
.citizen-charter .charter-procedure-table th:nth-child(3) { width: 7%; }
.citizen-charter .charter-procedure-table th:nth-child(4) { width: 14%; }
.citizen-charter .charter-procedure-table th:nth-child(5) { width: 20%; }
.charter-service-entry > summary:focus-visible, .charter-table-scroll:focus-visible { outline: 3px solid #a71934; outline-offset: -3px; }
@media (prefers-reduced-motion: no-preference) {
  .charter-service-entry { transition: border-color .2s, box-shadow .2s; }
  .charter-service-entry > summary { transition: background .2s; }
  .charter-chevron { transition: transform .2s; }
  .charter-service-entry > summary:hover { background: #fcf7f9; }
}
@media (max-width: 650px) {
  .charter-service-meta { grid-template-columns: 1fr; }
  .charter-service-body { padding: 8px 16px 20px; }
  .charter-service-entry > summary { padding: 18px 14px; gap: 12px; }
  .charter-service-entry > summary strong { font-size: 14px; }
  .charter-service-number { flex-basis: 36px; height: 40px; font-size: 14px; }
  .charter-service-open-label { display: none; }
  .citizen-charter .charter-service-tabs button { padding-inline: 10px; }
}
'''
p.write_text(s,encoding='utf-8')
