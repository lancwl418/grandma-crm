import React, { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

interface Props {
  onResult: (text: string) => void; // 回传文字
}

const VoiceInputButton: React.FC<Props> = ({ onResult }) => {
  const recognitionRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    // 兼容 Chrome / Safari
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Browser does not support SpeechRecognition.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN"; // 支持中文
    recognition.interimResults = false; // 不需要中间结果
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      onResult(text);
      setIsRecording(false);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
  }, [onResult]);

  const startRecording = () => {
    if (!recognitionRef.current) return;

    setIsRecording(true);
    recognitionRef.current.start();
  };

  const stopRecording = () => {
    if (!recognitionRef.current) return;

    recognitionRef.current.stop();
    setIsRecording(false);
  };

  return (
    <button
      type="button"
      onClick={isRecording ? stopRecording : startRecording}
      className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition 
        ${isRecording ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}
      `}
    >
      {isRecording ? (
        <>
          <Square className="w-4 h-4" />
          停止
        </>
      ) : (
        <>
          <Mic className="w-4 h-4" />
          语音输入
        </>
      )}
    </button>
  );
};

export default VoiceInputButton;
