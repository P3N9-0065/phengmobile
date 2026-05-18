import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Apple } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        toast.success("ລົງທະບຽນສຳເລັດ! ກຳລັງເຂົ້າສູ່ລະບົບ...");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("ເຂົ້າສູ່ລະບົບສຳເລັດ");
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message || "ເກີດຂໍ້ຜິດພາດ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-20 w-20 rounded-xl bg-black p-2 flex items-center justify-center">
            <Logo className="h-full w-full" />
          </div>
          <CardTitle className="text-2xl">ເພັງ ໂມບາຍ Pheng Mobile</CardTitle>
          <CardDescription>
            {mode === "login" ? "ເຂົ້າສູ່ລະບົບເພື່ອສືບຕໍ່" : "ສ້າງບັນຊີໃໝ່"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">ຊື່ ແລະ ນາມສະກຸນ</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            )}
            <div>
              <Label htmlFor="email">ອີເມວ</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">ລະຫັດຜ່ານ</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "ກຳລັງດຳເນີນການ..." : mode === "login" ? "ເຂົ້າສູ່ລະບົບ" : "ລົງທະບຽນ"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            {mode === "login" ? (
              <button onClick={() => setMode("signup")} className="text-primary hover:underline">
                ຍັງບໍ່ມີບັນຊີ? ລົງທະບຽນທີ່ນີ້
              </button>
            ) : (
              <button onClick={() => setMode("login")} className="text-primary hover:underline">
                ມີບັນຊີແລ້ວ? ເຂົ້າສູ່ລະບົບ
              </button>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground text-center">
            ຜູ້ລົງທະບຽນຄົນທຳອິດຈະເປັນຜູ້ຄຸ້ມຄອງລະບົບອັດຕະໂນມັດ
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
