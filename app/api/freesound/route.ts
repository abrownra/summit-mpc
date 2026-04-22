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

function buildQuery(q: string, mode: Mode): string {
  if (mode === "oneshot") {
    // Require percussion/sample subject tags AND short audio — excludes speeches, albums, dialogues
    return (
      `(title:(${q}) OR subject:(${q})) AND mediatype:audio AND format:MP3` +
      ` AND (subject:(sample OR samples OR "drum sample" OR "drum samples" OR percussion` +
      ` OR "sound effect" OR "sound effects" OR sfx OR foley OR "drum kit" OR "drum machine"` +
      ` OR "one shot" OR "oneshot" OR "hit" OR "stab") OR collection:opensource_audio)`
    );
  }
  if (mode === "loop") {
    return (
      `(title:(${q}) OR subject:(${q})) AND mediatype:audio AND format:MP3` +
      ` AND (subject:(loop OR loops OR "drum loop" OR "beat" OR "instrumental" OR sample OR samples)` +
      ` OR title:(loop OR loops OR beat OR instrumental))`
    );
  }
  // songs — broad
  return `(${q}) AND mediatype:audio AND format:MP3`;
}

// Max duration per mode (seconds) — skip files longer than this
const MAX_DURATION: Partial<Record<Mode, number>> = {
  oneshot: 8,
};

async function resolveAudioUrl(
  identifier: string,
  maxDuration?: number
): Promise<{ url: string; duration: number } | null> {
  try {
    const res = await fetch(`https://archive.org/metadata/${identifier}/files`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data: { result: IAFile[] } = await res.json();
    const files: IAFile[] = data.result ?? [];

    // Prefer MP3, fallback to OGG/WAV
    const audio =
      files.find((f) => f.name.toLowerCase().endsWith(".mp3")) ??
      files.find((f) =>
        ["ogg", "wav"].some((ext) => f.name.toLowerCase().endsWith(ext))
      );

    if (!audio) return null;

    const duration = audio.length ? parseFloat(audio.length) : 0;

    // Enforce duration limit — rejects dialogues, speeches, full albums
    if (maxDuration && duration > 0 && duration > maxDuration) return null;

    const encodedName = audio.name
      .split("/")
      .map(encodeURIComponent)
      .join("/");

    return {
      url: `https://archive.org/download/${identifier}/${encodedName}`,
      duration,
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

  // Fetch more rows to compensate for ones filtered out by duration
  const rows = mode === "oneshot" ? 20 : 10;
  const start = (page - 1) * 10;

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
    return NextResponse.json(
      { error: "Internet Archive search failed" },
      { status: 502 }
    );
  }

  const searchData = await searchRes.json();
  const docs: IASearchDoc[] = searchData.response?.docs ?? [];

  const maxDuration = MAX_DURATION[mode];

  // Resolve audio URLs in parallel
  const resolved = await Promise.all(
    docs.map(async (doc) => {
      const audio = await resolveAudioUrl(doc.identifier, maxDuration);
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

  const results = resolved.filter(Boolean).slice(0, 10);

  return NextResponse.json({
    results,
    next: docs.length === rows,
  });
}
