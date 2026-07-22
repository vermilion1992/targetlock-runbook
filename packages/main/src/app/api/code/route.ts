import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

const CODE_PREVIEW_PREFIX = "src/app/components/charts/";
const CODE_PREVIEW_ROOT = path.join(
  process.cwd(),
  "src",
  "app",
  "components",
  "charts",
);
const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

function resolveCodePreviewPath(file: string): string | null {
  const normalized = file.replaceAll("\\", "/");
  if (!normalized.startsWith(CODE_PREVIEW_PREFIX)) {
    return null;
  }

  const relativePath = normalized.slice(CODE_PREVIEW_PREFIX.length);
  const resolved = path.resolve(CODE_PREVIEW_ROOT, relativePath);
  const relativeToRoot = path.relative(CODE_PREVIEW_ROOT, resolved);
  if (
    relativeToRoot.length === 0 ||
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot) ||
    !ALLOWED_EXTENSIONS.has(path.extname(resolved))
  ) {
    return null;
  }

  return resolved;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const file = searchParams.get("file");

  if (file === null) {
    return NextResponse.json({ error: "file missing" }, { status: 400 });
  }

  const filePath = resolveCodePreviewPath(file);
  if (filePath === null) {
    return NextResponse.json(
      { error: "file is outside the code-preview source directory" },
      { status: 403 },
    );
  }

  try {
    const code = await readFile(filePath, "utf8");
    return new NextResponse(code, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }
}
