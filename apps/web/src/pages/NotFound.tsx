import { useNavigate } from "react-router-dom";
import { TbError404 } from "react-icons/tb";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../ui";

export function NotFound() {
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={TbError404}
      title="Page introuvable"
      action={<Button onClick={() => navigate("/")}>Retour au classement</Button>}
    >
      Cette page n'existe pas (ou plus). Reviens au classement pour continuer.
    </EmptyState>
  );
}
