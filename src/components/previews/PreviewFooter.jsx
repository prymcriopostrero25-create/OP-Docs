export default function PreviewFooter() {
  return (
      <footer className="mt-auto pt-12" aria-label="Document footer">
        <div className="flex items-center gap-3 border-0 border-t border-solid border-[#434b52] pt-3 text-[#46566c] max-[600px]:gap-2">
          <div className="min-w-0 flex-1 text-[11px] leading-[1.6] text-center">
            <p className="m-0">J.H. Cerilles State College, Mati, San Miguel, Zamboanga del Sur, Philippines</p>
            <p className="m-0 text-[10px] italic">Tel. No. +63 915 2484 538 | Email: main@jhcsc.edu.ph | Website: jhcsc.edu.ph</p>
          </div>
          <img src="/jhcsc-website-qr.svg" alt="QR code for the J.H. Cerilles State College website" width="68" height="68" className="h-[48px] w-[48px] shrink-0" />
          <span className="shrink-0 text-[11px]" aria-label="Page 1">1</span>
        </div>
      </footer>
  )
}
