import { getStore } from "@netlify/blobs";
import { calculateTotal, products } from "../../catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORE_NAME = "kipa-kedma-reservations";
const RESERVED_PREFIX = "reserved/";
const REQUEST_PREFIX = "requests/";

type ReservationPayload = {
  name?: string;
  phone?: string;
  note?: string;
  skus?: string[];
};

type ReservationRecord = {
  id: string;
  customerName: string;
  phone: string;
  note: string;
  skus: string[];
  total: number;
  status: "pending";
  createdAt: string;
};

function reservationsStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function reservationKey(sku: string) {
  return `${RESERVED_PREFIX}${sku}`;
}

export async function GET() {
  try {
    const store = reservationsStore();
    const result = await store.list({ prefix: RESERVED_PREFIX });

    return Response.json(
      {
        reservedSkus: result.blobs.map(({ key }) =>
          key.slice(RESERVED_PREFIX.length),
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Availability is temporarily unavailable" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const reservedByThisRequest: string[] = [];

  try {
    const payload = (await request.json()) as ReservationPayload;
    const name = payload.name?.trim().slice(0, 120) ?? "";
    const phone = payload.phone?.trim().slice(0, 40) ?? "";
    const note = payload.note?.trim().slice(0, 500) ?? "";
    const skus = [...new Set(payload.skus ?? [])];
    const knownProducts = skus
      .map((sku) => products.find((product) => product.sku === sku))
      .filter((product) => product !== undefined);

    if (name.length < 2) {
      return Response.json({ error: "יש להזין שם מלא." }, { status: 400 });
    }
    if (phone.replace(/\D/g, "").length < 9) {
      return Response.json(
        { error: "יש להזין מספר טלפון תקין." },
        { status: 400 },
      );
    }
    if (!skus.length || knownProducts.length !== skus.length) {
      return Response.json(
        { error: "יש לבחור לפחות כיפה אחת זמינה." },
        { status: 400 },
      );
    }

    const store = reservationsStore();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const total = calculateTotal(knownProducts);
    const record: ReservationRecord = {
      id,
      customerName: name,
      phone,
      note,
      skus,
      total,
      status: "pending",
      createdAt,
    };

    for (const sku of skus) {
      const result = await store.setJSON(
        reservationKey(sku),
        { requestId: id, createdAt },
        { onlyIfNew: true },
      );

      if (!result.modified) {
        await Promise.all(
          reservedByThisRequest.map((reservedSku) =>
            store.delete(reservationKey(reservedSku)),
          ),
        );

        return Response.json(
          {
            error:
              "אחת הכיפות כבר נבחרה על ידי מישהו אחר. עדכנו את הבחירה ונסו שוב.",
            unavailableSkus: [sku],
          },
          { status: 409 },
        );
      }

      reservedByThisRequest.push(sku);
    }

    await store.setJSON(`${REQUEST_PREFIX}${id}`, record, { onlyIfNew: true });

    return Response.json({ requestId: id, total }, { status: 201 });
  } catch {
    if (reservedByThisRequest.length) {
      try {
        const store = reservationsStore();
        await Promise.all(
          reservedByThisRequest.map((sku) =>
            store.delete(reservationKey(sku)),
          ),
        );
      } catch {
        // Preserve the original response if cleanup itself fails.
      }
    }

    return Response.json(
      { error: "לא הצלחנו לשמור את הבקשה. נסו שוב בעוד רגע." },
      { status: 500 },
    );
  }
}
