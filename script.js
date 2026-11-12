// ---- CONFIG ----
const STORE_NAME = "ANUGRAHA";
const ORDER_KEY = "anugraha_orders_v1"; // orders are read by admin.html (Orders section)

// Shared catalogue is stored in the same-origin browser storage.
const PRODUCT_KEY = "anugraha_products_v2"; // v2: discards old test/stale catalogues
// Default photo for every bundled product (used when a saved product has no image).
const DEFAULT_IMG_BY_ID = {}, DEFAULT_IMG_BY_NAME = {};
DEFAULT_PRODUCTS.forEach(d => { DEFAULT_IMG_BY_ID[String(d.id)] = d.img; DEFAULT_IMG_BY_NAME[d.name.toLowerCase()] = d.img; });
function imageFor(p){
  const own = p.image || p.img || "";
  if(own && !/^images\//.test(own)) return own; // real URL / uploaded photo
  return DEFAULT_IMG_BY_ID[String(p.id)] || DEFAULT_IMG_BY_NAME[String(p.name||"").toLowerCase()] || own;
}
function normalizeCategory(value){
  const raw=String(value||"").trim().toLowerCase();
  const key=raw.replace(/[^a-z]/g,"");
  if(key.includes("vegetable")) return "vegetables";
  if(key.includes("icecream") || key.includes("icecreams")) return "icecream";
  if(key.includes("grocery") || key.includes("groceries")) return "grocery";
  if(key.includes("fruit")) return "fruits";
  if(key.includes("beverage") || key.includes("drink")) return "beverages";
  return key || "vegetables";
}
function fromAdminProduct(p){
  // Support both the admin format and the original storefront format.
  const sourceVariants = Array.isArray(p.variants) ? p.variants :
    (Array.isArray(p.sizes) ? p.sizes : []);
  const variants = sourceVariants.map(v => ({
    l: v.size ?? v.l ?? "1 unit",
    p: Number(v.price ?? v.p) || 0,
    mrp: Number(v.mrp) || 0,
    stock: Number(v.stock ?? 50),
    offerPrice: Number(v.offerPrice) || 0
  }));
  const category = p.category || p.label || p.cat || "Vegetables";
  return {
    id: p.id,
    name: String(p.name || "Unnamed product"),
    cat: normalizeCategory(category),
    label: String(p.label || p.category || category),
    img: imageFor(p),
    emoji: p.emoji || "🛒",
    sizes: variants
  };
}
function loadStoreProducts(){
  try {
    const saved=JSON.parse(localStorage.getItem(PRODUCT_KEY));
    if(Array.isArray(saved) && saved.length) {
      const normalized=saved.map(fromAdminProduct).filter(p =>
        p.name && Array.isArray(p.sizes) && p.sizes.length
      );
      if(normalized.length) return normalized;
    }
  } catch(e){}
  return DEFAULT_PRODUCTS.map(p=>({
    ...p,
    cat:normalizeCategory(p.cat||p.label),
    sizes:(p.sizes||[]).map(z=>({...z,stock:z.stock ?? 50,offerPrice:z.offerPrice ?? 0}))
  }));
}
let PRODUCTS = loadStoreProducts();
window.addEventListener("storage", e=>{ if(e.key===PRODUCT_KEY){ lastSeen=e.newValue; refreshFromAdmin(); } });

const $ = s => document.querySelector(s);
function renderChips(){
  const el=document.getElementById("chips"); if(!el) return;
  const order=["vegetables","icecream","grocery","fruits","beverages"];
  const fixed={vegetables:"Vegetables",icecream:"Ice Cream",grocery:"Groceries",fruits:"Fruits",beverages:"Beverages"};
  const found=new Map();
  PRODUCTS.forEach(p=>{ if(!found.has(p.cat)) found.set(p.cat, fixed[p.cat]||p.label); });
  const cats=[...order.filter(c=>found.has(c)), ...[...found.keys()].filter(c=>!order.includes(c))];
  if(filter!=="all" && !found.has(filter)) filter="all";
  el.innerHTML=`<button class="chip${filter==="all"?" active":""}" data-filter="all">All</button>`+
    cats.map(c=>`<button class="chip${filter===c?" active":""}" data-filter="${c}">${found.get(c)}</button>`).join("");
}
function refreshFromAdmin(){
  PRODUCTS=loadStoreProducts();
  cart=Object.fromEntries(Object.entries(cart).filter(([k])=>{const [id,ix]=k.split("|");const p=PRODUCTS.find(x=>x.id==id);return p&&p.sizes[+ix];}));
  renderChips(); renderProducts(); renderCart();
}
window.addEventListener("focus", ()=>{ try{ if(localStorage.getItem(PRODUCT_KEY)!==lastSeen){ lastSeen=localStorage.getItem(PRODUCT_KEY); refreshFromAdmin(); } }catch(e){} });
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) window.dispatchEvent(new Event("focus")); });
let lastSeen=null; try{ lastSeen=localStorage.getItem(PRODUCT_KEY); }catch(e){}
const grid = $("#productGrid");
const CART_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h3l2.6 12.2a1 1 0 0 0 1 .8h9.1a1 1 0 0 0 1-.8L20.5 7H6"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17.5" cy="20" r="1.3"/></svg>';
let filter = "all", query = "";
const sel = {}; // selected size index per product
let cart = {}; try{ cart = JSON.parse(localStorage.getItem("anugraha-cart") || "{}"); }catch(e){} // {"id|sizeIndex": qty}
const money = n => "₹" + n.toFixed(2).replace(/\.00$/, ".00");

// ---- PRODUCTS ----
function renderProducts(){
  const list = PRODUCTS.filter(p =>
    (filter === "all" || p.cat === filter) && p.name.toLowerCase().includes(query));
  grid.innerHTML = list.map(p => {
    const i = sel[p.id] || 0, z = p.sizes[i];
    const price = z.offerPrice > 0 && z.offerPrice < z.p ? z.offerPrice : z.p;
    const off = z.offerPrice > 0 && z.offerPrice < z.p ? Math.round((1-z.offerPrice/z.p)*100) : (z.mrp ? Math.round((1-z.p/z.mrp)*100) : 0);
    const available = z.stock === undefined || z.stock > 0;
    return `<article class="card">
      <div class="thumb">${off ? `<span class="off">-${off}%</span>` : ""}<img src="${p.img}" alt="${p.name}" loading="lazy" onerror="this.replaceWith(document.createTextNode('${p.emoji}'))"></div>
      <div class="info">
        <h4>${p.name}</h4>
        <span class="cat-label">${p.label}</span>
        <div class="sizes">${p.sizes.map((s,k)=>`<button class="size ${k===i?"on":""}" data-size="${p.id}|${k}">${s.l}</button>`).join("")}</div>
        <span class="stock">${available ? "IN STOCK" : "OUT OF STOCK"}</span>
        <div class="pricerow">
          <div class="price">${z.offerPrice>0&&z.offerPrice<z.p?`<span class="mrp">${money(z.p)}</span>`:(z.mrp?`<span class="mrp">${money(z.mrp)}</span>`:"")}${money(price)}</div>
          <button class="add" data-add="${p.id}" aria-label="Add to cart" ${available?"":"disabled"}>${available?CART_SVG:"OUT"}</button>
        </div>
      </div>
    </article>`;
  }).join("") + (list.length % 2 ? '<div class="card-filler"></div>' : "");
  $("#empty").hidden = list.length > 0;
}

function setFilter(f){
  filter = f;
  document.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c.dataset.filter === f));
  renderProducts();
}

document.addEventListener("click", e => {
  const f = e.target.closest("[data-filter]");
  if (f) setFilter(f.dataset.filter);
  const sz = e.target.closest("[data-size]");
  if (sz) { const [id,k] = sz.dataset.size.split("|"); sel[id] = +k; renderProducts(); }
  const add = e.target.closest("[data-add]");
  if (add) {
    const id = add.dataset.add;
    const p = PRODUCTS.find(x => x.id == id), z = p && p.sizes[sel[id] || 0];
    if(!z || (z.stock !== undefined && z.stock <= 0)) return;
    changeQty(id + "|" + (sel[id] || 0), 1);
    add.classList.add("done"); add.textContent = "✓";
    setTimeout(() => { add.classList.remove("done"); add.innerHTML = CART_SVG; }, 900);
  }
});

// ---- CART ----
function save(){ try{ localStorage.setItem("anugraha-cart", JSON.stringify(cart)); }catch(e){} }
function changeQty(key, d){
  cart[key] = (cart[key] || 0) + d;
  if (cart[key] <= 0) delete cart[key];
  save(); renderCart();
}
function lookup(key){
  const [id,k] = key.split("|");
  const p = PRODUCTS.find(p => p.id == id);
  return {p, z: p && p.sizes[+k]};
}
function renderCart(){
  const keys = Object.keys(cart);
  const count = keys.reduce((s,k)=>s+cart[k],0);
  const total = keys.reduce((s,k)=>{const z=lookup(k).z; return s+cart[k]*(z.offerPrice>0&&z.offerPrice<z.p?z.offerPrice:z.p)},0);
  $("#cartCount").textContent = count;
  $("#cartTotal").textContent = money(total);
  $("#cartItems").innerHTML = keys.length ? keys.map(k => {
    const {p,z} = lookup(k); if(!p || !z) return "";
    const price=z.offerPrice>0&&z.offerPrice<z.p?z.offerPrice:z.p;
    return `<div class="cart-row">
      <div class="t"><b>${p.name} (${z.l})</b><span>${money(price)} each</span></div>
      <div class="qty"><button data-q="-1" data-key="${k}">−</button><b>${cart[k]}</b><button data-q="1" data-key="${k}">+</button></div>
    </div>`;
  }).join("") : '<p class="empty">Your cart is empty.</p>';
}
$("#cartItems").addEventListener("click", e => {
  const b = e.target.closest("[data-q]");
  if (b) changeQty(b.dataset.key, +b.dataset.q);
});

function toggleCart(open){
  $("#drawer").classList.toggle("open", open);
  $("#overlay").classList.toggle("open", open);
}
$("#cartBtn").onclick = () => { if($("#drawer").dataset.view!=="cart") setView("cart"); toggleCart(true); };
$("#closeCart").onclick = $("#overlay").onclick = () => toggleCart(false);

// ---- CHECKOUT (no WhatsApp: order goes to the admin Orders section) ----
const priceOf = z => (z.offerPrice>0 && z.offerPrice<z.p) ? z.offerPrice : z.p;
function setView(v){
  $("#drawer").dataset.view = v;
  $("#drawerTitle").textContent = v==="form" ? "Your Details" : v==="done" ? "Order Confirmed" : "Your Cart";
}
function cartLines(){
  return Object.keys(cart).map(k => {
    const {p,z} = lookup(k); if(!p || !z) return null;
    const price = priceOf(z), qty = cart[k];
    return {name:p.name, size:z.l, qty, price, sub:price*qty};
  }).filter(Boolean);
}
function showError(msg, field){
  const e = $("#coError");
  e.textContent = msg; e.hidden = !msg;
  document.querySelectorAll("#checkoutForm .invalid").forEach(x => x.classList.remove("invalid"));
  if(field){ field.classList.add("invalid"); field.focus(); }
}
$("#orderBtn").onclick = () => {
  const lines = cartLines();
  if (!lines.length) return alert("Your cart is empty.");
  const total = lines.reduce((s,l)=>s+l.sub,0);
  $("#coSummary").innerHTML = lines.map(l => `<div><span>${l.name} (${l.size}) × ${l.qty}</span><span>${money(l.sub)}</span></div>`).join("");
  $("#coTotal").textContent = money(total);
  try {
    const me = JSON.parse(localStorage.getItem("anugraha-customer") || "{}");
    if(me.name && !$("#coName").value) $("#coName").value = me.name;
    if(me.phone && !$("#coPhone").value) $("#coPhone").value = me.phone;
    if(me.address && !$("#coAddress").value) $("#coAddress").value = me.address;
  } catch(e){}
  showError("");
  setView("form");
};
$("#coBack").onclick = () => setView("cart");
$("#checkoutForm").addEventListener("submit", e => {
  e.preventDefault();
  const nameEl=$("#coName"), phoneEl=$("#coPhone"), addrEl=$("#coAddress");
  const name=nameEl.value.trim(), address=addrEl.value.trim();
  const phone=phoneEl.value.replace(/[\s\-+()]/g,"");
  if(name.length < 2) return showError("Please enter your name.", nameEl);
  if(!/^\d{10,13}$/.test(phone)) return showError("Please enter a valid phone number (10 digits).", phoneEl);
  if(address.length < 8) return showError("Please enter your full delivery address.", addrEl);
  const items = cartLines();
  if(!items.length){ setView("cart"); return; }
  const now = new Date();
  const order = {
    id: "ANU-" + now.getFullYear().toString().slice(2) + String(now.getMonth()+1).padStart(2,"0") + String(now.getDate()).padStart(2,"0") + "-" + Math.floor(1000+Math.random()*9000),
    createdAt: now.toISOString(),
    name, phone: phoneEl.value.trim(), address,
    items, total: items.reduce((s,l)=>s+l.sub,0),
    status: "New"
  };
  try {
    const list = JSON.parse(localStorage.getItem(ORDER_KEY) || "[]");
    list.unshift(order);
    localStorage.setItem(ORDER_KEY, JSON.stringify(list));
    localStorage.setItem("anugraha-customer", JSON.stringify({name, phone:order.phone, address}));
  } catch(err){ return showError("Could not save your order. Please try again."); }
  cart = {}; save(); renderCart();
  $("#doneName").textContent = name; $("#doneId").textContent = order.id; $("#donePhone").textContent = order.phone;
  setView("done");
});
$("#doneClose").onclick = () => { toggleCart(false); setTimeout(()=>setView("cart"), 300); };

// ---- HEADER: search + menu ----
$("#searchBtn").onclick = () => {
  const bar = $("#searchbar");
  bar.classList.toggle("open");
  $("#menu").classList.remove("open");
  if (bar.classList.contains("open")) $("#searchInput").focus();
};
$("#searchInput").addEventListener("input", e => {
  query = e.target.value.trim().toLowerCase();
  renderProducts();
  if (query) location.hash = "products";
});
$("#menuBtn").onclick = () => { $("#menu").classList.toggle("open"); $("#searchbar").classList.remove("open"); };
$("#menu").addEventListener("click", () => $("#menu").classList.remove("open"));



// ---- BANNER SLIDER (scrolls left) ----
const bTrack = $("#bTrack"), bSlides = [...bTrack.children], bDots = $("#bdots");
let bi = 0, bTimer;
const bPad = () => parseFloat(getComputedStyle(bTrack).scrollPaddingLeft) || 0;
bSlides.forEach((_, i) => { const d = document.createElement("span"); d.onclick = () => { bGo(i); bRestart(); }; bDots.appendChild(d); });
function bMark(){ [...bDots.children].forEach((d,k) => d.classList.toggle("on", k === bi)); }
function bGo(i){
  bi = (i + bSlides.length) % bSlides.length;
  bTrack.scrollTo({ left: bSlides[bi].offsetLeft - bPad(), behavior: "smooth" });
  bMark();
}
bTrack.addEventListener("scroll", () => {
  let best = 0, dist = 1e9;
  bSlides.forEach((s,k) => { const d = Math.abs(s.offsetLeft - bPad() - bTrack.scrollLeft); if (d < dist) { dist = d; best = k; } });
  if (best !== bi) { bi = best; bMark(); }
}, { passive: true });
function bRestart(){
  clearInterval(bTimer);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  bTimer = setInterval(() => bGo(bi + 1), 3500);
}
["pointerdown","touchstart"].forEach(ev => bTrack.addEventListener(ev, () => clearInterval(bTimer), { passive: true }));
["pointerup","touchend"].forEach(ev => bTrack.addEventListener(ev, () => setTimeout(bRestart, 4000), { passive: true }));
bMark(); bRestart();

// ---- INIT ----
cart = Object.fromEntries(Object.entries(cart).filter(([k]) => { const [id,ix]=k.split("|"); const p=PRODUCTS.find(x=>x.id==id); return p && p.sizes[+ix]; }));
renderChips();
renderProducts();
renderCart();

