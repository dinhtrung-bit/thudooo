export type Category = "top" | "bottom";

export interface Product {
  id: string;
  name: string;
  description?: string;
  image: string;
  price: number;
  category: Category;
}

export const PRODUCTS: Product[] = [];

export function getProductsByCategory(category: Category): Product[] {
  return PRODUCTS.filter((p) => p.category === category);
}
