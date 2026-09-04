import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/api/axios';
import useAuth from '@/hooks/useAuth';
import { 
  Send, X, Minimize2, Maximize2, 
  RotateCcw, Loader2, Bot, User,
  FileDown, CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BinduMark, BINDU_LOGO } from '@/components/BinduLogo';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const QUICK_ACTIONS = [
  { icon: '📊', label: 'Sales today',       prompt: 'Show me today\'s sales summary across all branches' },
  { icon: '👥', label: 'Lead status',        prompt: 'Give me a breakdown of leads by stage' },
  { icon: '📞', label: 'Call summary',       prompt: 'Summarize recent call outcomes' },
  { icon: '⏰', label: 'Attendance',         prompt: 'What\'s today\'s attendance status?' },
  { icon: '📣', label: 'Campaign ROI',       prompt: 'Which campaigns have the best ROI and reach? Show campaign performance data.', hideForOwner: true },
  { icon: '🌐', label: 'Meta Ads data',      prompt: 'Show Meta Ads and Instagram performance data from connected integrations.', hideForOwner: true },
  { icon: '📈', label: 'Campaign leads',     prompt: 'How many leads came from campaigns this month? Break it down by channel.', hideForOwner: true },
  { icon: '⭐', label: 'Staff performance',  prompt: 'Show me staff performance this month' },
  { icon: '🎂', label: 'Birthdays',          prompt: 'Who has upcoming birthdays in the next 30 days?' },
  { icon: '🎉', label: 'Anniversaries',      prompt: 'Any work anniversaries coming up soon?' },
  { icon: '🏢', label: 'Branch compare',     prompt: 'Compare all branches by gold weight sold, leads, and conversion rate.' },
  { icon: '🔥', label: 'Hot leads',          prompt: 'Show me all hot leads that need urgent follow-up.' },
];

const AdminAIAssistant = () => {
  const { isOwner } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: 'Hello. I am **Bindu Intelligence**, your strategic AI partner.\n\nI have real-time access to your sales, leads, and marketing data. How can I assist your business growth today?' 
    }
  ]);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const { data: suggestionsData } = useQuery({
    queryKey: ['ai-suggestions'],
    queryFn: () => api.get('/ai/suggestions/').then(res => res.data.suggestions),
    enabled: isOpen
  });

  const { data: usageData, refetch: refetchUsage } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: () => api.get('/ai/usage/').then(res => res.data),
    enabled: isOpen
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const chatMutation = useMutation({
    mutationFn: (prompt) => api.post('/ai/chat/', { 
      prompt, 
      history: messages.slice(-6).map(m => ({ role: m.role, parts: [m.content] }))
    }, { timeout: 60000 }),
    onSuccess: (data) => {
      let resp = data.data;
      // Defensive: If the backend returns a StreamingHttpResponse with space padding,
      // Axios might deliver it as a raw string instead of a parsed object.
      if (typeof resp === 'string') {
        const start = resp.indexOf('{');
        const end = resp.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          const cleanJson = resp.substring(start, end + 1);
          try {
            resp = JSON.parse(cleanJson);
          } catch (e) {
            console.error("Failed to parse extracted streaming AI JSON:", e, "Cleaned:", cleanJson);
          }
        } else {
          console.warn("Could not find JSON bounds in raw response string:", resp);
        }
      }
      
      const responseText = resp?.response || 
        (resp && typeof resp === 'object' ? (resp.detail || resp.error || JSON.stringify(resp)) : String(resp || '')) ||
        "I processed your request but encountered a response parsing anomaly.";
      setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
      refetchUsage();
      if (resp?.rate_limited) {
        setRateLimited(true);
        setCooldown(35);
        const timer = setInterval(() => {
          setCooldown(s => {
            if (s <= 1) { clearInterval(timer); setRateLimited(false); return 0; }
            return s - 1;
          });
        }, 1000);
      }
    },
    onError: (error) => {
      let resp = error.response?.data;
      if (typeof resp === 'string') {
        const start = resp.indexOf('{');
        const end = resp.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          try {
            resp = JSON.parse(resp.substring(start, end + 1));
          } catch (e) {}
        }
      }
      const status = error.response?.status;
      const isQuota = status === 429 || resp?.error === 'rate_limit';
      let msg = resp?.response || resp?.detail || resp?.error || "Connection timed out. Please try again.";
      setMessages(prev => [...prev, { role: 'assistant', content: isQuota ? msg : `⚠️ **Error:** ${msg}` }]);
      if (isQuota) {
        setRateLimited(true);
        setCooldown(35);
        const timer = setInterval(() => {
          setCooldown(s => {
            if (s <= 1) { clearInterval(timer); setRateLimited(false); return 0; }
            return s - 1;
          });
        }, 1000);
      }
    }
  });

  const handleSend = (text = input) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    chatMutation.mutate(text);
  };

  const downloadReportPDF = (content) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // 1. Premium Header
      doc.setFillColor(201, 151, 42); // #C9972A
      doc.rect(0, 0, pageWidth, 45, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('BINDU INTELLIGENCE', 20, 25);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('STRATEGIC BUSINESS ANALYTICS REPORT', 20, 34);
      doc.setFontSize(8);
      doc.text(`REPORT ID: BI-${new Date().getTime()}`, pageWidth - 70, 25);
      doc.text(`DATE: ${new Date().toLocaleDateString()}`, pageWidth - 70, 32);

      let cursorY = 60;

      // 2. Content Parser (Handle text and tables)
      const lines = content.split('\n'); 

      let currentTableRows = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('|') && line.includes('|')) {
          if (!line.includes('---')) {
            const rowData = line.split('|')
              .filter(c => c.trim() !== '')
              .map(c => c.trim().replace(/[^\x00-\x7F]/g, "")); // Strip non-ASCII
            if (rowData.length > 0) currentTableRows.push(rowData);
          }
        } else {
          if (currentTableRows.length > 0) {
            autoTable(doc, {
              startY: cursorY,
              head: [currentTableRows[0]],
              body: currentTableRows.slice(1),
              theme: 'grid',
              headStyles: { fillColor: [201, 151, 42] },
              margin: { left: 20, right: 20 }
            });
            cursorY = doc.lastAutoTable.finalY + 10;
            currentTableRows = [];
          }
          
          if (line) {
            // 1. Detect if the line should be bold
            const isBold = line.includes('**') || line.startsWith('#');
            
            // 2. Remove Markdown characters
            let cleanText = line.replace(/[#*`]/g, '').trim();
            cleanText = cleanText.replace(/[^\x00-\x7F]/g, "").trim(); 
            
            if (cleanText) {
              doc.setTextColor(40, 40, 40);
              doc.setFont('helvetica', isBold ? 'bold' : 'normal');
              doc.setFontSize(isBold ? 11 : 10);
              
              const wrappedText = doc.splitTextToSize(cleanText, pageWidth - 40);
              if (cursorY + (wrappedText.length * 5) > pageHeight - 30) {
                doc.addPage();
                cursorY = 20;
              }
              doc.text(wrappedText, 20, cursorY);
              cursorY += (wrappedText.length * 5) + 3;
            }
          }
        }
      }
      
      // Final table check
      if (currentTableRows.length > 0) {
        autoTable(doc, {
          startY: cursorY,
          head: [currentTableRows[0]],
          body: currentTableRows.slice(1),
          theme: 'grid',
          headStyles: { fillColor: [201, 151, 42] }
        });
      }

      // 3. Footer Branding (Applied to all pages)
      const totalPages = doc.internal.getNumberOfPages();
      for (let j = 1; j <= totalPages; j++) {
        doc.setPage(j);
        doc.setDrawColor(201, 151, 42);
        doc.line(20, pageHeight - 25, pageWidth - 20, pageHeight - 25);
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(8);
        doc.text('This report is developed by BI powered by Bindu Intelligence', 20, pageHeight - 15);
        doc.text(`Page ${j} of ${totalPages}`, pageWidth - 35, pageHeight - 15);
      }

      doc.save(`Bindu_Report_${new Date().getTime()}.pdf`);
    } catch (err) {
      console.error("PDF Generation Error:", err);
      alert("Could not generate PDF. Please try again or check console.");
    }
  };

  if (!isOwner) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-none font-sans">
      {isOpen && (
        <div className={cn(
          "pointer-events-auto flex flex-col overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
          "bg-white border border-gray-200 shadow-[0_20px_60px_rgba(0,0,0,0.15)] rounded-[2rem]",
          isMinimized ? "w-80 h-16" : cn(isExpanded ? "w-[700px]" : "w-[420px]", "max-w-[95vw] h-[600px] max-h-[85vh]")
        )}>
          {/* Header */}
          <div className="bg-white p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="relative">
                <BinduMark size={48} className="rounded-2xl" />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-sm shadow-emerald-500/50" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 tracking-tight">Bindu Intelligence</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
                  Powered by <span className="text-[#C9972A]">Bictree</span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button onClick={() => setMessages([{ role: 'assistant', content: 'Chat history cleared. How can I help?' }])} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-all"><RotateCcw size={15} /></button>
              <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-all hidden sm:block"><Maximize2 size={15} /></button>
              <button onClick={() => setIsMinimized(!isMinimized)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-all"><Minimize2 size={15} /></button>
              <button onClick={() => setIsOpen(false)} className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"><X size={15} /></button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {usageData && (
                <div className="px-5 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-24 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full transition-all duration-1000", usageData.exceeded ? "bg-red-500" : "bg-[#C9972A]")}
                        style={{ width: `${(usageData.used / usageData.limit) * 100}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-gray-500">{usageData.used}/{usageData.limit} AI REQS</span>
                  </div>
                  <span className="text-[9px] font-black text-[#C9972A] uppercase tracking-widest opacity-70">Enterprise Intelligence</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#FAFAFA]" ref={scrollRef}>
                {messages.map((m, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "flex gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500",
                      m.role === 'user' ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                      m.role === 'user' 
                        ? "bg-[#1A5490] text-white" 
                        : "bg-white text-[#C9972A] border border-gray-100"
                    )}>
                      {m.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                    </div>
                    <div className="flex flex-col gap-2 max-w-[85%]">
                      <div className={cn(
                        "p-4 rounded-[1.5rem] text-[13px] leading-relaxed shadow-sm transition-all",
                        m.role === 'user' 
                          ? "bg-[#1A5490] text-white rounded-tr-none font-medium" 
                          : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
                      )}>
                        {m.role === 'assistant' ? (
                          <div className="prose prose-sm max-w-none 
                            prose-headings:text-[#C9972A] prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2
                            prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-3
                            prose-strong:text-gray-900 prose-strong:font-bold
                            prose-table:border-gray-200 prose-th:text-[#C9972A] prose-th:uppercase prose-th:text-[10px] prose-th:tracking-widest
                            prose-td:text-gray-600 prose-td:border-gray-100
                            prose-ul:my-2 prose-li:my-1">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {m.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          m.content
                        )}
                      </div>
                      
                      {m.role === 'assistant' && m.content && (m.content.includes('|') || m.content.includes('##') || m.content.length > 200) && (
                        <button 
                          onClick={() => downloadReportPDF(m.content)}
                          className="self-start flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-50 text-[#C9972A] rounded-full text-[10px] font-bold transition-all border border-gray-200 hover:border-[#C9972A] shadow-sm active:scale-95"
                        >
                          <FileDown size={14} />
                          Download Report PDF
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {chatMutation.isPending && (
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-white text-[#C9972A] flex items-center justify-center shrink-0 border border-gray-100 shadow-sm">
                      <Bot size={18} className="animate-pulse" />
                    </div>
                    <div className="bg-white p-4 rounded-[1.5rem] rounded-tl-none border border-gray-100 flex items-center gap-1.5 shadow-sm">
                      <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-duration:0.6s]" />
                      <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-duration:0.6s] [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-duration:0.6s] [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
              </div>

              {messages.length <= 1 && (
                <div className="px-5 py-3 flex gap-2 overflow-x-auto no-scrollbar bg-white border-t border-gray-50">
                  {QUICK_ACTIONS.filter(a => !(isOwner && a.hideForOwner)).slice(0, 6).map((action, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(action.prompt)}
                      className="whitespace-nowrap flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-[#C9972A]/5 border border-gray-100 hover:border-[#C9972A]/20 rounded-full text-[11px] font-bold text-gray-600 hover:text-[#C9972A] transition-all"
                    >
                      <span>{action.icon}</span>
                      {action.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="p-5 bg-white border-t border-gray-100">
                {rateLimited && (
                  <div className="mb-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-2xl text-[10px] text-amber-600 font-bold flex items-center gap-2 uppercase tracking-wider">
                    <Loader2 size={12} className="animate-spin" />
                    Cooling down: {cooldown}s remaining
                  </div>
                )}
                <div className="relative flex items-center gap-3">
                  <div className="flex-1">
                    <input 
                      ref={inputRef}
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C9972A]/20 focus:border-[#C9972A]/50 transition-all placeholder:text-gray-400 disabled:opacity-50"
                      placeholder={rateLimited ? "Please wait…" : "Ask Bindu Intelligence..."}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !rateLimited && handleSend()}
                      disabled={rateLimited}
                    />
                  </div>
                  <button 
                    className="h-12 w-12 shrink-0 bg-[#C9972A] hover:bg-[#B08420] text-white rounded-2xl shadow-lg shadow-[#C9972A]/20 flex items-center justify-center transition-all disabled:opacity-30"
                    onClick={() => handleSend()}
                    disabled={!input.trim() || chatMutation.isPending || rateLimited}
                  >
                    {chatMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <button 
        onClick={() => {
          setIsOpen(true);
          setIsMinimized(false);
        }}
        className={cn(
          "w-14 h-14 rounded-full bg-[#0F172A] border-2 border-[#C9972A] shadow-xl shadow-[#C9972A]/25 flex items-center justify-center transition-all duration-300 hover:shadow-2xl hover:shadow-[#C9972A]/40 hover:-translate-y-1 active:scale-95 group pointer-events-auto relative overflow-hidden",
          isOpen ? "scale-0 opacity-0 pointer-events-none translate-y-10" : "scale-100 opacity-100 translate-y-0"
        )}
      >
        <img src={BINDU_LOGO} alt="Bindu Intelligence" className="w-8 h-8 object-contain relative z-10 transition-transform duration-300 group-hover:scale-110" />
      </button>
    </div>
  );
};

export default AdminAIAssistant;
