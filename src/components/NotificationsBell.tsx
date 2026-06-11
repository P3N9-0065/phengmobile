import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationsBell() {
  const qc = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ["staff-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_notifications" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 30000,
  });

  // Realtime subscription for instant new-order alerts
  useEffect(() => {
    const channel = supabase
      .channel("staff_notifications_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "staff_notifications" },
        () => qc.invalidateQueries({ queryKey: ["staff-notifications"] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const unread = (items ?? []).filter((n) => !n.read).length;

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("staff_notifications" as any)
        .update({ read: true })
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-notifications"] }),
  });

  const markOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff_notifications" as any).update({ read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-notifications"] }),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full text-[10px]" variant="destructive">
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <p className="font-medium text-sm">ການແຈ້ງເຕືອນ</p>
          {unread > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => markAllRead.mutate()}>
              <CheckCheck className="h-3 w-3 mr-1" />ອ່ານທັງໝົດ
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-auto">
          {(items ?? []).length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">ບໍ່ມີການແຈ້ງເຕືອນ</p>
          )}
          {(items ?? []).map((n) => {
            const body = (
              <div className={cn("p-3 border-b hover:bg-muted/50 cursor-pointer", !n.read && "bg-primary/5")}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">{n.title}</p>
                  {!n.read && <span className="h-2 w-2 rounded-full bg-primary mt-1 shrink-0" />}
                </div>
                {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">{formatDateTime(n.created_at)}</p>
              </div>
            );
            if (n.link) {
              return (
                <Link key={n.id} to={n.link} onClick={() => !n.read && markOne.mutate(n.id)} className="block">
                  {body}
                </Link>
              );
            }
            return (
              <div key={n.id} onClick={() => !n.read && markOne.mutate(n.id)}>
                {body}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
