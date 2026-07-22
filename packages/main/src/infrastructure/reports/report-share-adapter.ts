export interface ShareReportInput {
  readonly filename: string;
  readonly mimeType: string;
  readonly blob: Blob;
  readonly title: string;
  readonly text?: string;
}

export type ShareReportResult =
  | { readonly status: "shared" }
  | { readonly status: "cancelled" }
  | { readonly status: "unsupported"; readonly downloaded: boolean }
  | { readonly status: "downloaded" };

export interface ReportShareAdapter {
  canShareFiles(): Promise<boolean>;
  share(input: ShareReportInput): Promise<ShareReportResult>;
  download(input: ShareReportInput): Promise<void>;
}

function triggerBrowserDownload(input: ShareReportInput): void {
  const url = URL.createObjectURL(input.blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = input.filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Revoke after the click has a chance to start the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}

async function tryCapacitorShare(
  input: ShareReportInput,
): Promise<ShareReportResult | null> {
  const capacitor = (
    globalThis as {
      Capacitor?: { isNativePlatform?: () => boolean };
      CapacitorShare?: {
        share: (options: {
          title?: string;
          text?: string;
          files?: string[];
        }) => Promise<void>;
      };
    }
  ).Capacitor;
  const sharePlugin = (
    globalThis as {
      CapacitorShare?: {
        share: (options: {
          title?: string;
          text?: string;
          dialogTitle?: string;
        }) => Promise<void>;
      };
    }
  ).CapacitorShare;

  if (!capacitor?.isNativePlatform?.() || sharePlugin === undefined) {
    return null;
  }
  try {
    await sharePlugin.share({
      title: input.title,
      text: input.text ?? input.filename,
      dialogTitle: input.title,
    });
    return { status: "shared" };
  } catch (error) {
    if (isShareCancellation(error)) {
      return { status: "cancelled" };
    }
    throw error;
  }
}

function isShareCancellation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("abort") ||
    message.includes("cancel") ||
    error.name === "AbortError"
  );
}

export class BrowserReportShareAdapter implements ReportShareAdapter {
  async canShareFiles(): Promise<boolean> {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      return false;
    }
    if (typeof navigator.canShare !== "function") {
      return false;
    }
    try {
      const file = new File(["probe"], "probe.txt", { type: "text/plain" });
      return navigator.canShare({ files: [file] });
    } catch {
      return false;
    }
  }

  async download(input: ShareReportInput): Promise<void> {
    triggerBrowserDownload(input);
  }

  async share(input: ShareReportInput): Promise<ShareReportResult> {
    const native = await tryCapacitorShare(input);
    if (native !== null) {
      return native;
    }

    if (await this.canShareFiles()) {
      try {
        const file = new File([input.blob], input.filename, {
          type: input.mimeType,
        });
        await navigator.share({
          title: input.title,
          text: input.text,
          files: [file],
        });
        return { status: "shared" };
      } catch (error) {
        if (isShareCancellation(error)) {
          return { status: "cancelled" };
        }
        // Fall through to download.
      }
    }

    await this.download(input);
    return { status: "unsupported", downloaded: true };
  }
}

export class MemoryReportShareAdapter implements ReportShareAdapter {
  readonly shared: ShareReportInput[] = [];
  readonly downloaded: ShareReportInput[] = [];
  canShareFilesResult = true;
  nextShareResult: ShareReportResult = { status: "shared" };

  async canShareFiles(): Promise<boolean> {
    return this.canShareFilesResult;
  }

  async download(input: ShareReportInput): Promise<void> {
    this.downloaded.push(input);
  }

  async share(input: ShareReportInput): Promise<ShareReportResult> {
    if (this.nextShareResult.status === "shared") {
      this.shared.push(input);
    }
    if (this.nextShareResult.status === "unsupported") {
      this.downloaded.push(input);
    }
    if (this.nextShareResult.status === "downloaded") {
      this.downloaded.push(input);
    }
    return this.nextShareResult;
  }
}

export function createBrowserReportShareAdapter(): ReportShareAdapter {
  return new BrowserReportShareAdapter();
}
