// src/pages/ChatPage.tsx
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Smile, Send, Phone, MoreVertical } from "lucide-react";

type Message = {
  id: number;
  text: string;
  sender: "me" | "other";
  time: string;
  isFile?: boolean;
  fileName?: string;
};

const mockMessages: Message[] = [
  {
    id: 1,
    sender: "other",
    text: "Hello! I've finished sorting the inbox. Would you like a summary of the urgent items?",
    time: "10:30 AM",
  },
  {
    id: 2,
    sender: "me",
    text: "Yes, please send the PDF report.",
    time: "10:32 AM",
  },
  {
    id: 3,
    sender: "other",
    text: "Here is the report you requested. Let me know if you need any edits.",
    time: "10:35 AM",
    isFile: true,
    fileName: "Weekly_Report.pdf",
  },
];

export default function ChatPage() {
  const [messages] = useState<Message[]>(mockMessages);
  const [newMessage, setNewMessage] = useState("");

  const handleSend = () => {
    if (!newMessage.trim()) return;
    // In real app → send via websocket / supabase realtime
    setNewMessage("");
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 border-b border-slate-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src="/avatars/sarah.jpg" alt="Sarah" />
            <AvatarFallback>SJ</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-white">Sarah Jenkins</h3>
            <p className="text-xs text-green-400 flex items-center gap-1">
              <span className="h-2 w-2 bg-green-500 rounded-full"></span> Online
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" size="icon">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}
          >
            {msg.sender !== "me" && (
              <Avatar className="h-8 w-8 mt-1 mr-2">
                <AvatarImage src="/avatars/sarah.jpg" />
                <AvatarFallback>SJ</AvatarFallback>
              </Avatar>
            )}

            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                msg.sender === "me"
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-slate-800 text-slate-100 rounded-bl-none"
              }`}
            >
              <p className="text-sm">{msg.text}</p>
              {msg.isFile && (
                <div className="mt-2 bg-slate-900/50 p-2 rounded flex items-center gap-2 text-xs">
                  <Paperclip className="h-4 w-4" />
                  <span>{msg.fileName}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto">
                    ↓
                  </Button>
                </div>
              )}
              <span className="text-xs opacity-70 block mt-1 text-right">{msg.time}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Input area */}
      <div className="bg-slate-900/80 border-t border-slate-800 p-4">
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
          <Button variant="ghost" size="icon">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
          <Button variant="ghost" size="icon">
            <Smile className="h-5 w-5" />
          </Button>
          <Button size="icon" onClick={handleSend} disabled={!newMessage.trim()}>
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}