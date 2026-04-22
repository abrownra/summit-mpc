import { NextRequest, NextResponse } from "next/server";

const FREESOUND_BASE = "https://freesound.org/apiv2";
const TOKEN = process.env.FREESOUND_API_KEY;

export async function GET(req: NextRequest) {
  if (!TOKEN) {
    return NextResponse.json({ error: "FREESOUND_API_KEY not set" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") || "";
  const mode = searchParams.get("mode") || "oneshot"; // oneshot | loop | song
  const page = searchParams.get("page") || "1";

  // Duration filters per mode
  const durationFilter: Record<string, string> = {
    oneshot: "duration:[0.1 TO 3]",
    loop:    "duration:[2 TO 45]",
    song:    "duration:[30 TO 600]",
  };

  // Tag filters to bias results
  const tagFilter: Record<string, string> = {
    oneshot: "",
    loop:    "tag:loop",
    song:    "",
  };

  const filter = [durationFilter[mode], tagFilter[mode]].filter(Boolean).join(" ");

  const params = new URLSearchParams({
    query,
    filter,
    fields: "id,name,duration,previews,tags,username",
    page_size: "15",
    page,
    token: TOKEN,
  });

  const res = await fetch(`${FREESOUND_BASE}/search/text/?${params}`);
  if (!res.ok) {
    return NextResponse.json({ error: "Freesound API error" }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
