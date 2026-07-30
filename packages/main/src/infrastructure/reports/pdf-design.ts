import {
  rgb,
  type PDFPage,
  type PDFFont,
  type RGB,
} from "pdf-lib";

export const PDF_PAGE = {
  landscapeWidth: 841.89,
  landscapeHeight: 595.28,
  portraitWidth: 595.28,
  portraitHeight: 841.89,
  margin: 36,
  lineHeight: 12,
} as const;

export const PDF_THEME = {
  navy: rgb(0.035, 0.102, 0.196),
  navySoft: rgb(0.075, 0.17, 0.3),
  blue: rgb(0.055, 0.365, 0.73),
  blueBright: rgb(0.12, 0.52, 0.94),
  bluePale: rgb(0.91, 0.95, 0.99),
  surface: rgb(1, 1, 1),
  surfaceMuted: rgb(0.96, 0.975, 0.99),
  border: rgb(0.8, 0.85, 0.9),
  ink: rgb(0.07, 0.1, 0.14),
  inkMuted: rgb(0.33, 0.39, 0.47),
  success: rgb(0.055, 0.56, 0.36),
  successPale: rgb(0.9, 0.98, 0.94),
  warning: rgb(0.85, 0.45, 0.05),
  warningPale: rgb(1, 0.96, 0.85),
  danger: rgb(0.77, 0.12, 0.16),
  white: rgb(1, 1, 1),
} as const;

export function pdfSafeText(value: string): string {
  return value
    .replace(/→/g, "->")
    .replace(/–|—/g, "-")
    .replace(/…/g, "...")
    .replace(/·/g, "|")
    .replace(/°/g, " deg")
    .replace(/[^\x20-\x7E\n\r\t]/g, "?");
}

export function wrapPdfText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = pdfSafeText(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current.length > 0) lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines.length === 0 ? [""] : lines;
}

function fillRoundedRectangle(
  page: PDFPage,
  input: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly radius: number;
    readonly color: RGB;
  },
): void {
  const radius = Math.max(
    0,
    Math.min(input.radius, input.width / 2, input.height / 2),
  );
  page.drawRectangle({
    x: input.x + radius,
    y: input.y,
    width: input.width - radius * 2,
    height: input.height,
    color: input.color,
  });
  page.drawRectangle({
    x: input.x,
    y: input.y + radius,
    width: input.width,
    height: input.height - radius * 2,
    color: input.color,
  });
  for (const [x, y] of [
    [input.x + radius, input.y + radius],
    [input.x + input.width - radius, input.y + radius],
    [input.x + radius, input.y + input.height - radius],
    [input.x + input.width - radius, input.y + input.height - radius],
  ] as const) {
    page.drawCircle({ x, y, size: radius, color: input.color });
  }
}

export function drawRoundedCard(
  page: PDFPage,
  input: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly radius?: number;
    readonly color?: RGB;
    readonly borderColor?: RGB;
    readonly borderWidth?: number;
  },
): void {
  const radius = input.radius ?? 7;
  const borderWidth = input.borderWidth ?? 1;
  if (input.borderColor && borderWidth > 0) {
    fillRoundedRectangle(page, {
      ...input,
      radius,
      color: input.borderColor,
    });
    fillRoundedRectangle(page, {
      x: input.x + borderWidth,
      y: input.y + borderWidth,
      width: input.width - borderWidth * 2,
      height: input.height - borderWidth * 2,
      radius: Math.max(0, radius - borderWidth),
      color: input.color ?? PDF_THEME.surface,
    });
    return;
  }
  fillRoundedRectangle(page, {
    ...input,
    radius,
    color: input.color ?? PDF_THEME.surface,
  });
}

export function drawSectionHeading(
  page: PDFPage,
  bold: PDFFont,
  input: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly label: string;
  },
): void {
  page.drawRectangle({
    x: input.x,
    y: input.y - 3,
    width: 4,
    height: 16,
    color: PDF_THEME.blue,
  });
  page.drawText(pdfSafeText(input.label), {
    x: input.x + 11,
    y: input.y,
    size: 11,
    font: bold,
    color: PDF_THEME.navy,
    maxWidth: input.width - 11,
  });
}

export function statusColors(status: string): {
  readonly background: RGB;
  readonly foreground: RGB;
} {
  const normalized = status.toUpperCase();
  if (
    normalized.includes("COMPLETE") ||
    normalized.includes("ACTIVE") ||
    normalized.includes("GENERATED")
  ) {
    return {
      background: PDF_THEME.successPale,
      foreground: PDF_THEME.success,
    };
  }
  if (
    normalized.includes("SUSPEND") ||
    normalized.includes("REVIEW") ||
    normalized.includes("DRAFT")
  ) {
    return {
      background: PDF_THEME.warningPale,
      foreground: PDF_THEME.warning,
    };
  }
  if (normalized.includes("ABANDON") || normalized.includes("FAILED")) {
    return {
      background: rgb(1, 0.91, 0.91),
      foreground: PDF_THEME.danger,
    };
  }
  return {
    background: PDF_THEME.bluePale,
    foreground: PDF_THEME.blue,
  };
}

export function drawStatusPill(
  page: PDFPage,
  bold: PDFFont,
  input: {
    readonly x: number;
    readonly y: number;
    readonly label: string;
  },
): number {
  const safe = pdfSafeText(input.label.toUpperCase());
  const width = Math.max(54, bold.widthOfTextAtSize(safe, 8) + 18);
  const colors = statusColors(input.label);
  drawRoundedCard(page, {
    x: input.x,
    y: input.y,
    width,
    height: 20,
    radius: 10,
    color: colors.background,
  });
  page.drawText(safe, {
    x: input.x + 9,
    y: input.y + 6,
    size: 8,
    font: bold,
    color: colors.foreground,
  });
  return width;
}

export function drawBrandHeaderFooter(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  input: {
    readonly holeId: string;
    readonly reportLabel: string;
    readonly versionLabel: string;
    readonly generatedAt: string;
    readonly pageNumber: number;
    readonly pageCount: number;
    readonly width: number;
    readonly height: number;
  },
): void {
  const margin = PDF_PAGE.margin;
  page.drawText("TARGETLOCK", {
    x: margin,
    y: input.height - 24,
    size: 9,
    font: bold,
    color: PDF_THEME.blue,
  });
  page.drawText(
    pdfSafeText(`${input.holeId} | ${input.reportLabel} | ${input.versionLabel}`),
    {
      x: margin + 78,
      y: input.height - 24,
      size: 8,
      font,
      color: PDF_THEME.inkMuted,
    },
  );
  page.drawLine({
    start: { x: margin, y: input.height - 31 },
    end: { x: input.width - margin, y: input.height - 31 },
    thickness: 1,
    color: PDF_THEME.border,
  });

  page.drawLine({
    start: { x: margin, y: 29 },
    end: { x: input.width - margin, y: 29 },
    thickness: 1,
    color: PDF_THEME.border,
  });
  page.drawText(pdfSafeText(`Generated ${input.generatedAt} | Offline snapshot`), {
    x: margin,
    y: 17,
    size: 7.5,
    font,
    color: PDF_THEME.inkMuted,
  });
  const pageLabel = `Page ${input.pageNumber} of ${input.pageCount}`;
  page.drawText(pageLabel, {
    x: input.width - margin - font.widthOfTextAtSize(pageLabel, 7.5),
    y: 17,
    size: 7.5,
    font,
    color: PDF_THEME.inkMuted,
  });
}
