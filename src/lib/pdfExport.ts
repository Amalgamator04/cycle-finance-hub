import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportElementToPdf(el: HTMLElement, filename: string, title: string, meta: string[]) {
  // Resolve CSS variable colors that html2canvas can't parse (oklch/hsl(var(--...)))
  const bg = getComputedStyle(document.body).backgroundColor || "#0b1020";
  const canvas = await html2canvas(el, {
    backgroundColor: bg,
    scale: 2,
    useCORS: true,
    windowWidth: el.scrollWidth,
  });

  const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 32;

  // Header
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pageW, 70, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(title, margin, 36);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  meta.forEach((m, i) => pdf.text(m, margin, 52 + i * 12));

  // Image
  const imgData = canvas.toDataURL("image/png");
  const imgW = pageW - margin * 2;
  const imgH = (canvas.height * imgW) / canvas.width;

  let remaining = imgH;
  let yOffset = 90;
  let sourceY = 0;
  const availableFirst = pageH - yOffset - margin;

  if (imgH <= availableFirst) {
    pdf.addImage(imgData, "PNG", margin, yOffset, imgW, imgH);
  } else {
    // Slice across pages
    const pxPerPt = canvas.width / imgW;
    let firstChunkPt = availableFirst;
    let firstChunkPx = firstChunkPt * pxPerPt;

    const drawSlice = (sy: number, sh: number, dy: number, dh: number) => {
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sh;
      const ctx = slice.getContext("2d")!;
      ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
      pdf.addImage(slice.toDataURL("image/png"), "PNG", margin, dy, imgW, dh);
    };

    drawSlice(0, firstChunkPx, yOffset, firstChunkPt);
    sourceY = firstChunkPx;
    remaining = imgH - firstChunkPt;

    while (remaining > 0) {
      pdf.addPage();
      const pageAvail = pageH - margin * 2;
      const chunkPt = Math.min(pageAvail, remaining);
      const chunkPx = chunkPt * pxPerPt;
      drawSlice(sourceY, chunkPx, margin, chunkPt);
      sourceY += chunkPx;
      remaining -= chunkPt;
    }
  }

  pdf.save(filename);
}
