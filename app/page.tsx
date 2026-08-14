"use client";

import { FormEvent, type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { calculateTotal, colorFamilies, products, type Product } from "./catalog";
import AdminPanel from "./AdminPanel";

const WHATSAPP_NUMBER = "972505782058";

function formatPrice(value: number) {
  return `${value} ש״ח`;
}

export default function Home() {
  const [activeFamily, setActiveFamily] = useState("הכול");
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [reservedSkus, setReservedSkus] = useState<Set<string>>(new Set());
  const [availabilityStatus, setAvailabilityStatus] = useState<"loading" | "ready" | "error">("loading");
  const [cartOpen, setCartOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);

  const loadAvailability = useCallback(async () => {
    try {
      const response = await fetch("/api/reservations", { cache: "no-store" });
      if (!response.ok) throw new Error("availability");
      const data = (await response.json()) as { reservedSkus?: string[] };
      setReservedSkus(new Set(data.reservedSkus ?? []));
      setAvailabilityStatus("ready");
    } catch {
      setAvailabilityStatus("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAvailability(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAvailability]);

  useEffect(() => {
    document.body.classList.toggle("drawer-is-open", cartOpen);
    return () => document.body.classList.remove("drawer-is-open");
  }, [cartOpen]);

  const visibleProducts = useMemo(
    () => products.filter(
      (product) =>
        !reservedSkus.has(product.sku) &&
        (activeFamily === "הכול" || product.colorFamily === activeFamily),
    ),
    [activeFamily, reservedSkus],
  );

  const selectedProducts = useMemo(
    () =>
      selectedSkus
        .map((sku) => products.find((product) => product.sku === sku))
        .filter((product): product is Product => Boolean(product)),
    [selectedSkus],
  );

  const total = calculateTotal(selectedProducts);

  function toggleProduct(product: Product) {
    if (reservedSkus.has(product.sku)) return;
    setSelectedSkus((current) =>
      current.includes(product.sku)
        ? current.filter((sku) => sku !== product.sku)
        : [...current, product.sku],
    );
  }

  async function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage("");

    if (!selectedSkus.length) {
      setFormMessage("בחרו לפחות כיפה אחת לפני שממשיכים.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, note, skus: selectedSkus }),
      });
      const data = (await response.json()) as {
        error?: string;
        unavailableSkus?: string[];
        total?: number;
      };

      if (!response.ok) {
        if (data.unavailableSkus?.length) {
          const unavailable = new Set(data.unavailableSkus);
          setReservedSkus((current) => new Set([...current, ...unavailable]));
          setSelectedSkus((current) => current.filter((sku) => !unavailable.has(sku)));
        }
        setFormMessage(data.error ?? "לא הצלחנו לשמור את הבקשה. נסו שוב בעוד רגע.");
        return;
      }

      setReservedSkus((current) => new Set([...current, ...selectedSkus]));
      const itemLines = selectedProducts
        .map(
          (product) =>
            `• ${product.sku} | ${product.name} | קוטר ${product.diameter} ס״מ`,
        )
        .join("\n");
      const message = [
        `שלום, שמי ${name}.`,
        "אני מעוניין/ת בכיפות הבאות:",
        itemLines,
        `סה״כ לתרומה: ${formatPrice(data.total ?? total)}`,
        `מספר הטלפון שלי: ${phone}`,
        note.trim() ? `הערה: ${note.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      window.location.assign(
        `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`,
      );
    } catch {
      setFormMessage("לא הצלחנו לשמור את הבקשה. בדקו את החיבור ונסו שוב.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="חזרה לראש העמוד">
          <span className="brand-mark" aria-hidden="true">ק</span>
          <span>
            <strong>קהילת קדמא</strong>
            <small>כיפות בעבודת יד</small>
          </span>
        </a>
        <nav aria-label="ניווט ראשי">
          <a href="#story">הסיפור</a>
          <a href="#catalog">הכיפות</a>
          <a href="#donation">התרומה</a>
        </nav>
        <div className="header-actions">
          <button className="settings-button" type="button" onClick={() => setAdminOpen(true)} aria-label="פתיחת הגדרות">
            <span aria-hidden="true">⚙</span>
            <small>הגדרות</small>
          </button>
          <button className="header-cart" type="button" onClick={() => setCartOpen(true)}>
            הבחירה שלי
            <span>{selectedSkus.length}</span>
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-thread thread-one" aria-hidden="true" />
        <div className="hero-thread thread-two" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow"><span /> נסרגות ביד על ידי גילת פורר</p>
          <h1>מכירת כיפות <em>למען קהילת קדמא</em></h1>
          <p className="hero-intro">
            כל ההכנסות מוקדשות ללימוד תנ״ך להורים ולילדים ולתפילת הילדים.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#catalog">לבחירת כיפה <span aria-hidden="true">←</span></a>
            <div className="price-note">
              <strong>40 ש״ח</strong>
              <span>לכיפה · 3 ב-110 ש״ח</span>
            </div>
          </div>
          <p className="more-donation-note">
            סכומי הרכישה הם התרומה המוצעת. מי שרוצה להוסיף ולתרום יותר,
            מוזמן לעשות זאת באהבה בתיאום בוואטסאפ.
          </p>
        </div>
        <div className="hero-visual">
          <div className="hero-photo-wrap">
            <Image
              src="/images/hero-knitting.jpg"
              alt="סריגת כיפה בעבודת יד"
              fill
              priority
              unoptimized
              sizes="(max-width: 760px) 44vw, 25vw"
            />
          </div>
          <div className="handmade-seal" aria-label="נסרג ביד על ידי גילת פורר">
            <span>נסרג ביד</span>
            <strong>באהבה</strong>
            <small>גילת פורר</small>
          </div>
        </div>
        <div className="hero-doodle" aria-hidden="true">
          <Image src="/images/kedma-knitting-doodle.png" alt="" fill unoptimized sizes="260px" />
        </div>
      </section>

      <section className="price-ribbon" aria-label="מחירי הכיפות">
        <div><span>כיפה אחת</span><strong>40 ש״ח</strong></div>
        <i aria-hidden="true">✦</i>
        <div className="featured"><span>שלוש כיפות</span><strong>110 ש״ח</strong></div>
        <i aria-hidden="true">✦</i>
        <div><span>מאה אחוז</span><strong>תרומה לקהילה</strong></div>
      </section>

      <section className="catalog-section" id="catalog">
        <div className="section-title-row">
          <div>
            <p className="section-number">01 · בוחרים כיפה</p>
            <h2>איזו כיפה <em>הכי אתם?</em></h2>
          </div>
          <p className="catalog-lead">
            בחרו כיפה אחת או הרכיבו שלישייה. כל פריט הוא יחיד במינו ונשמר עבורכם
            מיד עם שליחת הבקשה.
          </p>
        </div>

        <div className="filters" role="group" aria-label="סינון לפי צבע">
          {colorFamilies.map((family) => (
            <button
              key={family}
              type="button"
              className={activeFamily === family ? "active" : ""}
              onClick={() => setActiveFamily(family)}
            >
              {family}
            </button>
          ))}
        </div>

        {availabilityStatus === "loading" ? (
          <div className="availability-state" role="status">
            <span aria-hidden="true"><i /><i /><i /></span>
            <p>בודקים אילו כיפות זמינות...</p>
          </div>
        ) : availabilityStatus === "error" ? (
          <div className="availability-state error" role="alert">
            <strong>לא הצלחנו לטעון את המלאי כרגע.</strong>
            <p>כדי שלא תוצג בטעות כיפה שכבר נבחרה, הקטלוג ממתין לעדכון.</p>
            <button type="button" onClick={() => {
              setAvailabilityStatus("loading");
              void loadAvailability();
            }}>ניסיון נוסף</button>
          </div>
        ) : (
          <>
            <div className="product-grid">
              {visibleProducts.map((product, index) => {
            const selected = selectedSkus.includes(product.sku);
            const reserved = reservedSkus.has(product.sku);
            return (
              <article
                className={`product-card${selected ? " selected" : ""}${reserved ? " reserved" : ""}`}
                key={product.sku}
                style={{ "--accent": product.accent, "--index": index } as CSSProperties}
              >
                <div className="product-image">
                  <Image
                    src={product.image}
                    alt={`כיפה ${product.name}`}
                    fill
                    unoptimized
                    sizes="(max-width: 760px) 92vw, (max-width: 1050px) 45vw, 29vw"
                  />
                  <span className="sku">{product.sku}</span>
                  {reserved && <div className="reserved-overlay"><strong>נבחרה</strong><span>הכיפה אינה זמינה</span></div>}
                </div>
                <div className="product-info">
                  <div className="product-title">
                    <div>
                      <p>{product.colorFamily}</p>
                      <h3>{product.name}</h3>
                    </div>
                    <strong>{formatPrice(product.price)}</strong>
                  </div>
                  <div className="product-meta">
                    <span><i className="color-dot" /> {product.colorLabel}</span>
                    <span>קוטר {product.diameter} ס״מ</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleProduct(product)}
                    disabled={reserved}
                    aria-pressed={selected}
                  >
                    {reserved ? "הכיפה כבר נבחרה" : selected ? "נבחרה · להסרה" : "הוספה לבחירה שלי"}
                    {!reserved && <span aria-hidden="true">{selected ? "✓" : "+"}</span>}
                  </button>
                </div>
              </article>
            );
              })}
            </div>
            {visibleProducts.length === 0 && (
              <div className="catalog-empty">
                <span aria-hidden="true">○</span>
                <strong>כל הכיפות בקבוצת הצבע הזו כבר נבחרו</strong>
                <p>אפשר לבחור קבוצת צבע אחרת ולראות רק את הכיפות הפעילות.</p>
              </div>
            )}
          </>
        )}
      </section>

      <section className="story-section" id="story">
        <div className="story-kicker">02 · הסיפור שמאחורי הכיפה</div>
        <div className="story-heading">
          <span className="big-stitch" aria-hidden="true">✦</span>
          <h2>נסרג באהבה.<br /><em>נתרם לקהילה.</em></h2>
        </div>
        <div className="story-copy">
          <p>
            כל אחת מהכיפות שלפניכם נסרגה בעבודת יד על ידי <strong>גילת פורר</strong>,
            בסבלנות ובתשומת לב לכל חוט, תפר וגוון.
          </p>
          <p>
            כל כיפה היא יצירה יחידה. הבחירה בה היא גם תרומה לפעילות קהילת קדמא
            ולחיבורים שמרכיבים את הקהילה שלנו.
          </p>
        </div>
      </section>

      <section className="donation-section" id="donation">
        <div className="donation-orbit" aria-hidden="true"><span>קדמא</span></div>
        <div className="donation-copy">
          <p className="section-number">03 · לאן הולכת התרומה?</p>
          <h2>כל כיפה מחזקת<br /><em>עוד חוט בקהילה.</em></h2>
          <p>
            כל ההכנסות ממכירת הכיפות מוקדשות לפעילויות קהילת קדמא ולמרחבים
            שבהם ילדים והורים לומדים, מתפללים וגדלים יחד.
          </p>
        </div>
        <div className="donation-cards">
          <article><span>א</span><div><strong>לומדים יחד</strong><p>לימוד תנ״ך משותף להורים ולילדים</p></div></article>
          <article><span>ב</span><div><strong>מתפללים יחד</strong><p>תפילת הילדים של קהילת קדמא</p></div></article>
          <article><span>ג</span><div><strong>בונים יחד</strong><p>חיזוק הפעילות המשפחתית והקהילתית</p></div></article>
        </div>
      </section>

      <footer>
        <div className="footer-brand"><span>ק</span><div><strong>קהילת קדמא</strong><small>יחד לומדים, מתפללים ובונים קהילה</small></div></div>
        <p>סריגה בעבודת יד: גילת פורר</p>
        <a href={`https://wa.me/${WHATSAPP_NUMBER}`}>ליצירת קשר בוואטסאפ</a>
      </footer>

      {selectedSkus.length > 0 && !cartOpen && (
        <button className="floating-cart" type="button" onClick={() => setCartOpen(true)}>
          <span className="floating-count">{selectedSkus.length}</span>
          <span>הבחירה שלי</span>
          <strong>{formatPrice(total)}</strong>
          <i aria-hidden="true">←</i>
        </button>
      )}

      {cartOpen && (
        <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setCartOpen(false);
        }}>
          <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
            <div className="drawer-header">
              <div><p>הבחירה שלך</p><h2 id="cart-title">הכיפות שבחרתי</h2></div>
              <button type="button" onClick={() => setCartOpen(false)} aria-label="סגירת סל הבחירה">×</button>
            </div>

            {selectedProducts.length === 0 ? (
              <div className="empty-cart">
                <span>○</span><p>עדיין לא בחרתם כיפה.</p>
                <button type="button" onClick={() => setCartOpen(false)}>חזרה לקטלוג</button>
              </div>
            ) : (
              <form onSubmit={submitReservation}>
                <div className="selected-list">
                  {selectedProducts.map((product) => (
                    <div className="selected-item" key={product.sku}>
                      <Image src={product.image} alt="" width={64} height={64} unoptimized />
                      <div><strong>{product.name}</strong><span>{product.sku} · קוטר {product.diameter} ס״מ</span></div>
                      <button type="button" onClick={() => toggleProduct(product)} aria-label={`הסרת ${product.name}`}>×</button>
                    </div>
                  ))}
                </div>

                <div className="cart-total">
                  <div><span>{selectedProducts.length} {selectedProducts.length === 1 ? "כיפה" : "כיפות"}</span><small>{selectedProducts.length >= 3 ? "הנחת שלישייה מחושבת אוטומטית" : "שלוש כיפות ב-110 ש״ח"}</small></div>
                  <strong>{formatPrice(total)}</strong>
                </div>

                <div className="form-title"><span>כמעט סיימנו</span><p>מלאו פרטים ונשמור את הכיפות עבורכם.</p></div>
                <label>שם מלא<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} autoComplete="name" placeholder="איך קוראים לך?" /></label>
                <label>מספר טלפון<input value={phone} onChange={(event) => setPhone(event.target.value)} required inputMode="tel" autoComplete="tel" placeholder="050-0000000" /></label>
                <label>הערה, לא חובה<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="כל פרט שחשוב שנדע" /></label>
                {formMessage && <p className="form-message" role="alert">{formMessage}</p>}
                <button className="whatsapp-button" type="submit" disabled={submitting}>
                  <span>{submitting ? "שומרים את הבקשה..." : "שמירת הבקשה ומעבר לוואטסאפ"}</span>
                  <i aria-hidden="true">◉</i>
                </button>
                <p className="privacy-note">הפרטים נשמרים רק לצורך טיפול בבקשה. התשלום והמסירה יתואמו בוואטסאפ.</p>
                <p className="cart-give-more">רוצים להוסיף על סכום התרומה? מוזמנים לציין זאת בהערה, באהבה.</p>
              </form>
            )}
          </aside>
        </div>
      )}

      <AdminPanel
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        onRestore={(sku) => {
          setReservedSkus((current) => {
            const next = new Set(current);
            next.delete(sku);
            return next;
          });
        }}
      />
    </main>
  );
}
