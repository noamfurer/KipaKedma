import { getStore } from "@netlify/blobs";
import { products as defaultProducts, type Product } from "../app/catalog";

export const CATALOG_STORE_NAME = "kipa-kedma-catalog";
export const RESERVATIONS_STORE_NAME = "kipa-kedma-reservations";

export type ProductOverride = Pick<
  Product,
  "name" | "sku" | "diameter" | "price" | "enabled"
> & {
  updatedAt: string;
};

export type ReservationLock = {
  requestId: string;
  createdAt: string;
};

export type ProductReservation = ReservationLock & {
  key: string;
  productId: string;
};

export function catalogStore() {
  return getStore({ name: CATALOG_STORE_NAME, consistency: "strong" });
}

export function reservationsStore() {
  return getStore({ name: RESERVATIONS_STORE_NAME, consistency: "strong" });
}

export function productOverrideKey(productId: string) {
  return `products/${productId}`;
}

export function reservationKeyForProduct(productId: string) {
  return `reserved-id/${productId}`;
}

export function defaultProduct(productId: string) {
  return defaultProducts.find((product) => product.id === productId);
}

export function legacyReservationKeys(product: Product) {
  const originalSku = defaultProduct(product.id)?.sku;
  return [...new Set([originalSku, product.sku].filter(Boolean))].map(
    (sku) => `reserved/${sku}`,
  );
}

export async function loadCatalogProducts() {
  const store = catalogStore();
  return Promise.all(
    defaultProducts.map(async (baseProduct) => {
      const override = (await store.get(productOverrideKey(baseProduct.id), {
        type: "json",
      })) as ProductOverride | null;
      const product = override
        ? { ...baseProduct, ...override }
        : { ...baseProduct };

      return {
        ...product,
        specialPrice: product.price !== 40,
      } satisfies Product;
    }),
  );
}

export async function findProductReservation(product: Product) {
  const store = reservationsStore();
  const keys = [
    reservationKeyForProduct(product.id),
    ...legacyReservationKeys(product),
  ];

  for (const key of keys) {
    const data = (await store.get(key, {
      type: "json",
    })) as ReservationLock | null;
    if (data) return { key, productId: product.id, ...data };
  }

  return null;
}

export async function loadProductReservations(products: Product[]) {
  const reservations = await Promise.all(
    products.map((product) => findProductReservation(product)),
  );
  return reservations.filter(
    (reservation): reservation is ProductReservation => reservation !== null,
  );
}

export async function clearProductReservation(product: Product) {
  const store = reservationsStore();
  const keys = [
    reservationKeyForProduct(product.id),
    ...legacyReservationKeys(product),
  ];
  const locks = await Promise.all(
    keys.map(async (key) => ({
      key,
      data: (await store.get(key, { type: "json" })) as ReservationLock | null,
    })),
  );
  const existing = locks.filter(
    (entry): entry is { key: string; data: ReservationLock } => entry.data !== null,
  );

  await Promise.all(existing.map(({ key }) => store.delete(key)));
  return existing.map(({ key, data }) => ({ key, productId: product.id, ...data }));
}
