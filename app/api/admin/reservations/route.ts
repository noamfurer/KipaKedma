import { type Product } from "../../../catalog";
import {
  catalogStore,
  clearProductReservation,
  loadCatalogCategories,
  loadCatalogProducts,
  loadProductReservations,
  productOverrideKey,
  reservationsStore,
  saveCatalogCategories,
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

type CategoryMutationPayload = {
  action?: "create" | "rename" | "delete";
  name?: string;
  previousName?: string;
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

function normalizeCategoryName(value?: string) {
  return value?.trim().replace(/\s+/g, " ").slice(0, 40) ?? "";
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ authenticated: false }, { status: 401 });
  }

  const store = reservationsStore();
  const [products, categories, requestEntries, releaseEntries] = await Promise.all([
    loadCatalogProducts(),
    loadCatalogCategories(),
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
      categories,
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
  const [products, categories] = await Promise.all([
    loadCatalogProducts(),
    loadCatalogCategories(),
  ]);
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
  if (!categories.includes(colorFamily)) {
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

export async function POST(request: Request) {
  const accessError = requireMutationAccess(request);
  if (accessError) return accessError;

  const payload = (await request.json()) as CategoryMutationPayload;
  const action = payload.action;
  const name = normalizeCategoryName(payload.name);
  const previousName = normalizeCategoryName(payload.previousName);
  const [categories, products] = await Promise.all([
    loadCatalogCategories(),
    loadCatalogProducts(),
  ]);

  if (!action || !["create", "rename", "delete"].includes(action)) {
    return Response.json({ error: "פעולת הקטגוריה אינה תקינה." }, { status: 400 });
  }
  if (name.length < 2) {
    return Response.json(
      { error: "שם הקטגוריה צריך לכלול לפחות שני תווים." },
      { status: 400 },
    );
  }
  if (name === "הכול") {
    return Response.json(
      { error: "השם ״הכול״ שמור למסנן הראשי." },
      { status: 400 },
    );
  }

  const store = catalogStore();
  const updatedAt = new Date().toISOString();
  let nextCategories = [...categories];

  if (action === "create") {
    if (categories.includes(name)) {
      return Response.json({ error: "קטגוריה בשם הזה כבר קיימת." }, { status: 409 });
    }
    nextCategories.push(name);
  }

  if (action === "rename") {
    if (!previousName || !categories.includes(previousName)) {
      return Response.json({ error: "הקטגוריה המקורית לא נמצאה." }, { status: 404 });
    }
    if (name !== previousName && categories.includes(name)) {
      return Response.json({ error: "קטגוריה בשם הזה כבר קיימת." }, { status: 409 });
    }
    if (name === previousName) {
      return Response.json({ categories });
    }

    const affectedProducts = products.filter(
      (product) => product.colorFamily === previousName,
    );
    await Promise.all(
      affectedProducts.map((product) => {
        const nextProduct = { ...product, colorFamily: name };
        return store.setJSON(
          productOverrideKey(product.id),
          productOverride(nextProduct, updatedAt),
        );
      }),
    );
    nextCategories = categories.map((category) =>
      category === previousName ? name : category,
    );
  }

  if (action === "delete") {
    if (!categories.includes(name)) {
      return Response.json({ error: "הקטגוריה לא נמצאה." }, { status: 404 });
    }
    const assignedCount = products.filter(
      (product) => product.colorFamily === name,
    ).length;
    if (assignedCount > 0) {
      return Response.json(
        {
          error: `יש להעביר תחילה את ${assignedCount} הכיפות המשויכות לקטגוריה אחרת.`,
        },
        { status: 409 },
      );
    }
    if (categories.length === 1) {
      return Response.json(
        { error: "חייבת להישאר לפחות קטגוריה אחת." },
        { status: 409 },
      );
    }
    nextCategories = categories.filter((category) => category !== name);
  }

  await saveCatalogCategories(nextCategories);
  await store.setJSON(`changes/${crypto.randomUUID()}`, {
    action: `category-${action}`,
    name,
    previousName: previousName || null,
    before: categories,
    after: nextCategories,
    createdAt: updatedAt,
  });

  return Response.json({ categories: nextCategories });
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
