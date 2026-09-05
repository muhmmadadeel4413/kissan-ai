import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { useI18n } from "../../context/PreferencesContext";

/**
 * Reusable error state. Shows an understandable, actionable message — never a
 * raw error code or stack trace.
 */
export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  return (
    <Alert variant="danger">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle>{title ?? t("common.somethingWrong")}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{message ?? t("common.couldntLoad")}</span>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t("common.tryAgain")}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}