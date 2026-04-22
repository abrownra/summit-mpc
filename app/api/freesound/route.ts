import { NextRequest, NextResponse } from "next/server";

// Internet Archive — fully open, no API key required

type Mode = "oneshot" | "loop" | "song";

interface IAFile {
  name: string;
  format?: string;
  length?: string;
  size?: string;
}

interface IASearchDoc {
  identifier: string;
  title?: string;
  creator?: string;
}

// Build search query per mode
function buildQuery(q: string, mode: Mode): string {
  const base = `(${q}) AND mediatype:audio`;
  if (mode === "oneshot") return `${base} AND format:MP3 AND avg_rating:[3 TO 5]`;
  if (mode === "loop")    return `${base} AND (subject:loop OR subject:"drum loop" OR subject:"sample") AND format:MP3`;
  return `${base} AND format:MP3`;
}

async function resolveAudioUrl(identifier: string): Promise<{ url: string; duration: number } | null> {
  try {
    const res = await fetch(`https://archive.org/metadata/${identifier}/files`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data: { result: IAFile[] } = await res.json();
    const files: IAFile[] = data.result ?? [];

    // Prefer MP3, fallback to OGG
    const audio = files.find((f) => f.name.toLowerCase().endsWith(".mp3"))
      ?? files.find((f) => ["ogg", "flac", "wav"].some((ext) => f.name.toLowerCase().endsWith(ext)));

    if (!audio) return null;

    const encodedName = audio.name.split("/").map(encodeURIComponent).join("/");
    return {
      url: `https://archive.org/download/${identifier}/${encodedName}`,
      duration: audio.length ? parseFloat(audio.length) : 0,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") || "";
  const mode = (searchParams.get("mode") || "oneshot") as Mode;
  const page = parseInt(searchParams.get("page") || "1");

  if (!query.trim()) {
    return NextResponse.json({ results: [], next: false });
  }

  const rows = 10; // fetch 10, some may have no audio
  const start = (page - 1) * rows;

  const iaParams = new URLSearchParams({
    q: buildQuery(query, mode),
    "fl[]": "identifier,title,creator",
    rows: String(rows),
    start: String(start),
    output: "json",
    "sort[]": "downloads desc",
  });

  const searchRes = await fetch(
    `https://archive.org/advancedsearch.php?${iaParams}`,
    { signal: AbortSignal.timeout(8000) }
  );

  if (!searchRes.ok) {
    return NextResponse.json({ error: "Internet Archive search failed" }, { status: 502 });
  }

  const searchData = await searchRes.json();
  const docs: IASearchDoc[] = searchData.response?.docs ?? [];

  // Resolve audio URLs in parallel
  const resolved = await Promise.all(
    docs.map(async (doc) => {
      const audio = await resolveAudioUrl(doc.identifier);
      if (!audio) return null;
      return {
        id: doc.identifier,
        name: doc.title || doc.identifier,
        duration: audio.duration,
        username: doc.creator || "Internet Archive",
        previews: {
          "preview-hq-mp3": audio.url,
          "preview-lq-mp3": audio.url,
        },
        tags: [],
      };
    })
  );

  const results = resolved.filter(Boolean);

  return NextResponse.json({
    results,
    next: docs.length === rows,
  });
}
