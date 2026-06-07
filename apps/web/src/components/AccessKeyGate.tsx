import { FormEvent, useState } from 'react';
import { getAccessKey, setAccessKey } from '../lib/api';

type Props = {
  children: React.ReactNode;
};

export default function AccessKeyGate({ children }: Props) {
  const [key, setKey] = useState(getAccessKey());
  const [draft, setDraft] = useState(key);

  function submit(event: FormEvent) {
    event.preventDefault();
    setAccessKey(draft);
    setKey(draft.trim());
  }

  if (!key) {
    return (
      <main className="gate">
        <section className="card gate-card">
          <p className="eyebrow">FinStrategy Access</p>
          <h1>Enter your access key.</h1>
          <p className="muted">
            The dashboard uses paid market, AI, and strategy parsing APIs. Access is restricted while the product is in
            pre-production.
          </p>
          <form onSubmit={submit} className="gate-form">
            <input
              type="password"
              value={draft}
              placeholder="Access key"
              autoComplete="off"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" disabled={!draft.trim()}>
              Unlock
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <>
      <div className="access-bar">
        Protected pre-production dashboard
        <button
          onClick={() => {
            setAccessKey('');
            setKey('');
            setDraft('');
          }}
        >
          Lock
        </button>
      </div>
      {children}
    </>
  );
}
