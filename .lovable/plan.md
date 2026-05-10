
# ແຜນສ້າງລະບົບ POS ຮ້ານສ້ອມມືຖື (MVP)

**ພາສາລະບົບ: ລາວ (ທັງໝົດ)** | ສະກຸນເງິນ: ກີບ (₭ LAK)
ໂຟກັດ MVP: **ງານສ້ອມ + ສະຕັອກອາໄຫຼ່ + ລູກຄ້າ (CRM)**

---

## 1. Stack & ການຕັ້ງຄ່າ

- TanStack Start + Tailwind + shadcn/ui
- Lovable Cloud (DB + Auth + Storage ສຳລັບຮູບເຄື່ອງ/ລາຍເຊັນ)
- ພາສາລາວທັງລະບົບ (UI labels, ປຸ່ມ, ຂໍ້ຄວາມ, email templates)
- Locale: `lo-LA`, ຮູບແບບເງິນ `Intl.NumberFormat('lo-LA', { style:'currency', currency:'LAK' })`
- ຮູບແບບວັນທີ: ລາວ (ພ.ສ. ຫຼື ຄ.ສ.) — ໃຊ້ `date-fns` locale `lo`
- ຟອນ