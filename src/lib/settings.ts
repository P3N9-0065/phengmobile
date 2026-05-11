import { useEffect, useState } from "react";
import type { Currency } from "./currency";

export interface PosSettings {
  shop_name: string;
  shop_name_en: string;
  shop_address: string;
  shop_phone: string;
  shop_tax_id: string;
  receipt_header: string;
  receipt_footer: string;
  paper_width_mm: 58 | 80;
  font_size_px: number;
  show_logo: boolean;
  rates: Record<Currency, number>;
}

const KEY = "pheng-pos-settings-v1";

export const DEFAULT_SETTINGS: PosSettings = {
  shop_name: "ເພັງ ໂມບາຍ",
  shop_name_en: "Pheng Mobile",
  shop_address: "",
  shop_phone: "",
  shop_tax_id: "",
  receipt_header: "ຮ້ານສ້ອມມືຖື ຄົບຈົບໃນທີ່ດຽວ",
  receipt_footer: "ຂອບໃຈທີ່ໃຊ້ບໍລິການ",
  paper_width_mm: 80,
  font_size_px: 12,
  show_logo: true,
  rates: { LAK: 1, THB: 620, USD: 21500 },
};

export function loadSettings(): PosSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: PosSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("pos-settings-changed"));
}

export function usePosSettings() {
  const [s, setS] = useState<PosSettings>(() => loadSettings());
  useEffect(() => {
    const h = () => setS(loadSettings());
    window.addEventListener("pos-settings-changed", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("pos-settings-changed", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return s;
}
