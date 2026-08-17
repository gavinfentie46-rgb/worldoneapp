import { getDatabase } from "@netlify/database";
import type { Config } from "@netlify/functions";

const KINDS = ["App", "Website", "Backend", "Fix"] as const;
const PAYOUTS: Record<string, number> = {
  App: 50000,
  Website: 12000,
  Backend: 30000,
  Fix: 5000,
};
const NEXT_STATUS: Record<string, string> = {
  queued: "building",
  building: "deployed",
};

type BuildRow = {
  id: number;
  project: string;
  kind: string;
  stack: string;
  notes: string;
  status: string;
  payout: number;
};

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const parseId = (value: unknown) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const summarize = (builds: BuildRow[]) => ({
  total: builds.length,
  building: builds.filter((build) => build.status === "building").length,
  deployed: builds.filter((build) => build.status === "deployed").length,
  payout: builds.reduce((sum, build) => sum + (build.payout || 0), 0),
});

export default async (req: Request) => {
  const db = getDatabase();

  const respondWithQueue = async () => {
    const builds = (await db.sql`
      SELECT id, project, kind, stack, notes, status, payout
      FROM builds
      ORDER BY created_at DESC, id DESC
    `) as BuildRow[];

    return Response.json({ builds, stats: summarize(builds) });
  };

  try {
    if (req.method === "GET") {
      return await respondWithQueue();
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const project = clean(body.project, 80);

      if (!project) {
        return Response.json({ error: "A project name is required." }, { status: 400 });
      }

      const kind = KINDS.includes(body.kind) ? body.kind : "App";

      await db.sql`
        INSERT INTO builds (project, kind, stack, notes, status, payout)
        VALUES (
          ${project},
          ${kind},
          ${clean(body.stack, 120)},
          ${clean(body.notes, 500)},
          ${"queued"},
          ${PAYOUTS[kind] ?? 0}
        )
      `;

      return await respondWithQueue();
    }

    if (req.method === "PATCH") {
      const body = await req.json().catch(() => ({}));
      const id = parseId(body.id);

      if (!id) {
        return Response.json({ error: "A valid build id is required." }, { status: 400 });
      }

      const [current] = (await db.sql`
        SELECT status FROM builds WHERE id = ${id}
      `) as { status: string }[];

      if (!current) {
        return Response.json({ error: "That build no longer exists." }, { status: 404 });
      }

      const next = NEXT_STATUS[current.status];

      if (next) {
        await db.sql`UPDATE builds SET status = ${next} WHERE id = ${id}`;
      }

      return await respondWithQueue();
    }

    if (req.method === "DELETE") {
      const id = parseId(new URL(req.url).searchParams.get("id"));

      if (!id) {
        return Response.json({ error: "A valid build id is required." }, { status: 400 });
      }

      await db.sql`DELETE FROM builds WHERE id = ${id}`;

      return await respondWithQueue();
    }

    return Response.json({ error: "Method not allowed." }, { status: 405 });
  } catch (error) {
    console.error("builds endpoint failed", error);
    return Response.json({ error: "The build service hit a problem." }, { status: 500 });
  }
};

export const config: Config = {
  path: "/api/builds",
};
