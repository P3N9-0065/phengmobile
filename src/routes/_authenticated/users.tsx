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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">ຜູ້ໃຊ້ງານ ແລະ ສິດ</h1>
          <p className="text-sm text-muted-foreground">
            ກຳນົດສິດການໃຊ້ງານຕາມໜ້າທີ່ — ຜູ້ຄຸ້ມຄອງ, ພະນັກງານຂາຍ, ຊ່າງສ້ອມ, ພະນັກງານສາງ
          </p>
        </div>
        <InviteStaffDialog />
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

function InviteStaffDialog() {
  const qc = useQueryClient();
  const createFn = useServerFn(createStaffUser);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<Set<AppRole>>(new Set(["cashier"]));
  const [sendInvite, setSendInvite] = useState(false);

  function reset() {
    setEmail("");
    setFullName("");
    setPhone("");
    setPassword("");
    setRoles(new Set(["cashier"]));
    setSendInvite(false);
  }

  const m = useMutation({
    mutationFn: async () => {
      if (!email || !fullName) throw new Error("ກະລຸນາປ້ອນອີເມວ ແລະ ຊື່");
      if (roles.size === 0) throw new Error("ກະລຸນາເລືອກສິດຢ່າງໜ້ອຍ 1");
      if (!sendInvite && password && password.length < 8)
        throw new Error("ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 8 ຕົວ");
      return await createFn({
        data: {
          email: email.trim(),
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          password: sendInvite ? null : password || null,
          roles: Array.from(roles),
          sendInvite,
        },
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin", "profiles"] });
      qc.invalidateQueries({ queryKey: ["admin", "user_roles"] });
      if (res?.tempPassword) {
        toast.success(`ສ້າງສຳເລັດ — ລະຫັດຊົ່ວຄາວ: ${res.tempPassword}`, { duration: 15000 });
      } else if (sendInvite) {
        toast.success("ສົ່ງຄຳເຊີນທາງອີເມວແລ້ວ");
      } else {
        toast.success("ສ້າງບັນຊີສຳເລັດ");
      }
      reset();
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message || "ບໍ່ສຳເລັດ"),
  });

  function toggleRole(r: AppRole) {
    const n = new Set(roles);
    if (n.has(r)) n.delete(r);
    else n.add(r);
    setRoles(n);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus />
          ເພີ່ມພະນັກງານ
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ເພີ່ມພະນັກງານໃໝ່</DialogTitle>
          <DialogDescription>
            ສ້າງບັນຊີໃໝ່ ແລະ ມອບສິດທັນທີ ຫຼື ສົ່ງຄຳເຊີນທາງອີເມວ
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>ຊື່ເຕັມ</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>ອີເມວ</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>ເບີໂທ (ຖ້າມີ)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={sendInvite}
              onCheckedChange={(v) => setSendInvite(!!v)}
            />
            ສົ່ງຄຳເຊີນທາງອີເມວ (ໃຫ້ຜູ້ໃຊ້ຕັ້ງລະຫັດເອງ)
          </label>
          {!sendInvite && (
            <div className="space-y-1">
              <Label>ລະຫັດຜ່ານ (ປະວ່າງເພື່ອສ້າງໃຫ້ອັດຕະໂນມັດ)</Label>
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="ຢ່າງໜ້ອຍ 8 ຕົວ"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>ສິດ</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={roles.has(r)}
                    onCheckedChange={() => toggleRole(r)}
                  />
                  {ROLE_LABEL[r]}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={m.isPending}>
            ຍົກເລີກ
          </Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
