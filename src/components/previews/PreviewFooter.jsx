export default function PreviewFooter() {
  return <footer className="mt-auto pt-12" aria-label="Document footer">
    <div className="relative border-0 border-t border-solid border-[#434b52] pt-6 pb-4 pr-[76px] text-center text-[#46566c]">
      <p className="m-0 text-[11px] leading-[1.6]">J.H. Cerilles State College, Mati, San Miguel, Zamboanga del Sur, Philippines</p>
      <p className="m-0 text-[10px] leading-[1.6] italic">Tel. No. +63 915 2484 538 | Email: main@jhcsc.edu.ph | Website: jhcsc.edu.ph</p>
      <img src="/jhcsc-website-qr.svg" alt="QR code for the J.H. Cerilles State College website" width="48" height="48" className="absolute right-5 top-6 h-[48px] w-[48px]" />
      <span className="absolute right-0 bottom-0 text-[11px]" data-page-number="current" aria-label="Page 1">1</span>
    </div>
  </footer>
}
