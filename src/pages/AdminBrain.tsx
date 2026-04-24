import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { BrainPanel } from "@/components/admin/BrainPanel";
import { Loader2 } from "lucide-react";

const AdminBrain = () => {
  const { isAdmin, loading } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Mózg GrouAI — Admin";
  }, []);

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/");
  }, [loading, isAdmin, navigate]);

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin) return null;

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg border border-primary/30 bg-primary/5">
          <div>
            <div className="font-semibold">Aurora Business Desk</div>
            <div className="text-xs text-muted-foreground">Pełny pulpit autonomicznego biznesu — nisze, zlecenia, n8n</div>
          </div>
          <button onClick={() => navigate("/admin/aurora")} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            Otwórz pulpit →
          </button>
        </div>
        <BrainPanel />
      </div>
    </MainLayout>
  );
};

export default AdminBrain;
