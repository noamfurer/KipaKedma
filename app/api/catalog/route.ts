import {
  loadCatalogProducts,
  loadProductReservations,
} from "../../../lib/catalog-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await loadCatalogProducts();
    const reservations = await loadProductReservations(products);
    const unavailableProductIds = reservations.map(
      (reservation) => reservation.productId,
    );

    return Response.json(
      { products, unavailableProductIds },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Availability is temporarily unavailable" },
      { status: 500 },
    );
  }
}
