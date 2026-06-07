import { useState } from 'react';
import { sendChatMessage, type ChatMessage } from '../lib/api';

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Ask me about current prices, active strategies, alerts, and market context connected to this dashboard.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<string>('');

  async function submit() {
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await sendChatMessage(text, messages);
      setMessages([...nextMessages, { role: 'assistant', content: response.answer }]);
      setMeta(
        `${response.model} - ${response.context.latest_market_count} markets - ${response.context.active_strategy_count} strategies - ${response.context.recent_alert_count} alerts`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card chat-panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">DeepSeek Copilot</p>
          <h2>Ask About This Dashboard</h2>
        </div>
        {meta && <span className="pill">{meta}</span>}
      </div>

      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`chat-message ${message.role}`}>
            <span>{message.role === 'user' ? 'You' : 'Copilot'}</span>
            <p>{message.content}</p>
          </div>
        ))}
      </div>

      {error && <div className="chat-error">{error}</div>}

      <div className="chat-input">
        <textarea
          value={input}
          placeholder="Example: Which strategies are close to triggering and why?"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button onClick={submit} disabled={loading || !input.trim()}>
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </div>
    </section>
  );
}
