"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { RichMessageText } from "@/components/game/RichMessageText";
import {
  DEFAULT_SCRIPT_THEME,
  scriptThemeStyle,
  type ScriptTheme,
} from "@/lib/script-themes";
import type { MessageDTO } from "@/types/game";
import { Loader2, Volume2 } from "lucide-react";

export function MessageBubble({
  msg,
  streaming = false,
  avatarUrl,
  theme = DEFAULT_SCRIPT_THEME,
}: {
  msg: Pick<MessageDTO, "senderType" | "senderName" | "content" | "channelType">;
  streaming?: boolean;
  avatarUrl?: string;
  theme?: ScriptTheme;
}) {
  const isPlayer = msg.senderType === "PLAYER";
  const isDM = msg.senderType === "DM";
  const isPrivate = msg.channelType === "PRIVATE";
  const [speaking, setSpeaking] = useState(false);
  const themeStyle = scriptThemeStyle(theme);

  async function speak() {
    const text = msg.content.trim();
    if (!text || speaking) return;
    setSpeaking(true);
    try {
      const res = await fetch("/api/audio/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "TTS 生成失败");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      let timeout: ReturnType<typeof setTimeout> | null = null;
      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        URL.revokeObjectURL(url);
        setSpeaking(false);
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      timeout = setTimeout(cleanup, 30_000);
      void audio.play().catch((err) => {
        console.warn("[tts] play failed", err);
        cleanup();
      });
    } catch (err) {
      setSpeaking(false);
      console.warn("[tts] play failed", err);
    }
  }

  if (isDM) {
    return (
      <div className="my-4 animate-fade-in" style={themeStyle}>
        <div className="script-bubble script-bubble--dm relative mx-auto max-w-[92%] rounded-lg px-5 py-4 pr-10 text-amber-50">
          <div className="mb-2 flex items-center justify-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-primary/85">
            <span className="h-px w-5 bg-primary/40" />
            <span>DM · {theme.label}</span>
            <span className="h-px w-5 bg-primary/40" />
          </div>
          <div className="case-serif text-[15px] leading-[1.95] text-amber-50/95">
            <RichMessageText text={msg.content} />
            {streaming && <Cursor />}
          </div>
          {!streaming && <SpeakButton speaking={speaking} onClick={speak} />}
        </div>
      </div>
    );
  }

  const avatar = <Avatar src={avatarUrl} name={isPlayer ? "你" : msg.senderName} isPlayer={isPlayer} />;

  return (
    <div
      className={cn("my-3 flex animate-fade-in gap-2", isPlayer ? "justify-end" : "justify-start")}
      style={themeStyle}
    >
      {!isPlayer && avatar}
      <div className={cn("max-w-[82%]", isPlayer ? "items-end" : "items-start")}>
        {!isPlayer && (
          <div className="mb-1 ml-1 flex items-center gap-1 text-xs text-muted-foreground">
            <span>{msg.senderName}</span>
            {isPrivate && <span className="rounded-full border border-primary/25 px-1.5 py-0.5 text-[10px] text-primary/90">密谈</span>}
            {!streaming && <SpeakButton compact speaking={speaking} onClick={speak} />}
          </div>
        )}
        <div
          className={cn(
            "script-bubble rounded-2xl px-4 py-2.5 text-sm leading-relaxed text-foreground",
            isPlayer
              ? "script-bubble--me rounded-br-sm"
              : "script-bubble--npc rounded-bl-sm"
          )}
        >
          <RichMessageText text={msg.content} />
          {streaming && <Cursor />}
        </div>
      </div>
      {isPlayer && avatar}
    </div>
  );
}

function Cursor() {
  return <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-current align-middle" />;
}

function SpeakButton({
  speaking,
  compact = false,
  onClick,
}: {
  speaking: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={speaking}
      title="朗读这条消息"
      className={cn(
        "inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-60",
        compact ? "h-5 w-5" : "absolute right-2 top-2 h-6 w-6"
      )}
    >
      {speaking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
    </button>
  );
}

function Avatar({ src, name, isPlayer }: { src?: string; name: string; isPlayer: boolean }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border text-xs font-semibold shadow-sm",
        isPlayer ? "mt-0 border-primary/50 bg-primary/15 text-primary" : "mt-5"
      )}
      style={
        isPlayer
          ? undefined
          : {
              borderColor: "rgba(var(--theme-rgb), 0.6)",
              background: "rgba(var(--theme-rgb), 0.13)",
              color: "rgb(var(--theme-rgb))",
              boxShadow: "0 0 0 1px rgba(var(--theme-rgb),0.12), 0 0 12px rgba(var(--theme-rgb),0.18)",
            }
      }
    >
      {src ? <img src={src} alt={`${name}头像`} className="h-full w-full object-cover" /> : name.slice(0, 1)}
    </div>
  );
}
