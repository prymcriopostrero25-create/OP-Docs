from pathlib import Path
p=Path('src/components/CitizenCharter.jsx')
s=p.read_text(encoding='utf-8').replace('<div className="charter-hero-pledge">Your guide to<br />College President’s<br />Office Services</div>', '''<aside className="charter-guide-card" aria-label="Service directory at a glance">
            <div className="charter-guide-label"><Icon kind="document" /><span>Public service directory</span><span className="charter-edition">2026</span></div>
            <p>Clear steps.<br /><strong>Accessible service.</strong></p>
            <div className="charter-guide-stats"><div><strong>05</strong><span>External services</span></div><div><strong>03</strong><span>Internal services</span></div><div><strong>₱0</strong><span>Service fees</span></div></div>
          </aside>''')
p.write_text(s,encoding='utf-8')
p=Path('src/components/CitizenCharter.css')
s=p.read_text(encoding='utf-8')
start=s.index('.portal .citizen-charter-login-button')
end=s.index('\n\n.charter-overview',start)
Path('tmp/charter-login-styles.txt').write_text(s[start:end],encoding='utf-8')
