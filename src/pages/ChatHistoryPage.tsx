import * as React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Loader2, MessageSquareText, MessagesSquare } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { PageHeader } from "../components/layout/page-header";
import { EmptyState } from "../components/layout/empty-state";
import { useFarm } from "../context/FarmContext";
import { listConversations } from "../lib/chat-service";

export default function ChatHistoryPage() {
  const { farm } = useFarm();
  const [conversations, setConversations] = React.useState<
    Array<{ id: string; farmId: string; title: string; createdAt: string; updatedAt: string }>
  >([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    if (!farm) {
      setConversations([]);
      setStatus("ready");
      return;
    }
    setStatus("loading");
    setError(null);
    listConversations(farm.id)
      .then((rows) => {
        setConversations(rows);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : "We couldn't load your conversations. Please try again."
        );
        setStatus("error");
      });
  }, [farm]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (!farm) {
    return (
      <div className="space-y-6">
        <PageHeader title="Chat History" subtitle="Past conversations" />
        <EmptyState
          icon={<MessagesSquare className="h-6 w-6" />}
          title="Set up your farm first"
          description="Your saved conversations will appear here once you've set up your farm."
          action={
            <Button asChild>
              <Link to="/farm-setup">Create Farm</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chat History"
        subtitle={
          farm
            ? `Past conversations for your ${farm.currentCrop} farm`
            : "Review past conversations"
        }
      />

      {status === "loading" ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          Loading your conversations…
        </div>
      ) : null}

      {status === "error" ? (
        <EmptyState
          icon={<MessagesSquare className="h-6 w-6" />}
          title="We couldn't load your conversations"
          description={error ?? "Please try again."}
          action={
            <Button variant="outline" onClick={load}>
              Try again
            </Button>
          }
        />
      ) : null}

      {status === "ready" && conversations.length === 0 ? (
        <EmptyState
          icon={<MessagesSquare className="h-6 w-6" />}
          title="No conversations yet"
          description="Ask Kissan AI anything about your farm and your conversations will be saved here — so you can pick up where you left off."
          action={
            <Button asChild>
              <Link to="/assistant">Start a conversation</Link>
            </Button>
          }
        />
      ) : null}

      {status === "ready" && conversations.length > 0 ? (
        <div className="space-y-2.5">
          {conversations.map((c) => (
            <Link
              key={c.id}
              to={`/assistant?conversation=${c.id}`}
              className="block cursor-pointer"
            >
              <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/60">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <MessageSquareText className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Last activity{" "}
                    {new Date(c.updatedAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Card>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}