import { getStore } from "@netlify/blobs";
import { products } from "../../../catalog";
import {
  isAdminRequest,
  requestHasValidOrigin,
} from "../../../../lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORE_NAME = "kipa-kedma-reservations";

type ReservationRequest = {
  id: string;
  customerName: string;
  phone: string;
  note: string;
  skus: string[];
  total: number;
  status: "pending";
  createdAt: string;
};

type ReservedItem = {
  requestId: string;
  createdAt: string;
};

type ReleasedItem = ReservedItem & {
  sku: string;
  releasedAt: string;
};

function reservationsStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

async function readEntries<T>(
  store: ReturnType<typeof reservationsStore>,
  prefix: string,
) {
  const { blobs } = await store.list({ prefix });
  const records = await Promise.all(
    blobs.map(async ({ key }) => ({
      key,
      data: (await store.get(key, { type: "json" })) as T | null,
    })),
  );
  return records.filter(
    (record): record is { key: string; data: T } => record.data !== null,
  );
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ authenticated: false }, { status: 401 });
  }

  const store = reservationsStore();
  const [requestEntries, reservedEntries, releaseEntries] = await Promise.all([
    readEntries<ReservationRequest>(store, "requests/"),
    readEntries<ReservedItem>(store, "reserved/"),
    readEntries<ReleasedItem>(store, "releases/"),
  ]);

  const requests = requestEntries
    .map(({ data }) => data)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const reserved = reservedEntries
    .map(({ key, data }) => ({
      sku: key.slice("reserved/".length),
      ...data,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const releases = releaseEntries
    .map(({ data }) => data)
    .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));

  return Response.json(
    { authenticated: true, requests, reserved, releases },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  if (!requestHasValidOrigin(request)) {
    return Response.json({ error: "הבקשה נדחתה." }, { status: 403 });
  }
  if (!isAdminRequest(request)) {
    return Response.json({ authenticated: false }, { status: 401 });
  }

  const payload = (await request.json()) as { sku?: string };
  const sku = payload.sku?.trim() ?? "";
  if (!products.some((product) => product.sku === sku)) {
    return Response.json({ error: "מק״ט לא מוכר." }, { status: 400 });
  }

  const store = reservationsStore();
  const reservationKey = `reserved/${sku}`;
  const reservation = (await store.get(reservationKey, {
    type: "json",
  })) as ReservedItem | null;
  if (!reservation) {
    return Response.json({ error: "הכיפה כבר פעילה." }, { status: 404 });
  }

  const releasedAt = new Date().toISOString();
  await store.setJSON(`releases/${crypto.randomUUID()}`, {
    sku,
    requestId: reservation.requestId,
    createdAt: reservation.createdAt,
    releasedAt,
  } satisfies ReleasedItem);
  await store.delete(reservationKey);

  return Response.json({ reactivatedSku: sku });
}
