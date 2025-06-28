// src/app/chat/page.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BiSend, BiCamera, BiImage } from 'react-icons/bi';
import Navbar from '@/components/navbar';
import { AuroraBackground } from '@/components/aurora-background';

interface Message {
  text?: string;
  image?: string;
  fromUser: boolean;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() && !preview) return;
    const newMsg: Message = { fromUser: true };
    if (input.trim()) newMsg.text = input.trim();
    if (preview) newMsg.image = preview;
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setPreview(null);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  };

  const startCamera = async () => {
    if (stream) return;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(media);
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        await videoRef.current.play();
      }
    } catch {
      console.warn('Camera not available');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    setPreview(canvas.toDataURL('image/jpeg'));
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
  };

  return (
    <AuroraBackground>
      <Navbar />

      <div className="flex justify-center py-6">
        <div className="w-full max-w-3xl flex flex-col bg-white/20 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden h-[calc(100vh-8rem)]">
          {/* Chat window */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.fromUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs md:max-w-md rounded-lg p-3 shadow ${
                    msg.fromUser
                      ? 'bg-[#0096FF] text-white'
                      : 'bg-white text-black'
                  }`}
                >
                  {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                  {msg.image && (
                    <img
                      src={msg.image}
                      alt="uploaded"
                      className="mt-2 max-h-60 w-auto rounded"
                    />
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Preview / Video */}
          {preview && (
            <div className="px-4 mb-2">
              <img
                src={preview}
                alt="preview"
                className="mx-auto max-h-32 rounded shadow-lg"
              />
            </div>
          )}
          {stream && (
            <div className="px-4 mb-2">
              <video
                ref={videoRef}
                className="mx-auto max-h-32 rounded shadow-lg"
              />
            </div>
          )}

          {/* Input Controls */}
          <div className="flex items-center px-4 pb-4">
            <label className="p-2 text-white hover:text-gray-200 cursor-pointer">
              <BiImage size={24} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
            </label>
            <button
              onClick={stream ? capturePhoto : startCamera}
              className="p-2 text-white hover:text-gray-200"
            >
              <BiCamera size={24} />
            </button>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              rows={1}
              className="flex-1 mx-2 resize-none rounded-lg border border-white/30 bg-black/30 p-2 text-white placeholder-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0096FF]"
              placeholder="Type your prompt here..."
            />
            <button
              onClick={sendMessage}
              className="p-2 text-white hover:text-gray-200"
            >
              <BiSend size={24} />
            </button>
          </div>
        </div>
      </div>
    </AuroraBackground>
  );
}
