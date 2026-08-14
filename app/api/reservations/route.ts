import { calculateTotal } from "../../catalog";
import {
  findProductReservation,
  loadCatalogProducts,
  loadProductReservations,
  reservationKeyForProduct,
  reservationsStore,
} from "../../../lib/catalog-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUEST_PREFIX = "requests/";

type ReservationPayload = {
  name?: string;
  phone?: string;
  note?: string;
  productIds?: string[];
  skus?: string[];
};

type ReservationRecord = {
  id: string;
  customerName: string;
  phone: string;
  note: string;
  productIds: string[];
  skus: string[];
  total: number;
  status: "pending";
  createdAt: string;
};

export async function GET() {
  try {
    const products = await loadCatalogProducts();
    const reservations = await loadProductReservations(products);
    const reservedIds = new Set(
      reservations.map((reservation) => reservation.productId),
    );

    return Response.json(
      {
        unavailableProductIds: [...reservedIds],
        reservedSkus: products
          .filter((product) => reservedIds.has(product.id))
          .map((product) => product.sku),
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
    const products = await loadCatalogProducts();
    const requestedIds = payload.productIds?.length
      ? [...new Set(payload.productIds)]
      : [
          ...new Set(
            (payload.skus ?? [])
              .map((sku) => products.find((product) => product.sku === sku)?.id)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
    const knownProducts = requestedIds
      .map((id) => products.find((product) => product.id === id))
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
    if (
      !requestedIds.length ||
      knownProducts.length !== requestedIds.length ||
      knownProducts.some((product) => !product.enabled)
    ) {
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
      productIds: knownProducts.map((product) => product.id),
      skus: knownProducts.map((product) => product.sku),
      total,
      status: "pending",
      createdAt,
    };

    for (const product of knownProducts) {
      const existingReservation = await findProductReservation(product);
      if (existingReservation) {
        await Promise.all(
          reservedByThisRequest.map((key) => store.delete(key)),
        );
        return Response.json(
          {
            error:
              "אחת הכיפות כבר נבחרה על ידי מישהו אחר. עדכנו את הבחירה ונסו שוב.",
            unavailableProductIds: [product.id],
            unavailableSkus: [product.sku],
          },
          { status: 409 },
        );
      }

      const key = reservationKeyForProduct(product.id);
      const result = await store.setJSON(
        key,
        { requestId: id, createdAt },
        { onlyIfNew: true },
      );

      if (!result.modified) {
        await Promise.all(
          reservedByThisRequest.map((reservedKey) => store.delete(reservedKey)),
        );
        return Response.json(
          {
            error:
              "אחת הכיפות כבר נבחרה על ידי מישהו אחר. עדכנו את הבחירה ונסו שוב.",
            unavailableProductIds: [product.id],
            unavailableSkus: [product.sku],
          },
          { status: 409 },
        );
      }

      reservedByThisRequest.push(key);
    }

    await store.setJSON(`${REQUEST_PREFIX}${id}`, record, { onlyIfNew: true });
    return Response.json({ requestId: id, total }, { status: 201 });
  } catch {
    if (reservedByThisRequest.length) {
      try {
        const store = reservationsStore();
        await Promise.all(
          reservedByThisRequest.map((key) => store.delete(key)),
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
