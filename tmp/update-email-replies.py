from pathlib import Path
p=Path('google-apps-script/Code.gs')
s=p.read_text()
s=s.replace("    const today = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd');\n    const references", "    const linkRows = sheet.getLastRow() > 1 ? sheet.getRange(2, 7, sheet.getLastRow() - 1, 1) : null;\n    const linkNotes = linkRows && typeof linkRows.getNotes === 'function' ? linkRows.getNotes() : [];\n    const linkValues = linkRows ? linkRows.getValues() : [];\n    const threadRows = new Map();\n    linkNotes.forEach((note, index) => {\n      try { const metadata = JSON.parse(note[0] || '{}'); if (metadata.threadId) threadRows.set(metadata.threadId, index + 2); } catch (error) { /* Legacy note. */ }\n    });\n    const today = Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd');\n    const references")
s=s.replace("      const labelIds = new Set();", "      const labelIds = new Set();\n      const pendingNotes = new Map();")
s=s.replace("        if (known.has(url)) { labelIds.add(item.id); return; }", "        if (known.has(url) && !item.threadId) { labelIds.add(item.id); return; }")
s=s.replace("        if (message.threadId) {", "        let threadMetadata;\n        if (message.threadId) {")
s=s.replace("            Number(candidate.internalDate) >= midnight * 1000 &&\n", "")
a=s.index('          // Check every matching message so legacy rows also prevent reimports.')
b=s.index("        const firstUrl",a)
s=s[:a]+'''          if (!matching.length) return;
          const latest = matching[matching.length - 1];
          threadMetadata = { threadId: message.threadId, latestMessageId: latest.id,
            latestReceivedAt: new Date(Number(latest.internalDate)).toISOString(),
            latestSender: messageHeader(latest, 'From'), replyCount: Math.max(0, matching.length - 1) };
          const existingRow = threadRows.get(message.threadId) || linkValues.findIndex(row => matching.some(candidate => String(row[0]) === 'https://mail.google.com/mail/u/0/#all/' + candidate.id)) + 2;
          if (existingRow >= 2) {
            pendingNotes.set(existingRow, threadMetadata);
            threadRows.set(message.threadId, existingRow);
            matching.forEach(candidate => labelIds.add(candidate.id));
            return;
          }
          message = matching.find(candidate => Number(candidate.internalDate) >= midnight * 1000);
          if (!message) return;
          matching.forEach(candidate => labelIds.add(candidate.id));
        }
''' +s[b:]
s=s.replace("        known.add(firstUrl);", "        if (threadMetadata) {\n          const newRow = sheet.getLastRow() + rows.length;\n          pendingNotes.set(newRow, threadMetadata);\n          threadRows.set(threadMetadata.threadId, newRow);\n        }\n        known.add(firstUrl);")
s=s.replace("      // Label only after the sheet write succeeds.", "      pendingNotes.forEach((metadata, row) => sheet.getRange(row, 7).setNote(JSON.stringify(metadata)));\n      if (pendingNotes.size) SpreadsheetApp.flush();\n      // Label only after the sheet write succeeds.")
s=s.replace("// Each message gets a row; its Gmail message ID in Links prevents duplicate imports.", "// Each conversation keeps its original row; Links notes track incoming replies.")
s=s.replace("  const richText = range.getRichTextValues();", "  const richText = range.getRichTextValues();\n  const notes = typeof range.getNotes === 'function' ? range.getNotes() : [];")
s=s.replace("    return { timestamp: row[0], reference:", "    let thread = {};\n    try { thread = JSON.parse(notes[index]?.[6] || '{}') || {}; } catch (error) { /* Legacy note. */ }\n    return { threadId: thread.threadId || '', latestMessageId: thread.latestMessageId || '', latestReceivedAt: thread.latestReceivedAt || '', latestSender: thread.latestSender || '', replyCount: thread.replyCount || 0, timestamp: row[0], reference:")
p.write_text(s)
p=Path('src/pages/EmailPage.jsx');s=p.read_text();s=s.replace("  const [attempt, setAttempt]", "  const [seenReplies, setSeenReplies] = useState(() => { try { return JSON.parse(localStorage.getItem('op-email-seen-replies') || '{}') } catch { return {} } })\n  function openConversation(email) {\n    const next = { ...seenReplies, [email.link]: email.latestMessageId };\n    setSeenReplies(next);\n    try { localStorage.setItem('op-email-seen-replies', JSON.stringify(next)) } catch { /* Storage is optional. */ }\n  }\n  const [attempt, setAttempt]")
s=s.replace("const sender = String(email.receivedFrom || '')", "const sender = String(email.receivedFrom || '')")
s=s.replace("Date.parse(String(email.dateReceived || '')", "Date.parse(String(email.latestReceivedAt || email.dateReceived || '')")
s=s.replace("<td data-label=\"Date Received\">{email.dateReceived}</td>", "<td data-label=\"Date Received\">{email.dateReceived}{email.replyCount > 0 && <small className=\"email-reply-details\">Last reply: {new Date(email.latestReceivedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</small>}</td>")
s=s.replace("<EmailText value={email.subject} /></td>", "<EmailText value={email.subject} />{email.replyCount > 0 && <div className=\"email-reply-details\">{seenReplies[email.link] !== email.latestMessageId && <span className=\"email-reply-badge\">New reply</span>}<span>{email.replyCount} {email.replyCount === 1 ? 'reply' : 'replies'}</span><span>Latest sender: {email.latestSender}</span></div>}</td>")
s=s.replace('rel="noopener noreferrer">Open email', 'rel="noopener noreferrer" onClick={() => openConversation(email)}>Open conversation')
p.write_text(s)
p=Path('src/pages/EmailPage.css');s=p.read_text();s+='\n.email-reply-details { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; font-size: 12px; color: #70666a; }\n.email-reply-badge { align-self: center; padding: 3px 8px; border-radius: 12px; background: #e6f4eb; color: #25613b; font-weight: 700; }\n';p.write_text(s)
