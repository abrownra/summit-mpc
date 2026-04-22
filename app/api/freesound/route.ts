import { NextRequest, NextResponse } from "next/server";

// Jamendo: songs & loops — free key at developer.jamendo.com
const JAMENDO_ID = process.env.JAMENDO_CLIENT_ID;
// Pixabay: one-shots & sfx — free key at pixabay.com/api/docs/
const PIXABAY_KEY = process.env.PIXABAY_API_KEY;

type Mode = "oneshot" | "loop" | "song";

async function searchJamendo(query: string, mode: Mode, page: number) {
  if (!JAMENDO_ID) throw new Error("JAMENDO_CLIENT_ID not set");

  const offset = (page - 1) * 15;
  const params = new URLSearchParams({
    client_id: JAMENDO_ID,
    format: "json",
    limit: "15",
    offset: String(offset),
    namesearch: query,
    audioformat: "mp31",
    include: "musicinfo",
  });

  // Bias by duration for loops vs songs
  if (mode === "loop") {
    params.set("durationbetween", "10_120");
    params.set("tags", "loop");
  }

  const res = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params}`);
  if (!res.ok) throw new Error("Jamendo API error");
  const data = await res.json();

  return {
    results: data.results.map((t: {
      id: number; name: string; duration: number;
      artist_name: string; audio: string; tags?: string[];
    }) => ({
      id: `j_${t.id}`,
      name: t.name,
      duration: t.duration,
      username: t.artist_name,
      previews: { "preview-hq-mp3": t.audio, "preview-lq-mp3": t.audio },
      tags: t.tags ?? [],
    })),
    next: data.results.length === 15 ? true : false,
  };
}

async function searchPixabay(query: string, page: number) {
  if (!PIXABAY_KEY) throw new Error("PIXABAY_API_KEY not set");

  const params = new URLSearchParams({
    key: PIXABAY_KEY,
    q: query,
    media_type: "music",
    per_page: "15",
    page: String(page),
  });

  const res = await fetch(`https://pixabay.com/api/?${params}`);
  if (!res.ok) throw new Error("Pixabay API error");
  const data = await res.json();

  return {
    results: (data.hits ?? []).map((h: {
      id: number; tags: string; duration: number;
      user: string; audio?: string; previewURL?: string;
    }) => ({
      id: `p_${h.id}`,
      name: h.tags,
      duration: h.duration ?? 0,
      username: h.user,
      previews: {
        "preview-hq-mp3": h.audio ?? h.previewURL ?? "",
        "preview-lq-mp3": h.audio ?? h.previewURL ?? "",
      },
      tags: h.tags.split(", "),
    })),
    next: data.hits?.length === 15,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") || "";
  const mode = (searchParams.get("mode") || "oneshot") as Mode;
  const page = parseInt(searchParams.get("page") || "1");

  if (!query.trim()) {
    return NextResponse.json({ results: [], next: false });
  }

  try {
    // One-shots → Pixabay (short sfx); loops + songs → Jamendo
    const data = mode === "oneshot"
      ? await searchPixabay(query, page)
      : await searchJamendo(query, mode, page);

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
