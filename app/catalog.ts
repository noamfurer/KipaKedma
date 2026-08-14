export type Product = {
  sku: string;
  name: string;
  colorFamily: string;
  colorLabel: string;
  diameter: number;
  price: number;
  image: string;
  accent: string;
  specialPrice?: boolean;
};

export const products: Product[] = [
  {
    sku: "KDM-001",
    name: "שמנת במסגרת כתומה",
    colorFamily: "כתומים",
    colorLabel: "שמנת וכתום",
    diameter: 11,
    price: 40,
    image: "/images/kdm-001.jpg",
    accent: "#e67842",
  },
  {
    sku: "KDM-002",
    name: "חרדל זהוב",
    colorFamily: "צהובים",
    colorLabel: "חרדל וזהב",
    diameter: 11,
    price: 40,
    image: "/images/kdm-002.jpg",
    accent: "#d69b12",
  },
  {
    sku: "KDM-006",
    name: "שמש בשמנת",
    colorFamily: "צהובים",
    colorLabel: "צהוב ושמנת",
    diameter: 9,
    price: 40,
    image: "/images/kdm-006.jpg",
    accent: "#e9bd26",
  },
  {
    sku: "KDM-003",
    name: "פסי חול וקפה",
    colorFamily: "חומים",
    colorLabel: "שמנת, בז׳ וחום",
    diameter: 11,
    price: 40,
    image: "/images/kdm-003.jpg",
    accent: "#9f6948",
  },
  {
    sku: "KDM-005",
    name: "מלנז׳ שוקולד",
    colorFamily: "חומים",
    colorLabel: "חום שוקולד ושמנת",
    diameter: 11,
    price: 40,
    image: "/images/kdm-005.jpg",
    accent: "#745047",
  },
  {
    sku: "KDM-004",
    name: "שבילי ירוק",
    colorFamily: "ירוקים",
    colorLabel: "ירוק מדורג ושמנת",
    diameter: 11,
    price: 40,
    image: "/images/kdm-004.jpg",
    accent: "#4d8e48",
  },
  {
    sku: "KDM-007",
    name: "שחור במסגרת לבנה",
    colorFamily: "שחורים",
    colorLabel: "שחור ולבן",
    diameter: 12,
    price: 40,
    image: "/images/kdm-007.jpg",
    accent: "#242529",
  },
];

export const colorFamilies = ["הכול", "כתומים", "צהובים", "חומים", "ירוקים", "שחורים"];

export function calculateTotal(selectedProducts: Product[]) {
  const regular = selectedProducts.filter((product) => !product.specialPrice);
  const special = selectedProducts.filter((product) => product.specialPrice);
  const regularTotal = Math.floor(regular.length / 3) * 110 + (regular.length % 3) * 40;
  return regularTotal + special.reduce((sum, product) => sum + product.price, 0);
}
