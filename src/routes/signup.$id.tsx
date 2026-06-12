import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone, CheckCircle2 } from "lucide-react";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/signup/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Account Information — Pheng Mobile` },
      { name: "description", content: `Secure account setup details for Pheng Mobile signup ${params.id}.` },
      { property: "og:title", content: `Account Information — Pheng Mobile` },
      { property: "og:description", content: `Customer account information for a Pheng Mobile signup record.` },
      { property: "og:url", content: `https://phengmobile.lovable.app/signup/${params.id}` },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: `https://phengmobile.lovable.app/signup/${params.id}` }],
  }),
  component: SignupTrackPage,
});

const TYPE_LABEL: Record<string, string> = {
  email: "Email",
  apple_id: "Apple ID",
  google: "Google",
  other: "ອື່ນໆ",
};

function SignupTrackPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["signup-track", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("track_signup", { _id: id });
      if (error) throw error;
      return (data?.[0] ?? null) as any;
    },
  });

  return (
    <main className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-2 mb-6 pt-6">
          <Smartphone className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Account Information — ເພັງ ໂມບາຍ Pheng Mobile</h1>
        </div>

        {isLoading && <p className="text-center py-12 text-muted-foreground">ກຳລັງໂຫຼດ...</p>}

        {!isLoading && !data && (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="font-medium">ບໍ່ພົບຂໍ້ມູນບັນຊີ</p>
              <p className="text-sm text-muted-foreground mt-2">ກະລຸນາກວດເບິ່ງ QR ອີກຄັ້ງ</p>
            </CardContent>
          </Card>
        )}

        {data && (
          <Card>
            <CardHeader>
              <p className="text-sm text-muted-foreground">ໃບຂໍ້ມູນບັນຊີສະໝັກ</p>
              <CardTitle className="text-xl">{data.customer_name}</CardTitle>
              <Badge variant="secondary" className="w-fit mt-1">
                {TYPE_LABEL[data.account_type] ?? data.account_type}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="ເບີໂທລູກຄ້າ" value={data.customer_phone} />
              <Row label="ອີເມວບັນຊີ" value={data.account_email} mono />
              <Row label="ອີເມວກູ້ຄືນ" value={data.recovery_email} mono />
              <Row label="ເບີກູ້ຄືນ" value={data.recovery_phone} />
              {Number(data.service_fee) > 0 && (
                <Row label="ຄ່າບໍລິການ" value={`${Number(data.service_fee).toLocaleString()} LAK`} />
              )}
              <Row label="ວັນທີສະໝັກ" value={formatDateTime(data.created_at)} />
              {data.notes && (
                <div>
                  <p className="text-muted-foreground">ໝາຍເຫດ:</p>
                  <p>{data.notes}</p>
                </div>
              )}

              <div className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-3 mt-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>ເພື່ອຄວາມປອດໄພ ລະຫັດຜ່ານບໍ່ໄດ້ສະແດງຢູ່ໜ້ານີ້. ກະລຸນາເບິ່ງຢູ່ໃບທີ່ຮ້ານອອກໃຫ້.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}:</span>
      <span className={mono ? "font-mono text-right break-all" : "text-right"}>{value}</span>
    </div>
  );
}
