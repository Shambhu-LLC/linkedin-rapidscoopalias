import { useState, useEffect, useCallback, useRef } from "react";

interface SpeechToTextOptions {
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
  continuous?: boolean;
  interimResults?: boolean;
  language?: string;
}

interface SpeechToTextReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  isSupported: boolean;
  error: string | null;
}

// Extend Window interface for SpeechRecognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

export function useSpeechToText(options: SpeechToTextOptions = {}): SpeechToTextReturn {
  const {
    onResult,
    onError,
    continuous = true,
    interimResults = true,
    language = "en-US",
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  
  // Check if browser supports speech recognition
  const isSupported = typeof window !== "undefined" && 
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const createRecognition = useCallback(() => {
    if (!isSupported) return null;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = language;
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimText = "";
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }
      
      if (finalTranscript) {
        setTranscript((prev) => prev + finalTranscript);
        onResult?.(finalTranscript);
      }
      setInterimTranscript(interimText);
    };
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      const errorMessage = getErrorMessage(event.error);
      setError(errorMessage);
      onError?.(errorMessage);
      setIsListening(false);
    };
    
    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
    };
    
    return recognition;
  }, [isSupported, continuous, interimResults, language, onResult, onError]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      const msg = "Speech recognition is not supported in this browser";
      setError(msg);
      onError?.(msg);
      return;
    }
    
    setError(null);
    setTranscript("");
    setInterimTranscript("");
    
    recognitionRef.current = createRecognition();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
        setError("Failed to start speech recognition");
      }
    }
  }, [isSupported, createRecognition, onError]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    isSupported,
    error,
  };
}

function getErrorMessage(error: string): string {
  switch (error) {
    case "not-allowed":
      return "Microphone access denied. Please allow microphone access.";
    case "no-speech":
      return "No speech detected. Please try again.";
    case "network":
      return "Network error. Please check your connection.";
    case "audio-capture":
      return "No microphone found. Please connect a microphone.";
    case "aborted":
      return "Speech recognition was aborted.";
    default:
      return `Speech recognition error: ${error}`;
  }
}
