import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { STATUS_LABEL, STATUS_COLOR, type RepairStatus } from "@/lib/lao";
import { formatDateTime, formatDate, formatLAK } from "@/lib/format";

export const Route = createFileRoute("/track/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `ຕິດຕາມການສ້ອມ — Pheng Mobile` },
      { name: "description", content: `ກວດເບິ່ງສະຖານະການສ້ອມແບບ real-time` },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: `https://phengmobile.lovable.app/track/${params.code}` }],
  }),
  component: TrackPage,
});

interface PublicTrack {
  ticket_code: string;
  device_brand: string;
  device_model: string;
  device_color: string | null;
  imei_last4: string | null;
  problem_description: string;
  status: RepairStatus;
  estimated_price: number | null;
  warranty_days: number | null;
  warranty_until: string | null;
  created_at: string;
  updated_at: string;
  picked_up_at: string | null;
  history: { status: RepairStatus; changed_at: string; note: string | null }[];
}

const STATUS_ICON: Record<RepairStatus, string> = {
  received: "✅",
  inspecting: "🔧",
  waiting_parts: "📦",
  repairing: "🛠",
  testing: "🧪",
  done: "✅",
  picked_up: "🎉",
  closed: "🎉",
  cancelled: "❌",
};

function TrackPage() {
  const { code } = Route.useParams();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["track", code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("track_repair_public", { _token: code });
      if (error) throw error;
      return (data ?? null) as PublicTrack | null;
    },
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  // Realtime updates keyed by ticket code (falls back to polling above)
  useEffect(() => {
    if (!data?.ticket_code) return;
    const channel = supabase
      .channel(`track-${data.ticket_code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "repair_tickets", filter: `ticket_code=eq.${data.ticket_code}` },
        () => refetch(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "repair_status_history" },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [data?.ticket_code, refetch]);

  return (
    <main className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6 pt-6">
          <div className="flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">ຕິດຕາມການສ້ອມ — Pheng Mobile</h1>
          </div>
          <button
            onClick={() => refetch()}
            className="text-xs text-muted-foreground flex items-center gap-1 hover:text-primary"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
            ອັບເດດ
          </button>
        </div>

        {isLoading && <p className="text-center py-12 text-muted-foreground">ກຳລັງໂຫຼດ...</p>}

        {!isLoading && !data && (
          <Card>
            <CardContent className="pt-6 text-center space-y-2">
              <p className="font-medium">ບໍ່ພົບຂໍ້ມູນ</p>
              <p className="text-sm text-muted-foreground">
                ລິ້ງອາດຈະບໍ່ຖືກຕ້ອງ ຫຼື ໃບສ້ອມຖືກລຶບແລ້ວ
              </p>
              <p className="text-xs text-muted-foreground pt-2">ກະລຸນາສະແກນ QR ຈາກໃບຮັບເຄື່ອງອີກຄັ້ງ</p>
            </CardContent>
          </Card>
        )}

        {data && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <p className="text-sm text-muted-foreground">ເລກທີ່ໃບສ້ອມ</p>
                <CardTitle className="text-2xl tabular-nums">{data.ticket_code}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">ເຄື່ອງ</p>
                  <p className="font-medium">
                    {data.device_brand} {data.device_model}
                    {data.device_color && <span className="text-muted-foreground"> • {data.device_color}</span>}
                  </p>
                </div>
                {data.imei_last4 && (
                  <div>
                    <p className="text-sm text-muted-foreground">IMEI</p>
                    <p className="font-mono">•••• •••• {data.imei_last4}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">ອາການ</p>
                  <p className="text-sm">{data.problem_description}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ສະຖານະປະຈຸບັນ</p>
                  <Badge variant="outline" className={`${STATUS_COLOR[data.status]} text-base mt-1`}>
                    {STATUS_ICON[data.status]} {STATUS_LABEL[data.status]}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> ອັບເດດ: {formatDateTime(data.updated_at)}
                  </p>
                </div>
                {data.estimated_price != null && (
                  <div>
                    <p className="text-sm text-muted-foreground">ລາຄາປະເມີນ</p>
                    <p className="font-medium">{formatLAK(Number(data.estimated_price))}</p>
                  </div>
                )}
                {data.warranty_until && new Date(data.warranty_until) >= new Date() && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    ຢູ່ໃນໄລຍະປະກັນຮອດ {formatDate(data.warranty_until)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ປະຫວັດສະຖານະ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.history.length === 0 && (
                    <p className="text-sm text-muted-foreground">ຍັງບໍ່ມີການອັບເດດ</p>
                  )}
                  {data.history.map((h, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                      <div className="flex-1">
                        <Badge variant="outline" className={STATUS_COLOR[h.status]}>
                          {STATUS_ICON[h.status]} {STATUS_LABEL[h.status]}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">{formatDateTime(h.changed_at)}</p>
                        {h.note && <p className="text-sm mt-1">{h.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground">
              ຫນ້ານີ້ຈະອັບເດດອັດຕະໂນມັດທຸກ 15 ວິນາທີ
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
