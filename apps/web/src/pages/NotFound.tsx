import { useNavigate } from "react-router-dom";
import { TbError404 } from "react-icons/tb";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../ui";
import { useTitle } from "../lib/useTitle";

export function NotFound() {
  useTitle("Page introuvable");
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={TbError404}
      title="Page introuvable"
      action={<Button onClick={() => navigate("/")}>Retour à l'accueil</Button>}
    >
      Cette page n'existe pas (ou plus). Reviens à l'accueil pour continuer.
    </EmptyState>
  );
}
