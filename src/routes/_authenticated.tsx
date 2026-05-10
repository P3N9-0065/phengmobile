import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGuard,
});

function AuthGuard() {
  const { session, loading, isStaff } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login" });
    }
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        ກຳລັງໂຫຼດ...
      </div>
    );
  }
  if (!session) return null;

  if (!isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">ບັນຊີຍັງບໍ່ໄດ້ຮັບສິດ</h2>
          <p className="text-muted-foreground">
            ກະລຸນາຕິດຕໍ່ຜູ້ຄຸ້ມຄອງລະບົບເພື່ອໃຫ້ມອບສິດການນຳໃຊ້
          </p>
        </div>
      </div>
    );
  }

  return <AppLayout />;
}
