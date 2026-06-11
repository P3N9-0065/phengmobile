# แผน: แยกหน้าร้านลูกค้าเป็นโปรเจกต์ใหม่ (Option A)

## เป้าหมาย
สร้างโปรเจกต์ Lovable ใหม่สำหรับลูกค้า (shop + track order) แยกออกจากโปรเจกต์หลังบ้านปัจจุบัน โดย**ใช้ฐานข้อมูล Lovable Cloud เดียวกัน**

```text
┌─────────────────────────┐         ┌─────────────────────────┐
│  โปรเจกต์ A (ปัจจุบัน) │         │  โปรเจกต์ B (ใหม่)     │
│  phengmobile.lovable    │         │  shop.phengmobile...   │
│  - หลังบ้าน/POS/ซ่อม   │         │  - /  หน้าร้าน         │
│  - Admin orders         │         │  - /track-order/:code  │
│  - Bank settings        │         │  - Checkout + slip     │
└───────────┬─────────────┘         └───────────┬─────────────┘
            │                                    │
            └────────────┬───────────────────────┘
                         ▼
              ┌──────────────────────┐
              │  Lovable Cloud DB    │  (เดียวกัน)
              │  shop_orders, items, │
              │  inventory_items,    │
              │  shop_bank_settings  │
              └──────────────────────┘
```

## ขั้นตอน

### 1) สร้างโปรเจกต์ใหม่ (ผู้ใช้ทำเอง 1 ครั้ง)
- ไปที่ Dashboard → New Project → ตั้งชื่อเช่น `phengmobile-shop`
- เปิด Lovable Cloud ในโปรเจกต์ใหม่ — **แต่ยังไม่ใช้ DB ของมันเอง** เราจะ override ให้ชี้มาที่ DB เดิม

### 2) เชื่อมโปรเจกต์ใหม่กับฐานข้อมูลเดิม
ในโปรเจกต์ใหม่ แก้ `.env`:
- `VITE_SUPABASE_URL` = URL ของโปรเจกต์ A
- `VITE_SUPABASE_PUBLISHABLE_KEY` = publishable key ของ A
- `VITE_SUPABASE_PROJECT_ID` = project id ของ A

(ค่าเหล่านี้ผมจะดึงให้ และบอกขั้นตอนวางในโปรเจกต์ใหม่)

### 3) ย้ายโค้ดหน้าร้านไปโปรเจกต์ใหม่
ไฟล์ที่ต้อง copy ไปโปรเจกต์ใหม่:
- `src/routes/shop.tsx` → ทำเป็น `src/routes/index.tsx` (เป็นหน้าแรกเลย)
- `src/routes/track-order.$code.tsx`
- `src/lib/shipping.ts`
- `src/lib/slip-ocr.functions.ts` (server fn อัปสลิป)
- Types ที่เกี่ยวข้องใน `src/integrations/supabase/types.ts` (สร้างใหม่ตาม schema เดิม)
- UI components ที่ใช้ร่วม (shadcn ฯลฯ — มีอยู่แล้วในเทมเพลต)

### 4) ปรับ DB policies ให้รองรับการเข้าถึงจาก 2 โปรเจกต์
ตรวจสอบ RLS บนตาราง:
- `shop_orders`, `shop_order_items` — anon insert (checkout), customer read ผ่าน `order_code`
- `inventory_items` — anon select เฉพาะที่ `is_published = true`
- `shop_bank_settings` — anon select (เพื่อแสดงเลขบัญชี)
ของเดิมน่าจะทำไว้แล้ว แค่ตรวจซ้ำ

### 5) ลบหน้าร้านออกจากโปรเจกต์ A (หลังโปรเจกต์ B พร้อม)
- ลบ `src/routes/shop.tsx`, `src/routes/track-order.$code.tsx`
- เก็บแอดมิน orders / bank settings ไว้ในโปรเจกต์ A
- ปุ่ม/ลิงก์ที่เคยลิงก์ไป `/shop` ให้ชี้ไปโดเมนใหม่แทน

### 6) Custom domain (optional)
- โปรเจกต์ B publish → ต่อ subdomain เช่น `shop.phengmobile.com`
- ตั้ง A record ที่ DNS

## รายละเอียดเทคนิค

**ทำไมแชร์ DB ได้:** Supabase URL + publishable key เป็นค่าที่ใช้กับ client ได้ปลอดภัย โปรเจกต์ Lovable กี่อันก็ชี้มาที่ DB เดียวกันได้ ตราบใดที่ RLS policies ถูกต้อง

**ข้อควรระวัง:**
- เวลาแก้ schema (migration) ทำในโปรเจกต์ A เท่านั้น (เจ้าของ DB) แล้ว copy `src/integrations/supabase/types.ts` ที่อัปเดตแล้วไปโปรเจกต์ B
- Server functions ที่ใช้ `requireSupabaseAuth` (เช่น admin verify slip) อยู่โปรเจกต์ A เท่านั้น โปรเจกต์ B มีแค่ public/anonymous fn (อัปสลิป)
- การกวด OCR background job รันที่โปรเจกต์ B ได้ (เป็น server fn ของมันเอง) แต่เขียน DB เดียวกัน

## คำถามก่อนเริ่ม
1. ต้องการให้ผมเตรียม **bundle ไฟล์หน้าร้านพร้อม README** ให้เอาไปวางในโปรเจกต์ใหม่ หรือจะให้ใช้ **@mention cross-project** ดึงไฟล์จากโปรเจกต์ A ไปโปรเจกต์ B (วิธีหลังง่ายกว่า)
2. ตอนนี้ยังไม่ต้องลบหน้าร้านออกจากโปรเจกต์ A ใช่ไหม (รอโปรเจกต์ B ทำงานได้ก่อน)
