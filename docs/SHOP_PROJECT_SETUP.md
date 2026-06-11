# ການແຍກໂປຣເຈັກ "ໜ້າຮ້ານລູກຄ້າ" (Option A)

ໂປຣເຈັກໃໝ່ສຳລັບລູກຄ້າ ໃຊ້ຖານຂໍ້ມູນອັນດຽວກັນກັບໂປຣເຈັກຫຼັງບ້ານນີ້

---

## 1) ສ້າງໂປຣເຈັກໃໝ່ໃນ Lovable
1. Dashboard → **New Project** → ຕັ້ງຊື່ເຊັ່ນ `phengmobile-shop`
2. ເລືອກ template ເປົ່າ (TanStack Start)
3. **ຍັງບໍ່ຕ້ອງເປີດ Lovable Cloud ໃໝ່** — ເຮົາຈະຊີ້ໄປຖານຂໍ້ມູນເດີມ

## 2) ຕັ້ງຄ່າ env (ໃນໂປຣເຈັກໃໝ່)
ໃນໂປຣເຈັກໃໝ່, ບອກ AI agent ໃຫ້ສ້າງໄຟລ໌ `.env` ດ້ວຍຄ່າດັ່ງລຸ່ມນີ້ (ຄ່າຈາກໂປຣເຈັກຫຼັງບ້ານ):

```
VITE_SUPABASE_PROJECT_ID="wbvwqkbxzcunqaujlrey"
VITE_SUPABASE_URL="https://wbvwqkbxzcunqaujlrey.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indidndxa2J4emN1bnFhdWpscmV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0Mjc1NzMsImV4cCI6MjA5NDAwMzU3M30.GYE-wqOqY7cfxGRi-IKcFaptNnJ3Mw6CLp4sPciXqHQ"
SUPABASE_PROJECT_ID="wbvwqkbxzcunqaujlrey"
SUPABASE_URL="https://wbvwqkbxzcunqaujlrey.supabase.co"
SUPABASE_PUBLISHABLE_KEY="<ຄືກັນກັບ VITE_SUPABASE_PUBLISHABLE_KEY>"
```

> ຄ່າເຫຼົ່ານີ້ເປັນ publishable key — ປອດໄພທີ່ຈະວາງໃນ codebase. RLS ໃນຖານຂໍ້ມູນເປັນຕົວປ້ອງກັນຈິງ.

## 3) ດຶງໄຟລ໌ໜ້າຮ້ານຈາກໂປຣເຈັກນີ້
ໃນ chat ຂອງໂປຣເຈັກໃໝ່, ໃຊ້ @mention:

> `@phengmobile` ສ້າງໜ້າຮ້ານລູກຄ້າໂດຍ copy ໄຟລ໌ເຫຼົ່ານີ້ມາ:
> - `src/routes/shop.tsx` → ໃສ່ເປັນ `src/routes/index.tsx`
> - `src/routes/track-order.$code.tsx`
> - `src/lib/shipping.ts`
> - `src/lib/slip-ocr.functions.ts`
> - `src/integrations/supabase/types.ts`
> - components ທີ່ກ່ຽວຂ້ອງໃນ `src/components/` (PhotoUploader ແລະ shadcn ui)
>
> ປັບ `__root.tsx` ໃຫ້ມີແຕ່ header ສຳລັບລູກຄ້າ (ບໍ່ມີ AppLayout ຫຼັງບ້ານ)

## 4) ກວດສອບການເຊື່ອມຕໍ່
- ເປີດໜ້າແລກ → ຄວນເຫັນສິນຄ້າຈາກ `inventory_items` (ທີ່ `is_published = true`)
- ລອງ checkout → ສ້າງ `shop_orders` ໃໝ່ → ໃນໂປຣເຈັກຫຼັງບ້ານ /orders ຄວນເຫັນທັນທີ

## 5) ໂດເມນ (optional)
- Publish ໂປຣເຈັກໃໝ່ → ໄດ້ `phengmobile-shop.lovable.app`
- ຕໍ່ subdomain `shop.phengmobile.com` ໃນ Project Settings → Domains

---

## ການແຍກໜ້າທີ່

| ໂປຣເຈັກ A (ນີ້) | ໂປຣເຈັກ B (ໃໝ່) |
|---|---|
| POS, ສ້ອມ, stock, admin orders | ໜ້າຮ້ານ, checkout, track order |
| Migration ຖານຂໍ້ມູນທັງໝົດ | ບໍ່ມີ migration (ໃຊ້ DB ຮ່ວມ) |
| ກວດສລິບ admin (re-verify) | ກວດສລິບ auto ຫຼັງລູກຄ້າອັບໂຫລດ |

**ກົດສຳຄັນ:** migration ທຸກອັນຕ້ອງເຮັດໃນໂປຣເຈັກ A ເທົ່ານັ້ນ. ຫຼັງຈາກນັ້ນ copy `src/integrations/supabase/types.ts` ໄປໂປຣເຈັກ B
