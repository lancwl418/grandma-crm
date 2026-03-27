import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Bot, MessageCircle, ChevronDown, ChevronRight, MapPin } from "lucide-react";
import type { Client, ClientLog } from "@/crm/types";
import type { FlatTask } from "@/crm/utils/dashboardTasks";
import {
  processInput,
  selectCandidateAsync,
  INITIAL_STATE,
  type AssistantState,
  type AssistantResponse,
  type SideEffect,
  type ClientCandidate,
} from "@/crm/utils/chatEngine";
import BriefingCard from "@/crm/components/BriefingCard";

// ── Types ─────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
  tasks?: FlatTask[];
  candidates?: ClientCandidate[];
  ctaClientId?: string;
  ctaClientName?: string;
}

interface Props {
  clients: Client[];
  overdueTasks: FlatTask[];
  todayTasks: FlatTask[];
  userId?: string;
  /** System notification to inject into chat (change value to trigger) */
  notification?: { id: string; text: string };
  onSideEffect: (effect: SideEffect) => void;
}

const WELCOME_TEXT =
  "你好！我是你的 CRM 助理。试试说：\n「明天提醒我给王小明打电话」\n「今天有什么任务」\n「找一下王小明」";

// ── Component ─────────────────────────────────────────────────

export default function ChatPanel({
  clients,
  overdueTasks,
  todayTasks,
  userId,
  notification,
  onSideEffect,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [assistantState] = useState<AssistantState>(INITIAL_STATE);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", text: WELCOME_TEXT, timestamp: new Date() },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Inject system notifications into chat
  useEffect(() => {
    if (!notification) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === notification.id)) return prev;
      return [
        ...prev,
        {
          id: notification.id,
          role: "assistant" as const,
          text: notification.text,
          timestamp: new Date(),
        },
      ];
    });
  }, [notification]);

  const context = useMemo(
    () => ({ clients, overdueTasks, todayTasks }),
    [clients, overdueTasks, todayTasks]
  );

  const clientForTask = useCallback(
    (task: FlatTask) => clients.find((c) => c.id === task.clientId),
    [clients]
  );

  // ── Build conversation history for API ──────────────────────

  const conversationHistory = useMemo(
    () =>
      messages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.text })),
    [messages]
  );

  // ── Process response from engine ────────────────────────────

  const applyResponse = useCallback(
    (response: AssistantResponse, userText?: string) => {
      const msgs: ChatMessage[] = [];

      if (userText) {
        msgs.push({
          id: `u-${Date.now()}`,
          role: "user",
          text: userText,
          timestamp: new Date(),
        });
      }

      msgs.push({
        id: `a-${Date.now()}`,
        role: "assistant",
        text: response.text,
        timestamp: new Date(),
        tasks: response.tasks,
        candidates: response.candidates,
        ctaClientId: response.ctaClientId,
        ctaClientName: response.ctaClientName,
      });

      setMessages((prev) => [...prev, ...msgs]);

      // Execute side effects
      for (const effect of response.sideEffects) {
        onSideEffect(effect);
      }
    },
    [onSideEffect]
  );

  // ── Send message ──────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string, displayText?: string) => {
      if (!text.trim() || isLoading) return;
      setIsLoading(true);

      try {
        const response = await processInput(
          text,
          assistantState,
          context,
          conversationHistory,
          userId
        );
        applyResponse(response, displayText || text);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, assistantState, context, conversationHistory, applyResponse]
  );

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    sendMessage(text);
  }, [input, sendMessage]);

  // ── Select a candidate card ─────────────────────────────────

  const handleSelectCandidate = useCallback(
    async (clientId: string) => {
      if (isLoading) return;
      setIsLoading(true);

      const client = clients.find((c) => c.id === clientId);
      const name = client?.remarkName || client?.name || "";
      const displayText = `选择了「${name}」`;

      try {
        const response = await selectCandidateAsync(
          clientId,
          context,
          conversationHistory,
          userId
        );
        applyResponse(response, displayText);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, clients, context, conversationHistory, applyResponse]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Collapsed ───────────────────────────────────────────────

  if (!isOpen) {
    return (
      <div className="w-full max-w-md px-4 mt-6 mb-4">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition text-left"
        >
          <MessageCircle className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="text-sm text-gray-400 flex-1">跟助理说点什么...</span>
          <Send className="h-4 w-4 text-gray-300" />
        </button>
      </div>
    );
  }

  // ── Expanded ────────────────────────────────────────────────

  return (
    <div className="w-full max-w-md px-4 mt-4 mb-4 flex flex-col" style={{ maxHeight: "50vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white rounded-t-xl border border-b-0 border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-medium text-gray-700">CRM 助理</span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 border-x border-gray-200 px-3 py-3 space-y-3 min-h-[200px]">
        {messages.map((msg) => (
          <div key={msg.id}>
            {/* Bubble */}
            <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1 mr-2">
                  <Bot className="h-3 w-3 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-line ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-white text-gray-800 border border-gray-100 rounded-bl-sm shadow-sm"
                }`}
              >
                {msg.text}
              </div>
            </div>

            {/* CTA button */}
            {msg.ctaClientId && (
              <div className="ml-8 mt-1.5">
                <button
                  type="button"
                  onClick={() => onSideEffect({ type: "OPEN_CLIENT", clientId: msg.ctaClientId! })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                >
                  查看「{msg.ctaClientName}」
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Candidate cards (disambiguation) */}
            {msg.candidates && msg.candidates.length > 0 && (
              <div className="ml-8 mt-2 space-y-1.5">
                {msg.candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCandidate(c.id)}
                    className="w-full text-left bg-white rounded-lg border border-gray-200 p-3 hover:border-blue-300 hover:shadow-sm transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">{c.name}</span>
                      <span className="text-xs text-gray-400">{c.status}</span>
                    </div>
                    {(c.areas.length > 0 || c.tags.length > 0) && (
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {c.areas.map((a) => (
                          <span key={a} className="inline-flex items-center gap-0.5 text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                            <MapPin className="h-2.5 w-2.5" />{a}
                          </span>
                        ))}
                        {c.tags.slice(0, 3).map((t) => (
                          <span key={t} className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                    {c.phone && (
                      <p className="text-xs text-gray-400 mt-1">{c.phone}</p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Inline task cards */}
            {msg.tasks && msg.tasks.length > 0 && (
              <div className="ml-8 mt-2 space-y-1.5">
                {msg.tasks.map((task) => {
                  const c = clientForTask(task);
                  return (
                    <BriefingCard
                      key={task.id}
                      task={task}
                      clientPhone={c?.phone}
                      clientWechat={c?.wechat}
                      onComplete={(logId) => onSideEffect({ type: "COMPLETE_TASK", logId })}
                      onOpenClient={(id) => onSideEffect({ type: "OPEN_CLIENT", clientId: id })}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1 mr-2">
              <Bot className="h-3 w-3 text-white" />
            </div>
            <div className="px-3 py-2 rounded-xl bg-white border border-gray-100 shadow-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white rounded-b-xl border border-t-0 border-gray-200 shadow-sm">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder={isLoading ? "思考中..." : "输入消息..."}
          className="flex-1 text-sm outline-none bg-transparent disabled:text-gray-300"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className={`p-1.5 rounded-lg transition ${
            input.trim() && !isLoading
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-300"
          }`}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
