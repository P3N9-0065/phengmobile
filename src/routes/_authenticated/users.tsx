import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ROLE_LABEL } from "@/lib/lao";
import type { AppRole } from "@/lib/lao";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { createStaffUser } from "@/lib/users.functions";
import { UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

const ALL_ROLES: AppRole[] = ["admin", "cashier", "technician", "warehouse"];

type ProfileRow = { id: string; full_name: string; phone: string | null };
type RoleRow = { user_id: string; role: AppRole };

function UsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["admin", "profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .order("full_name");
      if (error) throw error;
      return data as ProfileRow[];
    },
  });

  const { data: rolesData } = useQuery({
    queryKey: ["admin", "user_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data as RoleRow[];
    },
  });

  const rolesByUser = new Map<string, Set<AppRole>>();
  rolesData?.forEach((r) => {
    if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, new Set());
    rolesByUser.get(r.user_id)!.add(r.role);
  });

  const toggleRole = useMutation({
    mutationFn: async ({ userId, role, enable }: { userId: string; role: AppRole; enable: boolean }) => {
      if (enable) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "user_roles"] });
      toast.success("ບັນທຶກສິດແລ້ວ");
    },
    onError: (e: any) => toast.error(e.message || "ບໍ່ສຳເລັດ"),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">ຜູ້ໃຊ້ງານ ແລະ ສິດ</h1>
        <p className="text-sm text-muted-foreground">
          ກຳນົດສິດການໃຊ້ງານຕາມໜ້າທີ່ — ຜູ້ຄຸ້ມຄອງ, ພະນັກງານຂາຍ, ຊ່າງສ້ອມ, ພະນັກງານສາງ
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ລາຍຊື່ຜູ້ໃຊ້</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">ກຳລັງໂຫຼດ...</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ຊື່</TableHead>
                    {ALL_ROLES.map((r) => (
                      <TableHead key={r} className="text-center">{ROLE_LABEL[r]}</TableHead>
                    ))}
                    <TableHead>ສິດປັດຈຸບັນ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles?.map((p) => {
                    const userRoles = rolesByUser.get(p.id) ?? new Set<AppRole>();
                    const isSelf = p.id === me?.id;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.full_name || "(ບໍ່ມີຊື່)"}</div>
                          {p.phone && <div className="text-xs text-muted-foreground">{p.phone}</div>}
                          {isSelf && <div className="text-xs text-primary">(ທ່ານເອງ)</div>}
                        </TableCell>
                        {ALL_ROLES.map((r) => {
                          const checked = userRoles.has(r);
                          const disableSelfAdmin = isSelf && r === "admin" && checked;
                          return (
                            <TableCell key={r} className="text-center">
                              <Checkbox
                                checked={checked}
                                disabled={toggleRole.isPending || disableSelfAdmin}
                                onCheckedChange={(v) =>
                                  toggleRole.mutate({ userId: p.id, role: r, enable: !!v })
                                }
                              />
                            </TableCell>
                          );
                        })}
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {[...userRoles].map((r) => (
                              <Badge key={r} variant="secondary">{ROLE_LABEL[r]}</Badge>
                            ))}
                            {userRoles.size === 0 && (
                              <span className="text-xs text-muted-foreground">ບໍ່ມີສິດ</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="mt-4 text-xs text-muted-foreground space-y-1">
            <p>• <b>ຜູ້ຄຸ້ມຄອງ</b>: ເຂົ້າເຖິງທຸກໜ້າ ແລະ ຈັດການຜູ້ໃຊ້</p>
            <p>• <b>ພະນັກງານຂາຍ</b>: POS, ບິນຂາຍ, ໃບສ້ອມ, ລູກຄ້າ, ສະໝັກບັນຊີ</p>
            <p>• <b>ຊ່າງສ້ອມ</b>: ໃບສ້ອມ ທີ່ໄດ້ຮັບມອບໝາຍ</p>
            <p>• <b>ພະນັກງານສາງ</b>: ຈັດການສະຕັອກ</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
