"use client";

import Image from "next/image";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { type Product } from "./catalog";

type ReservationRequest = {
  id: string;
  customerName: string;
  phone: string;
  note: string;
  productIds?: string[];
  skus: string[];
  total: number;
  status: "pending";
  createdAt: string;
};

type AdminProduct = Product & {
  reserved: boolean;
  available: boolean;
  reservation: { requestId: string; createdAt: string } | null;
};

type ReleasedItem = {
  productId?: string;
  sku: string;
  requestId: string;
  createdAt: string;
  releasedAt: string;
};

type AdminData = {
  authenticated: true;
  categories: string[];
  products: AdminProduct[];
  requests: ReservationRequest[];
  releases: ReleasedItem[];
};

type AdminPanelProps = {
  open: boolean;
  onClose: () => void;
  onCatalogChange: () => void;
};

type ProductEditorProps = {
  product: AdminProduct;
  categories: string[];
  customer?: ReservationRequest;
  busy: boolean;
  onSave: (payload: {
    id: string;
    name: string;
    sku: string;
    price: number;
    diameter: number;
    colorFamily: string;
  }) => Promise<void>;
  onToggle: (product: AdminProduct) => Promise<void>;
};

const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function ProductEditor({
  product,
  categories,
  customer,
  busy,
  onSave,
  onToggle,
}: ProductEditorProps) {
  const [name, setName] = useState(product.name);
  const [sku, setSku] = useState(product.sku);
  const [price, setPrice] = useState(String(product.price));
  const [diameter, setDiameter] = useState(String(product.diameter));
  const [colorFamily, setColorFamily] = useState(product.colorFamily);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave({
      id: product.id,
      name,
      sku,
      price: Number(price),
      diameter: Number(diameter),
      colorFamily,
    });
  }

  return (
    <article className={`admin-product-card${product.available ? " is-active" : " is-inactive"}`}>
      <div className="admin-product-photo">
        <Image src={product.image} alt="" fill unoptimized sizes="96px" />
        <span className={product.available ? "active" : "inactive"}>
          {product.available ? "פעילה" : product.reserved ? "נבחרה" : "כבויה"}
        </span>
      </div>

      <form onSubmit={save}>
        <div className="admin-product-heading">
          <div>
            <small>{product.colorLabel}</small>
            <strong>{product.name}</strong>
          </div>
          <button
            className={`admin-status-button ${product.available ? "deactivate" : "activate"}`}
            type="button"
            disabled={busy}
            onClick={() => void onToggle(product)}
          >
            {product.available
              ? "כיבוי"
              : product.reserved
                ? "הפעלה והחזרה למלאי"
                : "הפעלה"}
          </button>
        </div>

        {product.reserved && (
          <p className="admin-reservation-note">
            הכיפה נשמרה {customer ? `עבור ${customer.customerName}` : "בהזמנה"}
            {product.reservation ? ` בתאריך ${formatDate(product.reservation.createdAt)}` : ""}.
          </p>
        )}

        <div className="admin-product-fields">
          <label className="wide">
            שם הכיפה
            <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required />
          </label>
          <label>
            מק״ט
            <input value={sku} onChange={(event) => setSku(event.target.value)} minLength={2} maxLength={32} dir="ltr" required />
          </label>
          <label>
            מחיר בש״ח
            <input value={price} onChange={(event) => setPrice(event.target.value)} type="number" min="1" max="5000" step="1" required />
          </label>
          <label>
            קוטר בס״מ
            <input value={diameter} onChange={(event) => setDiameter(event.target.value)} type="number" min="1" max="50" step="0.1" required />
          </label>
          <label>
            קטגוריית צבע
            <select value={colorFamily} onChange={(event) => setColorFamily(event.target.value)} required>
              {categories.map((family) => (
                <option key={family} value={family}>{family}</option>
              ))}
            </select>
          </label>
        </div>

        <button className="admin-save-product" type="submit" disabled={busy}>
          {busy ? "שומרת..." : "שמירת פרטי הכיפה"}
        </button>
      </form>
    </article>
  );
}

type CategoryEditorProps = {
  name: string;
  count: number;
  busy: boolean;
  onRename: (previousName: string, name: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
};

function CategoryEditor({
  name: initialName,
  count,
  busy,
  onRename,
  onDelete,
}: CategoryEditorProps) {
  const [name, setName] = useState(initialName);

  return (
    <form
      className="admin-category-card"
      onSubmit={(event) => {
        event.preventDefault();
        void onRename(initialName, name);
      }}
    >
      <label>
        שם הקטגוריה
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={40}
          required
        />
      </label>
      <span>{count} כיפות משויכות</span>
      <div>
        <button type="submit" disabled={busy || name.trim() === initialName}>
          {busy ? "שומרת..." : "שמירת השם"}
        </button>
        <button
          className="delete"
          type="button"
          disabled={busy || count > 0}
          title={count > 0 ? "יש להעביר תחילה את כל הכיפות לקטגוריה אחרת" : undefined}
          onClick={() => void onDelete(initialName)}
        >
          הסרת קטגוריה
        </button>
      </div>
    </form>
  );
}

export default function AdminPanel({
  open,
  onClose,
  onCatalogChange,
}: AdminPanelProps) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);
  const [busyProductId, setBusyProductId] = useState("");
  const [busyCategory, setBusyCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");

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
      setMessageKind("error");
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
  const productsById = useMemo(
    () => new Map((data?.products ?? []).map((product) => [product.id, product])),
    [data],
  );
  const productsBySku = useMemo(
    () => new Map((data?.products ?? []).map((product) => [product.sku, product])),
    [data],
  );
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of data?.products ?? []) {
      counts.set(product.colorFamily, (counts.get(product.colorFamily) ?? 0) + 1);
    }
    return counts;
  }, [data]);

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
        setMessageKind("error");
        setMessage(result.error ?? "לא הצלחנו להתחבר.");
        return;
      }
      setPassword("");
      await refresh();
    } catch {
      setMessageKind("error");
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

  async function saveProduct(payload: {
    id: string;
    name: string;
    sku: string;
    price: number;
    diameter: number;
    colorFamily: string;
  }) {
    setBusyProductId(payload.id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/reservations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "לא הצלחנו לשמור את הכיפה.");
      await refresh();
      onCatalogChange();
      setMessageKind("success");
      setMessage("פרטי הכיפה נשמרו והקטלוג עודכן.");
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "לא הצלחנו לשמור את הכיפה.");
    } finally {
      setBusyProductId("");
    }
  }

  async function toggleProduct(product: AdminProduct) {
    setBusyProductId(product.id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/reservations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, active: !product.available }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "לא הצלחנו לשנות את מצב הכיפה.");
      await refresh();
      onCatalogChange();
      setMessageKind("success");
      setMessage(
        product.available
          ? "הכיפה כובתה והוסרה מהקטלוג."
          : "הכיפה הופעלה והיא זמינה שוב בקטלוג.",
      );
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "לא הצלחנו לשנות את מצב הכיפה.");
    } finally {
      setBusyProductId("");
    }
  }

  async function mutateCategory(
    payload: {
      action: "create" | "rename" | "delete";
      name: string;
      previousName?: string;
    },
  ) {
    const busyKey = payload.action === "create"
      ? "__create__"
      : payload.previousName ?? payload.name;
    setBusyCategory(busyKey);
    setMessage("");
    try {
      const response = await fetch("/api/admin/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error ?? "לא הצלחנו לעדכן את הקטגוריה.");
      }
      await refresh();
      onCatalogChange();
      setMessageKind("success");
      setMessage(
        payload.action === "create"
          ? "הקטגוריה החדשה נוספה לקטלוג."
          : payload.action === "rename"
            ? "שם הקטגוריה וכל הכיפות המשויכות עודכנו."
            : "הקטגוריה הוסרה מהקטלוג.",
      );
      return true;
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "לא הצלחנו לעדכן את הקטגוריה.");
      return false;
    } finally {
      setBusyCategory("");
    }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await mutateCategory({ action: "create", name: newCategory });
    if (created) setNewCategory("");
  }

  async function renameCategory(previousName: string, name: string) {
    await mutateCategory({ action: "rename", previousName, name });
  }

  async function deleteCategory(name: string) {
    if (!window.confirm(`להסיר את הקטגוריה ״${name}״?`)) return;
    await mutateCategory({ action: "delete", name });
  }

  const activeCount = data?.products.filter((product) => product.available).length ?? 0;
  const inactiveCount = (data?.products.length ?? 0) - activeCount;

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
            <p>הזינו את הסיסמה כדי לצפות בהזמנות ולנהל את הכיפות.</p>
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
            {message && <p className={`admin-message ${messageKind}`} role="alert">{message}</p>}
            <button className="admin-primary" type="submit" disabled={loading}>
              {loading ? "מתחברת..." : "כניסה מאובטחת"}
            </button>
          </form>
        ) : (
          <div className="admin-content">
            <div className="admin-toolbar">
              <div className="admin-stats">
                <article><span>כיפות פעילות</span><strong>{activeCount}</strong></article>
                <article><span>כיפות לא פעילות</span><strong>{inactiveCount}</strong></article>
                <article><span>בקשות שנשמרו</span><strong>{data?.requests.length ?? 0}</strong></article>
              </div>
              <div className="admin-tools">
                <button type="button" onClick={() => void refresh()} disabled={loading}>רענון</button>
                <button type="button" onClick={() => void logout()}>יציאה</button>
              </div>
            </div>

            {message && <p className={`admin-message ${messageKind}`} role="status">{message}</p>}

            <section className="admin-section admin-categories-section">
              <div className="admin-section-title">
                <div><span>סינון הקטלוג</span><h3>ניהול קטגוריות</h3></div>
                <small>{data?.categories.length ?? 0} קטגוריות</small>
              </div>
              <p className="admin-section-help">
                שינוי שם מעדכן אוטומטית גם את כל הכיפות המשויכות. כדי להסיר קטגוריה, יש להעביר תחילה את הכיפות שלה לקטגוריה אחרת.
              </p>
              <form className="admin-add-category" onSubmit={createCategory}>
                <label>
                  קטגוריה חדשה
                  <input
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value)}
                    placeholder="לדוגמה: צבעוניים"
                    minLength={2}
                    maxLength={40}
                    required
                  />
                </label>
                <button type="submit" disabled={Boolean(busyCategory)}>
                  {busyCategory === "__create__" ? "מוסיפה..." : "הוספת קטגוריה"}
                </button>
              </form>
              <div className="admin-category-grid">
                {data?.categories.map((category) => (
                  <CategoryEditor
                    key={category}
                    name={category}
                    count={categoryCounts.get(category) ?? 0}
                    busy={Boolean(busyCategory)}
                    onRename={renameCategory}
                    onDelete={deleteCategory}
                  />
                ))}
              </div>
            </section>

            <section className="admin-section admin-inventory-section">
              <div className="admin-section-title">
                <div><span>מלאי</span><h3>עריכת כל הכיפות</h3></div>
                <small>{data?.products.length ?? 0} פריטים</small>
              </div>
              <p className="admin-section-help">
                שינוי שם, מחיר, קוטר, מק״ט או קטגוריית צבע נשמר מיד במסד הנתונים. הפעלת כיפה שנבחרה מחזירה אותה למלאי.
              </p>
              <div className="admin-product-grid">
                {data?.products.map((product) => (
                  <ProductEditor
                    key={`${product.id}-${product.name}-${product.sku}-${product.price}-${product.diameter}-${product.colorFamily}-${product.available}`}
                    product={product}
                    categories={data.categories}
                    customer={product.reservation ? requestsById.get(product.reservation.requestId) : undefined}
                    busy={busyProductId === product.id}
                    onSave={saveProduct}
                    onToggle={toggleProduct}
                  />
                ))}
              </div>
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
                        {request.skus.map((sku, index) => {
                          const product = request.productIds?.[index]
                            ? productsById.get(request.productIds[index])
                            : productsBySku.get(sku);
                          return <span key={`${sku}-${index}`}>{sku} · {product?.name ?? "כיפה"}</span>;
                        })}
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
                  {data.releases.map((item, index) => {
                    const product = item.productId
                      ? productsById.get(item.productId)
                      : productsBySku.get(item.sku);
                    return (
                      <p key={`${item.sku}-${item.releasedAt}-${index}`}>
                        <strong>{item.sku}</strong>
                        <span>{product?.name ?? "כיפה"}</span>
                        <time>{formatDate(item.releasedAt)}</time>
                      </p>
                    );
                  })}
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
