import { useState, useRef, useEffect } from 'react';
import { useApp } from '../store';
import { askNexusCopilot, type CopilotMessage } from '../lib/gemini';

export default function NexusCopilot() {
  const { entities, relationships, crimeEvents, submittedReports, firDocuments, anomalies } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      sender: 'copilot',
      text: 'NEXUS Intelligence Assistant online. Case graph, FIR registry, and temporal anomalies loaded. Select an intelligence audit directive below or input specific case parameters.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new message or during typing
  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typingText, isOpen]);

  // Terminal-grade Typewriter Effect for AI answers
  const streamResponse = (fullText: string) => {
    setIsTyping(true);
    setTypingText('');
    let index = 0;
    const speed = 12; // Milliseconds per character chunk

    const timer = setInterval(() => {
      index += 3;
      if (index >= fullText.length) {
        clearInterval(timer);
        setIsTyping(false);
        setTypingText('');
        setMessages(prev => [
          ...prev,
          {
            sender: 'copilot',
            text: fullText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        setTypingText(fullText.slice(0, index));
      }
    }, speed);
  };

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || loading || isTyping) return;

    const userMsg: CopilotMessage = {
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const reply = await askNexusCopilot(query, {
      entities,
      relationships,
      crimes: crimeEvents,
      submittedReports,
      firDocuments,
      anomalies,
    });

    setLoading(false);
    streamResponse(reply);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-[#0B3D91] hover:bg-[#1A52B8] text-white px-4 py-2.5 rounded-full shadow-lg border border-blue-300/30 transition-all font-semibold text-xs tracking-wide cursor-pointer"
        aria-label="Open NEXUS Assistant"
      >
        <svg className="w-4 h-4 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <span>NEXUS Assistant</span>
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
      </button>

      {/* Intelligence Drawer (Executive White & Navy Blue) */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-[94vw] sm:w-[490px] h-[610px] max-h-[82vh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-800">
          {/* Header */}
          <header className="bg-[#0B3D91] px-4 py-3 flex items-center justify-between text-white border-b border-blue-900">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-blue-950/80 flex items-center justify-center text-blue-200 border border-blue-400/20">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-xs tracking-wider uppercase text-white">NEXUS Intelligence Engine</h3>
                <p className="text-[10px] text-blue-200">MHA / NCRB Criminal Network Forensics</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-blue-200 hover:text-white p-1 rounded-md hover:bg-blue-800 transition-colors"
              title="Close Assistant"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>

          {/* Quick Intelligence Directives */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex gap-2 overflow-x-auto text-[11px]">
            <button
              onClick={() => handleSend('Audit all registered FIRs and identify potential fake, uncorroborated, or contradictory filings.')}
              className="whitespace-nowrap px-3 py-1 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-[#0B3D91] font-semibold transition-colors shadow-xs"
            >
              Audit False / Fake FIRs
            </button>
            <button
              onClick={() => handleSend('Identify the primary mastermind and kingpin orchestrating these crime events.')}
              className="whitespace-nowrap px-3 py-1 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-[#0B3D91] font-medium transition-colors shadow-xs"
            >
              Identify Mastermind
            </button>
            <button
              onClick={() => handleSend('Analyze burner phone anomalies and pre-crime contact spikes across jurisdictions.')}
              className="whitespace-nowrap px-3 py-1 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-[#0B3D91] font-medium transition-colors shadow-xs"
            >
              Burner SIM Alerts
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-slate-50/60 text-xs leading-relaxed font-sans">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-xl p-3.5 whitespace-pre-wrap ${
                    m.sender === 'user'
                      ? 'bg-[#0B3D91] text-white rounded-tr-xs shadow-xs font-medium'
                      : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs shadow-xs'
                  }`}
                >
                  {m.text}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">{m.timestamp}</span>
              </div>
            ))}

            {/* Live Streaming Typewriter Bubble */}
            {isTyping && (
              <div className="flex flex-col items-start">
                <div className="max-w-[90%] rounded-xl p-3.5 whitespace-pre-wrap bg-white text-slate-800 border border-blue-200 rounded-tl-xs shadow-xs font-mono text-[11px] leading-relaxed">
                  {typingText}
                  <span className="inline-block w-1.5 h-3.5 bg-[#0B3D91] ml-0.5 animate-pulse align-middle" />
                </div>
                <span className="text-[10px] text-blue-600 mt-1 px-1 font-sans font-medium">
                  Streaming forensic assessment...
                </span>
              </div>
            )}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex items-center gap-2 text-slate-500 text-xs p-2.5 bg-white rounded-lg border border-slate-200 inline-block shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#0B3D91] animate-ping" />
                <span>Accessing intelligence repository and cross-referencing FIRs...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 bg-white border-t border-slate-200 flex gap-2 items-center"
          >
            <input
              type="text"
              value={input}
              disabled={loading || isTyping}
              onChange={e => setInput(e.target.value)}
              placeholder="Enter investigative inquiry (e.g. 'Audit false FIRs', 'Trace Irfan')..."
              className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3D91] focus:bg-white transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || isTyping || !input.trim()}
              className="bg-[#0B3D91] hover:bg-[#1A52B8] disabled:opacity-40 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Execute
            </button>
          </form>
        </div>
      )}
    </>
  );
}