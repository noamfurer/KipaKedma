"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { products } from "./catalog";

type ReservationRequest = {
  id: string;
  customerName: string;
  phone: string;
  note: string;
  skus: string[];
  total: number;
  status: "pending";
  createdAt: string;
};

type ReservedItem = {
  sku: string;
  requestId: string;
  createdAt: string;
};

type ReleasedItem = ReservedItem & {
  releasedAt: string;
};

type AdminData = {
  authenticated: true;
  requests: ReservationRequest[];
  reserved: ReservedItem[];
  releases: ReleasedItem[];
};

type AdminPanelProps = {
  open: boolean;
  onClose: () => void;
  onRestore: (sku: string) => void;
};

const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function productName(sku: string) {
  return products.find((product) => product.sku === sku)?.name ?? sku;
}

export default function AdminPanel({ open, onClose, onRestore }: AdminPanelProps) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [reactivatingSku, setReactivatingSku] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/reservations", { cache: "no-store" });
      if (response.status === 401) {
        setAuthenticated(false);
        setData(null);
        return;
      }
      const result = (await response.json()) as AdminData & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "לא הצלחנו לטעון את הנתונים.");
      setAuthenticated(true);
      setData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "לא הצלחנו לטעון את הנתונים.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("admin-is-open");
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => {
      window.clearTimeout(timer);
      document.body.classList.remove("admin-is-open");
    };
  }, [open, refresh]);

  const requestsById = useMemo(
    () => new Map((data?.requests ?? []).map((request) => [request.id, request])),
    [data],
  );

  if (!open) return null;

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "לא הצלחנו להתחבר.");
        return;
      }
      setPassword("");
      await refresh();
    } catch {
      setMessage("לא הצלחנו להתחבר. נסו שוב.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setData(null);
    setMessage("");
  }

  async function reactivate(sku: string) {
    setReactivatingSku(sku);
    setMessage("");
    try {
      const response = await fetch("/api/admin/reservations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "לא הצלחנו להחזיר את הכיפה למלאי.");
        return;
      }
      onRestore(sku);
      await refresh();
    } catch {
      setMessage("לא הצלחנו להחזיר את הכיפה למלאי.");
    } finally {
      setReactivatingSku("");
    }
  }

  return (
    <div className="admin-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section className="admin-panel" role="dialog" aria-modal="true" aria-labelledby="admin-title">
        <header className="admin-header">
          <div>
            <p>ניהול קטלוג</p>
            <h2 id="admin-title">הגדרות ומסד נתונים</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="סגירת אזור הניהול">×</button>
        </header>

        {authenticated !== true ? (
          <form className="admin-login" onSubmit={login}>
            <span className="admin-lock" aria-hidden="true">●</span>
            <h3>כניסה למנהלת הקטלוג</h3>
            <p>הזינו את הסיסמה כדי לצפות בהזמנות ולנהל את זמינות הכיפות.</p>
            <label>
              סיסמה
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                autoFocus
              />
            </label>
            {message && <p className="admin-message" role="alert">{message}</p>}
            <button className="admin-primary" type="submit" disabled={loading}>
              {loading ? "מתחברת..." : "כניסה מאובטחת"}
            </button>
          </form>
        ) : (
          <div className="admin-content">
            <div className="admin-toolbar">
              <div className="admin-stats">
                <article><span>כיפות פעילות</span><strong>{products.length - (data?.reserved.length ?? 0)}</strong></article>
                <article><span>כיפות שמורות</span><strong>{data?.reserved.length ?? 0}</strong></article>
                <article><span>בקשות שנשמרו</span><strong>{data?.requests.length ?? 0}</strong></article>
              </div>
              <div className="admin-tools">
                <button type="button" onClick={() => void refresh()} disabled={loading}>רענון</button>
                <button type="button" onClick={() => void logout()}>יציאה</button>
              </div>
            </div>

            {message && <p className="admin-message" role="alert">{message}</p>}

            <section className="admin-section">
              <div className="admin-section-title">
                <div><span>מלאי</span><h3>כיפות שאינן פעילות כרגע</h3></div>
                <small>{data?.reserved.length ?? 0} פריטים</small>
              </div>
              {data?.reserved.length ? (
                <div className="admin-reserved-list">
                  {data.reserved.map((item) => {
                    const customer = requestsById.get(item.requestId);
                    return (
                      <article key={item.sku}>
                        <div>
                          <strong>{productName(item.sku)}</strong>
                          <span>{item.sku} · {formatDate(item.createdAt)}</span>
                          {customer && <small>{customer.customerName} · {customer.phone}</small>}
                        </div>
                        <button
                          type="button"
                          onClick={() => void reactivate(item.sku)}
                          disabled={reactivatingSku === item.sku}
                        >
                          {reactivatingSku === item.sku ? "מחזירה..." : "החזרה למלאי"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="admin-empty">כל הכיפות פעילות ומוצגות בקטלוג.</p>
              )}
            </section>

            <section className="admin-section">
              <div className="admin-section-title">
                <div><span>מסד הנתונים</span><h3>כל הבקשות</h3></div>
                <small>{data?.requests.length ?? 0} בקשות</small>
              </div>
              {data?.requests.length ? (
                <div className="admin-request-list">
                  {data.requests.map((request) => (
                    <article key={request.id}>
                      <div className="admin-request-head">
                        <div><strong>{request.customerName}</strong><a href={`tel:${request.phone}`}>{request.phone}</a></div>
                        <time>{formatDate(request.createdAt)}</time>
                      </div>
                      <div className="admin-request-skus">
                        {request.skus.map((sku) => <span key={sku}>{sku} · {productName(sku)}</span>)}
                      </div>
                      <div className="admin-request-foot">
                        <strong>{request.total} ש״ח</strong>
                        {request.note && <p>{request.note}</p>}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="admin-empty">עדיין לא נשמרו בקשות.</p>
              )}
            </section>

            <section className="admin-section admin-history">
              <div className="admin-section-title">
                <div><span>היסטוריה</span><h3>כיפות שהוחזרו למלאי</h3></div>
                <small>{data?.releases.length ?? 0} פעולות</small>
              </div>
              {data?.releases.length ? (
                <div className="admin-history-list">
                  {data.releases.map((item, index) => (
                    <p key={`${item.sku}-${item.releasedAt}-${index}`}>
                      <strong>{item.sku}</strong>
                      <span>{productName(item.sku)}</span>
                      <time>{formatDate(item.releasedAt)}</time>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="admin-empty">עדיין לא הוחזרו כיפות למלאי.</p>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
