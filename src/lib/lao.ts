import type { Database } from "@/integrations/supabase/types";

export type RepairStatus = Database["public"]["Enums"]["repair_status"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type ItemCategory = Database["public"]["Enums"]["item_category"];

export const STATUS_LABEL: Record<RepairStatus, string> = {
  received: "ຮັບເຄື່ອງ",
  inspecting: "ກຳລັງກວດເຊັກ",
  waiting_parts: "ລໍຖ້າອາໄຫຼ່",
  repairing: "ກຳລັງສ້ອມ",
  testing: "ກຳລັງທົດສອບ",
  done: "ສ້ອມສຳເລັດ",
  picked_up: "ລູກຄ້າຮັບແລ້ວ",
  closed: "ປິດງານ",
  cancelled: "ຍົກເລີກ",
};

export const STATUS_COLOR: Record<RepairStatus, string> = {
  received: "bg-blue-100 text-blue-800 border-blue-200",
  inspecting: "bg-cyan-100 text-cyan-800 border-cyan-200",
  waiting_parts: "bg-amber-100 text-amber-800 border-amber-200",
  repairing: "bg-purple-100 text-purple-800 border-purple-200",
  testing: "bg-indigo-100 text-indigo-800 border-indigo-200",
  done: "bg-emerald-100 text-emerald-800 border-emerald-200",
  picked_up: "bg-green-100 text-green-800 border-green-200",
  closed: "bg-slate-200 text-slate-700 border-slate-300",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

export const STATUS_ORDER: RepairStatus[] = [
  "received",
  "inspecting",
  "waiting_parts",
  "repairing",
  "testing",
  "done",
  "picked_up",
  "closed",
  "cancelled",
];

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "ຜູ້ຄຸ້ມຄອງ",
  cashier: "ພະນັກງານຂາຍ",
  technician: "ຊ່າງສ້ອມ",
};

export const CATEGORY_LABEL: Record<ItemCategory, string> = {
  part: "ອາໄຫຼ່",
  accessory: "ອຸປະກອນເສີມ",
  tool: "ເຄື່ອງມືຊ່າງ",
  phone_new: "ມືຖືໃໝ່",
  phone_used: "ມືຖືມືສອງ",
};

export const MOVEMENT_LABEL: Record<string, string> = {
  purchase: "ຊື້ເຂົ້າ",
  repair_use: "ໃຊ້ສ້ອມ",
  adjustment: "ປັບປຸງ",
  sale: "ຂາຍ",
  return: "ສົ່ງຄືນ",
};
