import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone, CheckCircle2 } from "lucide-react";
import { STATUS_LABEL, STATUS_COLOR, type RepairStatus } from "@/lib/lao";
import { formatDateTime, formatDate } from "@/lib/format";

export const Route = createFileRoute("/track/$code")({
  component: TrackPage,
});

interface TrackResult {
  ticket_code: string;
  device_brand: string;
  device_model: string;
  status: RepairStatus;
  created_at: string;
  picked_up_at: string | null;
  warranty_until: string | null;
  history: { status: RepairStatus; changed_at: string; note: string | null }[];
}

function TrackPage() {
  const { code } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["track", code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("track_ticket", { _code: code });
      if (error) throw error;
      return (data?.[0] ?? null) as TrackResult | null;
    },
  });

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6 pt-6">
          <Smartphone className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">ຮ້ານສ້ອມມືຖື</h1>
        </div>

        {isLoading && <p className="text-center py-12 text-muted-foreground">ກຳລັງໂຫຼດ...</p>}

        {!isLoading && !data && (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="font-medium">ບໍ່ພົບໃບສ້ອມລະຫັດ "{code}"</p>
              <p className="text-sm text-muted-foreground mt-2">ກະລຸນາກວດເບິ່ງລະຫັດອີກຄັ້ງ</p>
            </CardContent>
          </Card>
        )}

        {data && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <p className="text-sm text-muted-foreground">ລະຫັດໃບສ້ອມ</p>
                <CardTitle className="text-2xl">{data.ticket_code}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">ເຄື່ອງ</p>
                  <p className="font-medium">{data.device_brand} {data.device_model}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ສະຖານະປະຈຸບັນ</p>
                  <Badge variant="outline" className={`${STATUS_COLOR[data.status]} text-base mt-1`}>
                    {STATUS_LABEL[data.status]}
                  </Badge>
                </div>
                {data.warranty_until && new Date(data.warranty_until) >= new Date() && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    ຍັງຢູ່ໃນໄລຍະປະກັນ ຮອດ {formatDate(data.warranty_until)}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>ປະຫວັດສະຖານະ</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.history.map((h, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                      <div className="flex-1">
                        <Badge variant="outline" className={STATUS_COLOR[h.status]}>{STATUS_LABEL[h.status]}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{formatDateTime(h.changed_at)}</p>
                        {h.note && <p className="text-sm mt-1">{h.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
