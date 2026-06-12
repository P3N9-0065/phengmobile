import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Package as PackageIcon, MapPin, Clock, CheckCircle2, XCircle, Truck } from "lucide-react";
import { formatLAK, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/track-order/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.code} Status — Pheng Mobile` },
      { name: "description", content: `Check delivery status, items, and payment for Pheng Mobile online order ${params.code}.` },
      { property: "og:title", content: `Order ${params.code} Status — Pheng Mobile` },
      { property: "og:description", content: `Live delivery and payment status for Pheng Mobile order ${params.code}.` },
      { property: "og:url", content: `https://phengmobile.lovable.app/track-order/${params.code}` },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: `https://phengmobile.lovable.app/track-order/${params.code}` }],
  }),
  component: TrackOrderPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "ລໍຖ້າຮ້ານຢືນຢັນ",
  confirmed: "ຢືນຢັນແລ້ວ ກຳລັງກຽມສິນຄ້າ",
  ready: "ພ້ອມຮັບ/ກຳລັງສົ່ງ",
  completed: "ສຳເລັດແລ້ວ",
  cancelled: "ຍົກເລີກ",
};

const STATUS_ICON: Record<string, any> = {
  pending: Clock,
  confirmed: CheckCircle2,
  ready: Truck,
  completed: CheckCircle2,
  cancelled: XCircle,
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  ready: "bg-indigo-100 text-indigo-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

function TrackOrderPage() {
  const { code } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["track-order", code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("track_shop_order" as any, { _code: code });
      if (error) throw error;
      return (data?.[0] ?? null) as any;
    },
  });

  return (
    <main className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-2xl mx-auto pt-6">
        <div className="flex items-center gap-2 mb-6">
          <ShoppingBag className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Track Order — ຕິດຕາມໃບສັ່ງຊື້</h1>
        </div>

        {isLoading && <p className="text-center py-12 text-muted-foreground">ກຳລັງໂຫລດ...</p>}

        {!isLoading && !data && (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="font-medium">ບໍ່ພົບໃບສັ່ງຊື້ "{code}"</p>
              <p className="text-sm text-muted-foreground mt-2">ກວດເບິ່ງລະຫັດອີກຄັ້ງ</p>
            </CardContent>
          </Card>
        )}

        {data && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">ລະຫັດໃບສັ່ງ</p>
                    <CardTitle className="text-2xl">{data.order_code}</CardTitle>
                  </div>
                  <Badge className={STATUS_COLOR[data.status] || ""}>
                    {(() => {
                      const I = STATUS_ICON[data.status] || Clock;
                      return <I className="h-3.5 w-3.5 mr-1" />;
                    })()}
                    {STATUS_LABEL[data.status] || data.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">ລູກຄ້າ:</span> {data.customer_name}</p>
                <p className="flex items-start gap-1">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  {data.delivery_method === "pickup" ? "ມາຮັບທີ່ຮ້ານ" : `ສົ່ງເດລີເວີຣີ່: ${data.address || "-"}`}
                </p>
                <p className="text-xs text-muted-foreground">ສັ່ງເມື່ອ: {formatDateTime(data.created_at)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">ລາຍການສິນຄ້າ</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {(data.items || []).map((it: any, idx: number) => (
                  <div key={idx} className="flex justify-between border-b py-1.5 last:border-0">
                    <span className="flex items-center gap-2"><PackageIcon className="h-3.5 w-3.5 text-muted-foreground" />{it.name} × {it.qty}</span>
                    <span>{formatLAK(Number(it.line_total))}</span>
                  </div>
                ))}
                <div className="pt-2 space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>ລວມສິນຄ້າ</span><span>{formatLAK(Number(data.subtotal))}</span>
                  </div>
                  {Number(data.shipping_fee) > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>ຄ່າສົ່ງ</span><span>{formatLAK(Number(data.shipping_fee))}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base border-t pt-1">
                    <span>ລວມຈ່າຍ</span><span className="text-primary">{formatLAK(Number(data.total || data.subtotal))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
