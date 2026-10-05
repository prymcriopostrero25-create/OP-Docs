from pathlib import Path
p=Path('src/lib/appsScriptApi.js');s=p.read_text(encoding='utf-8-sig');s="import { fetchAppsScript } from './appsScriptFetch'\n"+s
start=s.index('async function documentRequest(payload)');end=s.index('export async function fetchDocuments()',start)
section=s[start:end].replace('await fetch(requestTarget(), {','await fetchAppsScript(requestTarget(), {').replace('signal: AbortSignal.timeout(90000),\n  })','signal: AbortSignal.timeout(90000),\n  }, payload.action)')
s=s[:start]+section+s[end:];p.write_text(s,encoding='utf-8')
