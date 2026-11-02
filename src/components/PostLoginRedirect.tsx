import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/** Po logowaniu przez Google (pełne przeładowanie) wraca na stronę zapisaną w sessionStorage (np. /shop). */
export function PostLoginRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading || !user) return;
    try {
      const next = sessionStorage.getItem("gr_next");
      if (next && next.startsWith("/") && !next.startsWith("//")) {
        sessionStorage.removeItem("gr_next");
        navigate(next, { replace: true });
      }
    } catch { /* ignore */ }
  }, [user, loading, navigate]);
  return null;
}
