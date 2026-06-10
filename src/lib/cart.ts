import { useEffect, useState } from "react";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  qty: number;
  stock_qty: number;
}

const KEY = "pheng-shop-cart-v1";

function read(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("shop-cart-changed"));
}

export function addToCart(item: Omit<CartItem, "qty">, qty = 1) {
  const items = read();
  const existing = items.find((i) => i.id === item.id);
  if (existing) {
    existing.qty = Math.min(existing.qty + qty, item.stock_qty || 99);
  } else {
    items.push({ ...item, qty: Math.min(qty, item.stock_qty || 99) });
  }
  write(items);
}

export function updateQty(id: string, qty: number) {
  const items = read();
  const it = items.find((i) => i.id === id);
  if (!it) return;
  if (qty <= 0) {
    write(items.filter((i) => i.id !== id));
  } else {
    it.qty = Math.min(qty, it.stock_qty || 99);
    write(items);
  }
}

export function removeFromCart(id: string) {
  write(read().filter((i) => i.id !== id));
}

export function clearCart() {
  write([]);
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(() => read());
  useEffect(() => {
    const h = () => setItems(read());
    window.addEventListener("shop-cart-changed", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("shop-cart-changed", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);
  return { items, subtotal, count };
}
