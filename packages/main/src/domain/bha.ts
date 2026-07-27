export const BARREL_STYLES = ["STANDARD", "FLEXI", "CHROME"] as const;
export type BarrelStyle = (typeof BARREL_STYLES)[number];

export const REAMER_STYLES = ["BLANK", "STANDARD", "OVERSIZE"] as const;
export type ReamerStyle = (typeof REAMER_STYLES)[number];

export function formatBarrelStyle(style: BarrelStyle | undefined): string {
  if (!style) return "Not set";
  switch (style) {
    case "STANDARD":
      return "Standard";
    case "FLEXI":
      return "Flexi";
    case "CHROME":
      return "Chrome";
  }
}

export function formatReamerStyle(style: ReamerStyle | undefined): string {
  if (!style) return "Not set";
  switch (style) {
    case "BLANK":
      return "Blank";
    case "STANDARD":
      return "Standard";
    case "OVERSIZE":
      return "Oversize";
  }
}

export function isBarrelStyle(value: string): value is BarrelStyle {
  return (BARREL_STYLES as readonly string[]).includes(value);
}

export function isReamerStyle(value: string): value is ReamerStyle {
  return (REAMER_STYLES as readonly string[]).includes(value);
}
