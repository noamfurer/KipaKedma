import catalogData from "../data/catalog-2026.json";

export type Product = {
  id: string;
  sku: string;
  name: string;
  colorFamily: string;
  colorLabel: string;
  diameter: number;
  price: number;
  image: string;
  accent: string;
  enabled: boolean;
  specialPrice?: boolean;
};

export const products = catalogData as Product[];

export const productColorFamilies = [
  "כחולים",
  "ירוקים",
  "חומים",
  "כתומים",
  "צהובים",
  "סגולים",
  "שחורים",
  "בהירים",
] as const;

export const colorFamilies = ["הכול", ...productColorFamilies];

export function calculateTotal(selectedProducts: Product[]) {
  const regular = selectedProducts.filter((product) => !product.specialPrice);
  const special = selectedProducts.filter((product) => product.specialPrice);
  const regularTotal = Math.floor(regular.length / 3) * 110 + (regular.length % 3) * 40;
  return regularTotal + special.reduce((sum, product) => sum + product.price, 0);
}
