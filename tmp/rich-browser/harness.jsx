import React from 'react'
import { createRoot } from 'react-dom/client'
import CreateDocument from '/src/components/CreateDocument.jsx'
import '/src/pages/Dashboard.css'
import '/src/index.css'
createRoot(document.getElementById('root')).render(<CreateDocument isOpen page onClose={() => {}} onCreate={async data => { window.savedBody = data; return { id: 'TEST', url: '#', type: data.type } }} />)
