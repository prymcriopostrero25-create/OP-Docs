from pathlib import Path
p=Path('tests/emailRegister.test.js');s=p.read_text().replace('setNumberFormat() {}', 'setNumberFormat() {}, setNote() {}');p.write_text(s)
