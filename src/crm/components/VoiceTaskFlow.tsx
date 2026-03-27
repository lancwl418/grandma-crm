import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, X, User, Calendar, FileText, ChevronDown, RotateCcw } from "lucide-react";
import type { Client, ClientLog } from "@/crm/types";
import { parseVoiceTask, type VoiceTaskResult } from "@/crm/utils/voiceTaskParser";
import { formatDateForNextAction } from "@/crm/utils/dashboardTasks";

type Step = "recording" | "preview";

interface Props {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  onAddLog: (log: ClientLog, client: Client) => void;
}

function formatDateDisplay(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const labels: Record<number, string> = { 0: "今天", 1: "明天", 2: "后天" };
  const dateStr = `${d.getMonth() + 1}月${d.getDate()}日`;
  if (diff in labels) return `${labels[diff]}（${dateStr}）`;
  return dateStr;
}

const VoiceTaskFlow: React.FC<Props> = ({ open, onClose, clients, onAddLog }) => {
  const [step, setStep] = useState<Step>("recording");
  const [result, setResult] = useState<VoiceTaskResult | null>(null);

  // editable preview state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [actionText, setActionText] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  const recognitionRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);

  const reset = useCallback(() => {
    setStep("recording");
    setResult(null);
    setSelectedClient(null);
    setSelectedDate("");
    setActionText("");
    setShowClientPicker(false);
    setClientSearch("");
    setIsRecording(false);
  }, []);

  // Init speech recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript as string;
      setIsRecording(false);
      handleVoiceResult(text);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start recording when opened
  useEffect(() => {
    if (open && step === "recording") {
      startRecording();
    }
    return () => {
      if (recognitionRef.current && isRecording) {
        recognitionRef.current.stop();
      }
    };
  }, [open, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const startRecording = () => {
    if (!recognitionRef.current) return;
    try {
      setIsRecording(true);
      recognitionRef.current.start();
    } catch {
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleVoiceResult = (text: string) => {
    const parsed = parseVoiceTask(text, clients);
    setResult(parsed);
    setSelectedClient(parsed.clientMatches[0]?.client ?? null);
    setSelectedDate(parsed.date ? formatDateForNextAction(parsed.date) : "");
    setActionText(parsed.action);
    setStep("preview");
  };

  const handleSubmit = () => {
    if (!selectedClient || !selectedDate || !actionText.trim()) return;

    const log: ClientLog = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      content: `语音建任务：${actionText.trim()}`,
      nextAction: `${selectedDate}：${actionText.trim()}`,
      nextActionTodo: actionText.trim(),
    };

    onAddLog(log, selectedClient);
    reset();
    onClose();
  };

  const handleClose = () => {
    stopRecording();
    reset();
    onClose();
  };

  const filteredClients = clients.filter((c) => {
    if (!clientSearch) return true;
    const q = clientSearch.toLowerCase();
    return (
      (c.remarkName && c.remarkName.toLowerCase().includes(q)) ||
      (c.name && c.name.toLowerCase().includes(q))
    );
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-md p-4 sm:p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-bold">语音建任务</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step 1: Recording */}
        {step === "recording" && (
          <div className="flex flex-col items-center py-8 space-y-6">
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                isRecording
                  ? "bg-red-100 text-red-600 animate-pulse shadow-lg shadow-red-200"
                  : "bg-blue-100 text-blue-600 hover:bg-blue-200"
              }`}
            >
              <Mic className="h-10 w-10" />
            </button>
            <p className="text-sm text-gray-500">
              {isRecording ? "正在聆听，请说出任务..." : "点击麦克风开始说话"}
            </p>
            <p className="text-xs text-gray-400">
              例如：&quot;明天给投资客打电话跟进看房&quot;
            </p>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && result && (
          <div className="space-y-4">
            {/* 识别原文 */}
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">识别结果</p>
              <p className="text-sm text-gray-700">&quot;{result.raw}&quot;</p>
            </div>

            {/* 客户 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                <span className="font-medium">客户</span>
              </div>
              {!showClientPicker ? (
                <button
                  type="button"
                  onClick={() => setShowClientPicker(true)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition flex items-center justify-between ${
                    selectedClient
                      ? "border-green-200 bg-green-50"
                      : "border-orange-200 bg-orange-50"
                  }`}
                >
                  <span className="text-sm">
                    {selectedClient
                      ? `${selectedClient.remarkName || selectedClient.name}`
                      : "未识别到客户，点击选择"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="搜索客户..."
                    className="w-full px-3 py-2 text-sm border-b border-gray-100 focus:outline-none"
                    autoFocus
                  />
                  <div className="max-h-40 overflow-y-auto">
                    {filteredClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedClient(c);
                          setShowClientPicker(false);
                          setClientSearch("");
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition flex items-center justify-between ${
                          selectedClient?.id === c.id ? "bg-blue-50" : ""
                        }`}
                      >
                        <span>{c.remarkName || c.name}</span>
                        <span className="text-xs text-gray-400">{c.status}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 日期 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">日期</span>
                {selectedDate && (
                  <span className="text-xs text-gray-400">
                    {formatDateDisplay(new Date(selectedDate + "T00:00:00"))}
                  </span>
                )}
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:border-blue-400 ${
                  selectedDate ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"
                }`}
              />
            </div>

            {/* 任务内容 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FileText className="h-4 w-4" />
                <span className="font-medium">任务内容</span>
              </div>
              <input
                type="text"
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:border-blue-400 ${
                  actionText.trim() ? "border-green-200 bg-green-50" : "border-orange-200 bg-orange-50"
                }`}
                placeholder="任务描述..."
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  reset();
                  setStep("recording");
                }}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
              >
                <RotateCcw className="h-4 w-4" />
                重说
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!selectedClient || !selectedDate || !actionText.trim()}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                确认添加
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceTaskFlow;
