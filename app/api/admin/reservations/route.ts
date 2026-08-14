import { productColorFamilies, type Product } from "../../../catalog";
import {
  catalogStore,
  clearProductReservation,
  loadCatalogProducts,
  loadProductReservations,
  productOverrideKey,
  reservationsStore,
  type ProductOverride,
} from "../../../../lib/catalog-store";
import {
  isAdminRequest,
  requestHasValidOrigin,
} from "../../../../lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReservationRequest = {
  id: string;
  customerName: string;
  phone: string;
  note: string;
  productIds?: string[];
  skus: string[];
  total: number;
  status: "pending";
  createdAt: string;
};

type ReleasedItem = {
  productId?: string;
  sku: string;
  requestId: string;
  createdAt: string;
  releasedAt: string;
};

type ProductUpdatePayload = {
  id?: string;
  name?: string;
  sku?: string;
  diameter?: number;
  price?: number;
  colorFamily?: string;
};

type ProductStatusPayload = {
  id?: string;
  active?: boolean;
};

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

function publicAdminProduct(
  product: Product,
  reservation?: { requestId: string; createdAt: string },
) {
  return {
    ...product,
    reserved: Boolean(reservation),
    available: product.enabled && !reservation,
    reservation: reservation ?? null,
  };
}

function productOverride(product: Product, updatedAt: string): ProductOverride {
  return {
    name: product.name,
    sku: product.sku,
    diameter: product.diameter,
    price: product.price,
    colorFamily: product.colorFamily,
    enabled: product.enabled,
    updatedAt,
  };
}

function requireMutationAccess(request: Request) {
  if (!requestHasValidOrigin(request)) {
    return Response.json({ error: "הבקשה נדחתה." }, { status: 403 });
  }
  if (!isAdminRequest(request)) {
    return Response.json({ authenticated: false }, { status: 401 });
  }
  return null;
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ authenticated: false }, { status: 401 });
  }

  const store = reservationsStore();
  const [products, requestEntries, releaseEntries] = await Promise.all([
    loadCatalogProducts(),
    readEntries<ReservationRequest>(store, "requests/"),
    readEntries<ReleasedItem>(store, "releases/"),
  ]);
  const reservations = await loadProductReservations(products);
  const reservationsByProductId = new Map(
    reservations.map((reservation) => [reservation.productId, reservation]),
  );

  const requests = requestEntries
    .map(({ data }) => data)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const releases = releaseEntries
    .map(({ data }) => data)
    .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));

  return Response.json(
    {
      authenticated: true,
      products: products.map((product) =>
        publicAdminProduct(product, reservationsByProductId.get(product.id)),
      ),
      requests,
      releases,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH(request: Request) {
  const accessError = requireMutationAccess(request);
  if (accessError) return accessError;

  const payload = (await request.json()) as ProductUpdatePayload;
  const id = payload.id?.trim() ?? "";
  const name = payload.name?.trim().slice(0, 80) ?? "";
  const sku = payload.sku?.trim().toUpperCase().slice(0, 32) ?? "";
  const diameter = Number(payload.diameter);
  const price = Number(payload.price);
  const colorFamily = payload.colorFamily?.trim() ?? "";
  const products = await loadCatalogProducts();
  const current = products.find((product) => product.id === id);

  if (!current) {
    return Response.json({ error: "הכיפה לא נמצאה." }, { status: 404 });
  }
  if (name.length < 2) {
    return Response.json({ error: "יש להזין שם באורך שני תווים לפחות." }, { status: 400 });
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._-]{1,31}$/u.test(sku)) {
    return Response.json(
      { error: "המק״ט יכול לכלול אותיות, מספרים, נקודה, קו תחתון ומקף." },
      { status: 400 },
    );
  }
  if (
    products.some(
      (product) => product.id !== id && product.sku.toUpperCase() === sku,
    )
  ) {
    return Response.json({ error: "המק״ט כבר משויך לכיפה אחרת." }, { status: 409 });
  }
  if (!Number.isFinite(diameter) || diameter < 1 || diameter > 50) {
    return Response.json({ error: "הקוטר צריך להיות בין 1 ל-50 ס״מ." }, { status: 400 });
  }
  if (!Number.isInteger(price) || price < 1 || price > 5000) {
    return Response.json({ error: "המחיר צריך להיות מספר שלם בין 1 ל-5000." }, { status: 400 });
  }
  if (!(productColorFamilies as readonly string[]).includes(colorFamily)) {
    return Response.json({ error: "יש לבחור קטגוריית צבע תקינה." }, { status: 400 });
  }

  const updatedAt = new Date().toISOString();
  const nextProduct: Product = {
    ...current,
    name,
    sku,
    diameter,
    price,
    colorFamily,
    specialPrice: price !== 40,
  };
  const store = catalogStore();
  await store.setJSON(
    productOverrideKey(id),
    productOverride(nextProduct, updatedAt),
  );
  await store.setJSON(`changes/${crypto.randomUUID()}`, {
    action: "edit",
    productId: id,
    before: productOverride(current, updatedAt),
    after: productOverride(nextProduct, updatedAt),
    createdAt: updatedAt,
  });

  const reservations = await loadProductReservations([nextProduct]);
  return Response.json({
    product: publicAdminProduct(nextProduct, reservations[0]),
  });
}

export async function PUT(request: Request) {
  const accessError = requireMutationAccess(request);
  if (accessError) return accessError;

  const payload = (await request.json()) as ProductStatusPayload;
  const id = payload.id?.trim() ?? "";
  const active = payload.active;
  const products = await loadCatalogProducts();
  const current = products.find((product) => product.id === id);

  if (!current || typeof active !== "boolean") {
    return Response.json({ error: "בקשת העדכון אינה תקינה." }, { status: 400 });
  }

  const updatedAt = new Date().toISOString();
  const nextProduct: Product = { ...current, enabled: active };
  const store = catalogStore();
  await store.setJSON(
    productOverrideKey(id),
    productOverride(nextProduct, updatedAt),
  );

  let releasedReservations: Awaited<ReturnType<typeof clearProductReservation>> = [];
  if (active) {
    releasedReservations = await clearProductReservation(current);
    const reservationStore = reservationsStore();
    await Promise.all(
      releasedReservations.map((reservation) =>
        reservationStore.setJSON(`releases/${crypto.randomUUID()}`, {
          productId: id,
          sku: current.sku,
          requestId: reservation.requestId,
          createdAt: reservation.createdAt,
          releasedAt: updatedAt,
        } satisfies ReleasedItem),
      ),
    );
  }

  await store.setJSON(`changes/${crypto.randomUUID()}`, {
    action: active ? "activate" : "deactivate",
    productId: id,
    before: { enabled: current.enabled },
    after: { enabled: active },
    releasedReservationCount: releasedReservations.length,
    createdAt: updatedAt,
  });

  return Response.json({
    product: publicAdminProduct(nextProduct),
  });
}

export async function DELETE(request: Request) {
  const accessError = requireMutationAccess(request);
  if (accessError) return accessError;

  const payload = (await request.json()) as { id?: string; sku?: string };
  const products = await loadCatalogProducts();
  const product = products.find(
    (item) => item.id === payload.id || item.sku === payload.sku,
  );
  if (!product) {
    return Response.json({ error: "מק״ט לא מוכר." }, { status: 400 });
  }

  const released = await clearProductReservation(product);
  if (!released.length) {
    return Response.json({ error: "הכיפה כבר פעילה." }, { status: 404 });
  }

  const releasedAt = new Date().toISOString();
  const store = reservationsStore();
  await Promise.all(
    released.map((reservation) =>
      store.setJSON(`releases/${crypto.randomUUID()}`, {
        productId: product.id,
        sku: product.sku,
        requestId: reservation.requestId,
        createdAt: reservation.createdAt,
        releasedAt,
      } satisfies ReleasedItem),
    ),
  );

  return Response.json({ reactivatedProductId: product.id });
}
