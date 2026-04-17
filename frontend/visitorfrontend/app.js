const API_BASE = "https://visitors-portal-backend.onrender.com";
const TOKEN_KEY = "token";
const TICKET_PRICES = {
  General: 40,
  Senior: 30,
  Veteran: 30,
  Child: 30,
  Membership: 100,
};
const MEMBERSHIP_PERKS_TEXT = "Membership perks: skip lines, exclusive zones, and priority access.";
const PARK_ZONES = [
  "Uncanny Valley",
  "Bloodmoon Village",
  "Space Station X",
  "Camp Blackwood",
  "Dead End District",
  "Isolation Ward",
];
const DINING_MENU_ITEMS = [
  { zone: "Uncanny Valley", venue: "Artificial Appetite Cafe", name: "Symmetry Burger", price: 13.99 },
  { zone: "Uncanny Valley", venue: "Artificial Appetite Cafe", name: "Repeated Ravioli Plate", price: 12.49 },
  { zone: "Uncanny Valley", venue: "Artificial Appetite Cafe", name: "Synthetic Steak Cut", price: 18.99 },
  { zone: "Uncanny Valley", venue: "The TV Dinner Lounge", name: "Fried Chicken TV Dinner", price: 11.49 },
  { zone: "Uncanny Valley", venue: "The TV Dinner Lounge", name: "Mac & Cheese Combo Tray", price: 10.49 },
  { zone: "Bloodmoon Village", venue: "Great Feast Hall", name: "Roasted Beast Feast", price: 19.99 },
  { zone: "Bloodmoon Village", venue: "Great Feast Hall", name: "Feast of the Chosen (Sampler)", price: 18.49 },
  { zone: "Bloodmoon Village", venue: "Great Feast Hall", name: "Sacrificial Lamb Plate", price: 16.99 },
  { zone: "Bloodmoon Village", venue: "Crimson Tavern", name: "Dark Harvest Plate", price: 13.99 },
  { zone: "Bloodmoon Village", venue: "Witch's Brew Stand", name: "Mystery Brew", price: 4.99 },
  { zone: "Bloodmoon Village", venue: "Witch's Brew Stand", name: "Potion Flight (Sampler)", price: 6.99 },
  { zone: "Space Station X", venue: "Orbit Mess Hall", name: "Space Station Burger", price: 13.49 },
  { zone: "Space Station X", venue: "Orbit Mess Hall", name: "Zero-G Taco Plate", price: 12.49 },
  { zone: "Space Station X", venue: "Orbit Mess Hall", name: "Galaxy Sampler Tray", price: 13.99 },
  { zone: "Space Station X", venue: "The Airlock Lounge", name: "Black Hole Cocktail", price: 8.99 },
  { zone: "Space Station X", venue: "The Airlock Lounge", name: "Airlock Sliders", price: 6.99 },
  { zone: "Space Station X", venue: "Cryo Cafe", name: "Cryo Ice Cream Sphere", price: 5.49 },
  { zone: "Camp Blackwood", venue: "Dockside Grill", name: "Grilled Fish Basket", price: 13.49 },
  { zone: "Camp Blackwood", venue: "Dockside Grill", name: "Dockside BBQ Plate", price: 14.99 },
  { zone: "Camp Blackwood", venue: "Smores Stand", name: "Classic Chocolate S’more", price: 4.49 },
  { zone: "Camp Blackwood", venue: "Smores Stand", name: "S’mores Party Platter", price: 9.99 },
  { zone: "Dead End District", venue: "Freddy Fazbears Pizzaria", name: "Classic Cheese Pizza", price: 10.49 },
  { zone: "Dead End District", venue: "Freddy Fazbears Pizzaria", name: "Pepperoni Pizza", price: 11.49 },
  { zone: "Dead End District", venue: "Freddy Fazbears Pizzaria", name: "Fazbear Special Pizza", price: 13.99 },
  { zone: "Dead End District", venue: "Billy's Butcher Shop", name: "Meat Lover's Platter", price: 16.99 },
  { zone: "Dead End District", venue: "Billy's Butcher Shop", name: "Red Sauce Special Drink", price: 4.29 },
  { zone: "Dead End District", venue: "Midnight Snack Shack", name: "After Hours Deal", price: 6.99 },
  { zone: "Dead End District", venue: "Midnight Snack Shack", name: "Last Call Special", price: 9.49 },
  { zone: "Isolation Ward", venue: "Ration Station", name: "Canned Chili", price: 5.49 },
  { zone: "Isolation Ward", venue: "Ration Station", name: "Protein Ration Pack", price: 6.49 },
  { zone: "Isolation Ward", venue: "Contamination Cafe", name: "Pickled Veggie Cup", price: 2.99 },
  { zone: "Isolation Ward", venue: "Contamination Cafe", name: "Mutant Mac & Cheese", price: 6.99 },
  { zone: "Isolation Ward", venue: "Contamination Cafe", name: "Pandemic Pizza Slice", price: 5.49 },
  { zone: "Isolation Ward", venue: "Contamination Cafe", name: "Quarantine Quesadilla", price: 7.49 },
  { zone: "Isolation Ward", venue: "Contamination Cafe", name: "Radioactive Lemonade", price: 3.99 },
  { zone: "Isolation Ward", venue: "Field Medic Kitchen", name: "Medic Chicken Soup", price: 6.49 },
  { zone: "Isolation Ward", venue: "Field Medic Kitchen", name: "Restorative Combo", price: 8.99 },
];
const state = {
  areas: [],
  parks: [],
  attractions: [],
  dining: [],
  merchandise: [],
  diningShopView: "dining",
  parkContentView: "attractions",
  merchCart: [],
  diningCart: [],
};

function $(id) {
  return document.getElementById(id);
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function api(path, { method = "GET", body = null, token = null } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Cannot reach backend API. Check Render backend URL/CORS settings.");
  }
  const raw = await res.text();
  const data = raw ? safeJson(raw) : null;
  if (!res.ok) {
    throw new Error((data && data.error) || res.statusText);
  }
  return data;
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(v) {
  localStorage.setItem(TOKEN_KEY, v);
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function logoutVisitor() {
  clearToken();
  showStatus("Logged out successfully.");
  showAuth(true);
  $("visitorBadge").textContent = "Guest";
}

function showStatus(msg, isErr = false) {
  const el = $("globalStatus");
  el.textContent = msg;
  el.className = isErr ? "status error" : "status";
}

function showAuthError(msg) {
  const el = $("authError");
  if (!el) return;
  if (!msg) {
    el.textContent = "";
    el.classList.add("hidden");
    return;
  }
  el.textContent = msg;
  el.classList.remove("hidden");
}

function setAuthMode(mode) {
  const isRegister = mode === "register";
  $("registerPanel").classList.toggle("hidden", !isRegister);
  $("btnShowLogin").classList.toggle("btn-primary", !isRegister);
  $("btnShowRegister").classList.toggle("btn-primary", isRegister);
}

function setTab(name) {
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  const panel = document.getElementById(`tab-${name}`);
  if (panel) panel.classList.remove("hidden");
}

function fillSelect(id, items, valueKey, labelKey, includeBlank = false) {
  const select = $(id);
  if (!select) return;
  select.innerHTML = includeBlank ? `<option value="">-- Select --</option>` : "";
  for (const item of items) {
    const opt = document.createElement("option");
    opt.value = item[valueKey];
    opt.textContent = item[labelKey];
    select.appendChild(opt);
  }
}

function updateTicketPricingPreview() {
  const category = $("ticketCategory").value || "General";
  const plan = $("ticketPlan").value || "SingleDay";
  const isMembership = category === "Membership" || plan === "SeasonPass";
  const price = isMembership ? 100 : (TICKET_PRICES[category] ?? 30);
  $("ticketPrice").value = price.toFixed(2);

  const info = $("ticketBenefits");
  if (!info) return;
  if (isMembership) {
    info.textContent = `Price: $${price.toFixed(2)}. ${MEMBERSHIP_PERKS_TEXT}`;
  } else {
    info.textContent = `Price: $${price.toFixed(2)}.`;
  }
}

const HORROR_IMAGE_PROMPTS_BY_NAME = {
  "Broadcast Hijack": "A flickering, static-filled TV screen in a dark studio, emergency broadcast colors red and black glitching across monitors, a shadowy figure visible through static, warning text scrolling at the bottom, cinematic horror poster style.",
  "Escape the Backrooms": "Endless fluorescent-lit yellow hallways stretching into darkness, peeling wallpaper, buzzing dying lights overhead, infinite liminal space, ominous horror atmosphere, cinematic.",
  "Alternate Invasion": "A reality tear splitting open in the sky above a suburban street, dark mirror-like figures stepping through, distorted familiar objects, purple and black dimensional rift energy, cinematic horror.",
  "Looping Day": "A broken cracked clock face, the same suburban street repeated infinitely, a person frozen mid-scream, blood on the sidewalk, an impossible new door, uncanny time-loop horror scene.",
  "Smile Protocol": "Pitch black background with only a wide unnatural smile, too many asymmetrical teeth glowing faint white, security camera overlay and timestamp, analog horror style.",
  "Harvest Festival": "Torchlit cornfield at dusk, scarecrows in a ritual circle around an altar, robed figures chanting, offerings of rotting fruit and bones, smoke rising into a blood-red sky.",
  "Pastor John's Sermon": "Dim wooden church interior, glassy-eyed congregation in pews, preacher with hollow black eyes at pulpit, candles as only light, burned bible pages scattered on floor, religious horror.",
  "The Offering": "Stone altar in a dark forest clearing, moonlight through trees, bound figure surrounded by hooded silhouettes, ancient symbols carved into ground glowing red.",
  "Forest of Whispers": "Dense foggy forest at midnight, faces pressed inside tree bark, ghostly hands reaching from roots, dead leaves suspended in air, one lantern path leading deeper.",
  "AI Override": "Server room in cold blue light, screens showing corrupted code and faces, robotic arms reaching from walls, a single red eye in a cracked center monitor, sci-fi horror.",
  "The Last Transmission": "Lone radio operator in bunker surrounded by dead screens, forbidden signal incoming, face pressing through radio waveform visualization, static spelling warning message.",
  "Containment Breach": "Government research facility with blown-out blast doors, red emergency lighting, biohazard symbols everywhere, reinforced walls torn open by unseen creature, wet footprints into darkness.",
  "Zero-Gravity Situation": "Astronaut floating helplessly in dark space station corridor, blood droplets and debris drifting in zero gravity, something moving in vents above, Earth visible through cracked window.",
  "Watchtower Drop": "Rusted forest ranger watchtower at night, massive creature circling in treeline below, tower shaking, claw marks on wooden rail, abandoned ranger equipment scattered.",
  "Cryptid Hunt": "Dense Appalachian wilderness, trail camera flashes catching enormous figure between trees, abandoned hunting gear on path, multiple pairs of glowing eyes in darkness.",
  "Trail Tour": "A scenic forest trail turning wrong, signs pointing impossible directions, animal skulls hanging from trees, narrowing path, tour guide frozen in fear pointing off trail.",
  "Lake Terror": "Still black lake at midnight with enormous dark mass beneath surface, capsized rowboat floating center, dock lights flickering, wet handprints leading onto shore.",
  "Camper Safety Orientation": "Cheerful 1980s camp safety video aesthetic gone wrong, smiling counselor glitching into monstrous face, sinister safety tips, campfire revealing silhouettes closing in.",
  "Psych Ward Tour": "Decaying psychiatric hospital hallway, peeling paint, barred windows with moonlight, wheelchair at corridor end facing away, patient files scattered, scratching behind locked door.",
  "Midnight Stalker": "Dark suburban neighborhood at night, one house lit while all others dark, silhouette in every window, figure standing still under streetlight, knife reflecting light nearby.",
  "Final Girl: The Chase": "Terrified young woman running through dark house, massive masked figure chasing, overturned furniture, only light from flickering phone screen, dead-end door ahead.",
  "Execution Alley": "Narrow brick alley lined with nooses and rusted electric chairs, red light and long shadows, hooded executioner silhouette at far end, walls scratched with tallies and last words.",
  "Body Count": "Crime scene room with chalk body outlines, evidence markers by blood pools, detective board with photos linked by red string, killer shadow behind frosted glass door.",
  "Outbreak: Day Zero": "Hospital emergency room overrun, biohazard tape over doors, infected patients turning, lone doctor in hazmat suit reading clipboard in despair, red emergency lighting.",
  "Evacuation Protocol": "Gridlocked highway of abandoned cars, distant sirens, families fleeing on foot with belongings left behind, military blockade ahead, smoke from city skyline, sign reads TURN BACK.",
  "Emergency Broadcast Live": "News anchor desk with two anchors, one visibly infected, the other realizing on live camera, panicked breaking news ticker, crew fleeing in background.",
  "Containment Collapse": "Research facility perimeter fence torn open from inside, overturned military vehicles, hazmat soldiers running, massive hole in facility wall, warning sirens and red emergency lights.",
  "Last Stand Barricade": "Fortified convenience store at night with boarded windows, survivors visible through gaps with weapons, huge infected horde pressing outside, flickering OPEN sign, supplies running low.",
};

function hashStringToIndex(str, modulo) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % modulo;
}

function cardImageUrl(name) {
  const key = String(name || "").trim();
  const prompt = HORROR_IMAGE_PROMPTS_BY_NAME[key] || `${key}, horror theme park attraction poster, cinematic dark style`;
  const seed = hashStringToIndex(key || "default", 999999) + 1;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=640&height=360&seed=${seed}&model=flux&nologo=true`;
}

function fallbackImageUrl(name, width, height) {
  const label = encodeURIComponent(`${name || "Horror Attraction"}\nImage Loading`);
  return `https://placehold.co/${width}x${height}/111014/e6e2ea?text=${label}`;
}

function renderGeneratedArtImage(name, width, height, alt) {
  const src = cardImageUrl(name);
  const fallback = fallbackImageUrl(name, width, height);
  return `
    <div class="image-frame" style="width:${width}px; height:${height}px;">
      <div class="image-skeleton"></div>
      <img
        class="generated-art"
        src="${src}"
        data-fallback-src="${fallback}"
        alt="${alt}"
        loading="lazy"
        decoding="async"
        style="width:${width}px; height:${height}px;"
      />
    </div>
  `;
}

function wireGeneratedImages(root = document) {
  const images = root.querySelectorAll("img.generated-art:not([data-wired='1'])");
  images.forEach((img) => {
    img.dataset.wired = "1";

    img.addEventListener("load", () => {
      const frame = img.closest(".image-frame");
      if (frame) frame.classList.add("loaded");
    });

    img.addEventListener("error", () => {
      if (!img.dataset.fallbackUsed) {
        img.dataset.fallbackUsed = "1";
        img.src = img.dataset.fallbackSrc || "";
        return;
      }
      const frame = img.closest(".image-frame");
      if (frame) frame.classList.add("loaded");
    });
  });
}

function textMatchesSearch(value, query) {
  return String(value || "").toLowerCase().includes(query);
}

function normalizeZoneName(rawZone) {
  const z = String(rawZone || "").trim().toLowerCase();
  if (!z) return "Uncanny Valley";
  if (z.includes("uncanny")) return "Uncanny Valley";
  if (z.includes("bloodmoon") || z.includes("cult")) return "Bloodmoon Village";
  if (z.includes("space") || z.includes("sci-fi") || z.includes("scifi")) return "Space Station X";
  if (z.includes("blackwood") || z.includes("camp")) return "Camp Blackwood";
  if (z.includes("dead end") || z.includes("slasher")) return "Dead End District";
  if (z.includes("isolation") || z.includes("outbreak") || z.includes("biohazard")) return "Isolation Ward";
  return "Uncanny Valley";
}

function setDiningShopView(view) {
  state.diningShopView = view === "merch" ? "merch" : "dining";
  const showingDining = state.diningShopView === "dining";
  $("diningMenuSection").classList.toggle("hidden", !showingDining);
  $("merchMenuSection").classList.toggle("hidden", showingDining);
  if ($("diningShopViewSelect")) $("diningShopViewSelect").value = state.diningShopView;
}

function setParkContentView(view) {
  state.parkContentView = view === "events" ? "events" : "attractions";
  const showEvents = state.parkContentView === "events";
  $("eventsSection").classList.toggle("hidden", !showEvents);
  $("attractionsSection").classList.toggle("hidden", showEvents);
}

function renderDiningList() {
  const query = String(($("diningSearch") && $("diningSearch").value) || "").trim().toLowerCase();
  const zone = (($("diningZoneFilter") && $("diningZoneFilter").value) || "all").toLowerCase();
  const sortBy = ($("diningSort") && $("diningSort").value) || "name-asc";
  const maxPrice = Number(($("diningMaxPrice") && $("diningMaxPrice").value) || "");
  const hasMaxPrice = Number.isFinite(maxPrice) && maxPrice > 0;

  const rows = DINING_MENU_ITEMS.filter((d) => {
    const matchesSearch = !query || textMatchesSearch(d.name, query) || textMatchesSearch(d.venue, query) || textMatchesSearch(d.zone, query);
    if (!matchesSearch) return false;
    if (zone !== "all" && String(d.zone || "").toLowerCase() !== zone) return false;
    if (hasMaxPrice && Number(d.price || 0) > maxPrice) return false;
    return true;
  });

  rows.sort((a, b) => {
    if (sortBy === "price-asc") return a.price - b.price;
    if (sortBy === "price-desc") return b.price - a.price;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  const prices = rows.map((r) => Number(r.price || 0));
  const low = prices.length ? Math.min(...prices) : 0;
  const high = prices.length ? Math.max(...prices) : 0;
  $("diningTotalItems").textContent = String(rows.length);
  $("diningLowestPrice").textContent = `$${low.toFixed(2)}`;
  $("diningHighestPrice").textContent = `$${high.toFixed(2)}`;

  $("diningCards").innerHTML = rows
    .map((d) => `<article class="merch-card">
      <div class="zone">${d.zone}</div>
      <div class="item-name">${d.name}</div>
      <div class="shop-name">${d.venue}</div>
      <div class="price-row">
        <strong>$${Number(d.price).toFixed(2)}</strong>
        <button class="btn small" type="button"
          data-add-dining-name="${String(d.name).replace(/"/g, "&quot;")}"
          data-add-dining-zone="${String(d.zone).replace(/"/g, "&quot;")}"
          data-add-dining-venue="${String(d.venue).replace(/"/g, "&quot;")}"
          data-add-dining-price="${Number(d.price).toFixed(2)}"
        >+ Add</button>
      </div>
    </article>`)
    .join("");

  $("diningList").innerHTML = rows
    .map((d) => `<li><strong>${d.name}</strong> @ ${d.venue} - $${Number(d.price).toFixed(2)}</li>`)
    .join("");
}

function renderMerchList() {
  const query = String(($("merchSearch") && $("merchSearch").value) || "").trim().toLowerCase();
  const zone = (($("merchZoneFilter") && $("merchZoneFilter").value) || "all").toLowerCase();
  const sortBy = ($("merchSort") && $("merchSort").value) || "name-asc";
  const maxPrice = Number(($("merchMaxPrice") && $("merchMaxPrice").value) || "");
  const hasMaxPrice = Number.isFinite(maxPrice) && maxPrice > 0;

  const rows = state.merchandise.filter((m) => {
    const zoneName = normalizeZoneName(m.AreaName);
    const price = Number(m.DiscountPrice || m.SellPrice || 0);
    const matchesSearch = !query || (
      textMatchesSearch(m.ItemName, query) ||
      textMatchesSearch(m.RetailName, query) ||
      textMatchesSearch(zoneName, query)
    );
    if (!matchesSearch) return false;
    if (zone !== "all" && zoneName.toLowerCase() !== zone) return false;
    if (hasMaxPrice && price > maxPrice) return false;
    return true;
  });

  rows.sort((a, b) => {
    const an = String(a.ItemName || "").toLowerCase();
    const bn = String(b.ItemName || "").toLowerCase();
    const ap = Number(a.DiscountPrice || a.SellPrice || 0);
    const bp = Number(b.DiscountPrice || b.SellPrice || 0);
    if (sortBy === "price-asc") return ap - bp;
    if (sortBy === "price-desc") return bp - ap;
    return an.localeCompare(bn);
  });

  const uniqueShops = new Set(rows.map((m) => String(m.RetailName || "Unknown")));
  const prices = rows.map((m) => Number(m.DiscountPrice || m.SellPrice || 0));
  const lowest = prices.length ? Math.min(...prices) : 0;
  const highest = prices.length ? Math.max(...prices) : 0;
  $("merchTotalItems").textContent = String(rows.length);
  $("merchTotalShops").textContent = String(uniqueShops.size);
  $("merchLowestPrice").textContent = `$${lowest.toFixed(2)}`;
  $("merchHighestPrice").textContent = `$${highest.toFixed(2)}`;

  $("merchCards").innerHTML = rows
    .map((m) => {
      const zoneName = normalizeZoneName(m.AreaName);
      const price = Number(m.DiscountPrice || m.SellPrice || 0);
      return `<article class="merch-card">
        <div class="zone">${zoneName}</div>
        <div class="item-name">${m.ItemName}</div>
        <div class="shop-name">${m.RetailName || "Unknown Shop"}</div>
        <div class="price-row">
          <strong>$${price.toFixed(2)}</strong>
          <button
            class="btn small"
            type="button"
            data-add-merch="${Number(m.ItemID)}"
            data-add-merch-name="${String(m.ItemName || "").replace(/"/g, "&quot;")}"
            data-add-merch-shop="${String(m.RetailName || "").replace(/"/g, "&quot;")}"
            data-add-merch-price="${price.toFixed(2)}"
          >+ Add</button>
        </div>
      </article>`;
    })
    .join("");
}

function cartTotal() {
  return state.merchCart.reduce((sum, it) => sum + (Number(it.price) * Number(it.qty)), 0);
}

function renderMerchCart() {
  const root = $("merchCartItems");
  if (!root) return;
  if (!state.merchCart.length) {
    root.innerHTML = `<p class="hint" style="margin:0;">Your cart is empty.</p>`;
    $("merchCartTotal").textContent = "$0.00";
    return;
  }

  root.innerHTML = state.merchCart
    .map(
      (it) => `<div class="cart-item">
      <div>
        <div><strong>${it.name}</strong></div>
        <div class="hint" style="font-size:12px;">${it.shop || "Unknown shop"}</div>
      </div>
      <div>$${Number(it.price).toFixed(2)}</div>
      <div class="cart-qty">
        <button class="btn small" type="button" data-cart-dec="${it.itemId}">-</button>
        <span>${it.qty}</span>
        <button class="btn small" type="button" data-cart-inc="${it.itemId}">+</button>
      </div>
      <button class="btn small" type="button" data-cart-remove="${it.itemId}">Remove</button>
    </div>`
    )
    .join("");
  $("merchCartTotal").textContent = `$${cartTotal().toFixed(2)}`;
}

function addToMerchCart(item) {
  const existing = state.merchCart.find((it) => it.itemId === item.itemId);
  if (existing) existing.qty += 1;
  else state.merchCart.push({ ...item, qty: 1 });
  renderMerchCart();
}

function updateCartItemQty(itemId, delta) {
  const target = state.merchCart.find((it) => it.itemId === itemId);
  if (!target) return;
  target.qty += delta;
  if (target.qty <= 0) state.merchCart = state.merchCart.filter((it) => it.itemId !== itemId);
  renderMerchCart();
}

function removeCartItem(itemId) {
  state.merchCart = state.merchCart.filter((it) => it.itemId !== itemId);
  renderMerchCart();
}

function diningCartTotal() {
  return state.diningCart.reduce((sum, it) => sum + (Number(it.price) * Number(it.qty)), 0);
}

function renderDiningCart() {
  const root = $("diningCartItems");
  if (!root) return;
  if (!state.diningCart.length) {
    root.innerHTML = `<p class="hint" style="margin:0;">Your dining cart is empty.</p>`;
    $("diningCartTotal").textContent = "$0.00";
    return;
  }
  root.innerHTML = state.diningCart
    .map((it) => `<div class="cart-item">
      <div>
        <div><strong>${it.name}</strong></div>
        <div class="hint" style="font-size:12px;">${it.venue} (${it.zone})</div>
      </div>
      <div>$${Number(it.price).toFixed(2)}</div>
      <div class="cart-qty">
        <button class="btn small" type="button" data-dining-cart-dec="${it.key}">-</button>
        <span>${it.qty}</span>
        <button class="btn small" type="button" data-dining-cart-inc="${it.key}">+</button>
      </div>
      <button class="btn small" type="button" data-dining-cart-remove="${it.key}">Remove</button>
    </div>`)
    .join("");
  $("diningCartTotal").textContent = `$${diningCartTotal().toFixed(2)}`;
}

function addToDiningCart(item) {
  const key = `${item.name}|${item.venue}|${item.zone}`;
  const existing = state.diningCart.find((it) => it.key === key);
  if (existing) existing.qty += 1;
  else state.diningCart.push({ ...item, key, qty: 1 });
  renderDiningCart();
}

function updateDiningCartQty(key, delta) {
  const target = state.diningCart.find((it) => it.key === key);
  if (!target) return;
  target.qty += delta;
  if (target.qty <= 0) state.diningCart = state.diningCart.filter((it) => it.key !== key);
  renderDiningCart();
}

function removeDiningCartItem(key) {
  state.diningCart = state.diningCart.filter((it) => it.key !== key);
  renderDiningCart();
}

async function loadLookups(token) {
  const [areas, parks, attractions, dining, merchandise] = await Promise.all([
    api("/api/areas", { token }),
    api("/api/parks", { token }),
    api("/api/attractions", { token }),
    api("/api/dining", { token }),
    api("/api/merchandise", { token }),
  ]);
  state.areas = areas;
  state.parks = parks;
  state.attractions = attractions;
  state.dining = dining;
  state.merchandise = merchandise;

  fillSelect("itineraryAttraction", attractions, "AttractionID", "AttractionName", true);
  fillSelect("itineraryPark", parks, "ParkID", "ParkName", true);
  fillSelect("reservationAttraction", attractions, "AttractionID", "AttractionName", true);
  fillSelect("reservationDining", dining, "DiningID", "DiningName", true);
  fillSelect("feedbackAttraction", attractions, "AttractionID", "AttractionName", true);
  fillSelect("diningOrderDining", dining, "DiningID", "DiningName", false);
  fillSelect("merchOrderItem", merchandise, "ItemID", "ItemName", false);

  const zones = Array.from(
    new Set(PARK_ZONES)
  );
  if ($("merchZoneFilter")) {
    $("merchZoneFilter").innerHTML =
      `<option value="all">All zones</option>` +
      zones.map((z) => `<option value="${z.toLowerCase()}">${z}</option>`).join("");
  }

  const diningZones = Array.from(new Set(PARK_ZONES));
  if ($("diningZoneFilter")) {
    $("diningZoneFilter").innerHTML =
      `<option value="all">All zones</option>` +
      diningZones.map((z) => `<option value="${z.toLowerCase()}">${z}</option>`).join("");
  }
}

function showAuth(isAuthView) {
  $("authSection").classList.toggle("hidden", !isAuthView);
  $("appSection").classList.toggle("hidden", isAuthView);
  $("btnLogout").classList.toggle("hidden", isAuthView);
  if (isAuthView) setAuthMode("login");
}

async function refreshProfile() {
  const token = getToken();
  const me = await api("/api/visitor/me", { token });
  $("visitorBadge").textContent = `${me.Name} (${me.Email})`;
  $("profileName").value = me.Name || "";
  $("profilePhone").value = me.Phone || "";
  $("profileGender").value = me.Gender || "";
  $("profileAge").value = me.Age == null ? "" : me.Age;
}

async function renderVisitHistory() {
  const rows = await api("/api/visitor/visit-history", { token: getToken() });
  $("visitHistoryList").innerHTML = rows
    .map((r) => `<li><strong>${r.ActivityType}</strong> - ${r.ActivitySummary} (${r.VisitDateTime})</li>`)
    .join("");
}

async function renderAttractions() {
  const rows = await api("/api/attractions", { token: getToken() });
  $("attractionsTbody").innerHTML = rows
    .map(
      (a) => `<tr>
      <td>${renderGeneratedArtImage(a.AttractionName, 140, 80, a.AttractionName)}</td>
      <td>${a.AttractionName}</td>
      <td>${a.Description || "-"}</td>
      <td>${a.HeightRequirementCm || "-"}</td>
      <td>${a.DurationMinutes || "-"}</td>
      <td>${a.ThrillLevel || "Medium"}</td>
      <td>${a.Status}</td>
      <td>${a.WaitTimeMinutes || 0} min</td>
    </tr>`
    )
    .join("");
  wireGeneratedImages($("attractionsTbody"));
}

async function renderParksAndEvents() {
  const events = await api("/api/events", { token: getToken() });
  $("eventsList").innerHTML = events
    .map(
      (e) => `<li style="display:flex; gap:10px; align-items:flex-start; margin-bottom:10px;">
      ${renderGeneratedArtImage(e.EventName, 120, 70, e.EventName)}
      <div><strong>${e.EventName}</strong> (${e.EventDate}) ${e.StartTime || ""}-${e.EndTime || ""} - ${e.EventDescription || ""}</div>
    </li>`
    )
    .join("");
  wireGeneratedImages($("eventsList"));
}

async function renderTickets() {
  const rows = await api("/api/tickets", { token: getToken() });
  $("ticketsTbody").innerHTML = rows
    .map((t) => `<tr><td>${t.TicketNumber}</td><td>${t.TicketType}</td><td>${t.DiscountFor}</td><td>${Number(t.Price).toFixed(2)}</td><td>${t.ExpiryDate}</td><td>${t.IsActive ? "Active" : "Expired"}</td></tr>`)
    .join("");
}

async function renderReservations() {
  const rows = await api("/api/reservations", { token: getToken() });
  $("reservationsTbody").innerHTML = rows
    .map(
      (r) => `<tr>
      <td>${r.ReservationID}</td>
      <td>${r.ReservationType}</td>
      <td>${r.AttractionName || r.DiningName || "-"}</td>
      <td>${r.ReservationDate}</td>
      <td>${r.TimeSlot}</td>
      <td>${r.Status}</td>
      <td><button class="btn small" data-cancel-res="${r.ReservationID}">Cancel</button></td>
    </tr>`
    )
    .join("");
}

async function renderItinerary() {
  const rows = await api("/api/itinerary", { token: getToken() });
  $("itineraryList").innerHTML = rows
    .map((i) => `<li>${i.ItemType}: ${i.AttractionName || i.ParkName || "-"} ${i.PlannedDate ? `on ${i.PlannedDate}` : ""} <button class="btn small" data-del-itin="${i.ItineraryID}">Delete</button></li>`)
    .join("");
}

async function renderDiningAndMerch() {
  const [dining, merch] = await Promise.all([api("/api/dining", { token: getToken() }), api("/api/merchandise", { token: getToken() })]);
  state.dining = dining;
  state.merchandise = merch;
  renderDiningList();
  renderMerchList();
}

async function renderOrders() {
  const rows = await api("/api/orders", { token: getToken() });
  $("ordersTbody").innerHTML = rows
    .map((o) => `<tr><td>${o.OrderID}</td><td>${o.OrderType}</td><td>${Number(o.OrderTotal).toFixed(2)}</td><td>${o.PromoCode || "-"}</td><td>${o.PaymentStatus}</td><td><button class="btn small" data-order-items="${o.OrderID}">View Items</button></td></tr>`)
    .join("");
}

async function renderFeedback() {
  const rows = await api("/api/feedback-submissions", { token: getToken() });
  $("feedbackList").innerHTML = rows
    .map((f) => `<li><strong>${f.FeedbackType}</strong> ${f.AttractionName ? `for ${f.AttractionName}` : ""}: ${f.Message}</li>`)
    .join("");
}

async function fullRefresh() {
  await Promise.all([
    refreshProfile(),
    renderVisitHistory(),
    renderAttractions(),
    renderParksAndEvents(),
    renderTickets(),
    renderReservations(),
    renderItinerary(),
    renderDiningAndMerch(),
    renderOrders(),
    renderFeedback(),
  ]);
}

function bindAuthForms() {
  $("btnShowLogin").addEventListener("click", () => setAuthMode("login"));
  $("btnShowRegister").addEventListener("click", () => setAuthMode("register"));

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    showAuthError("");
    try {
      const tokenData = await api("/api/visitor/login", {
        method: "POST",
        body: { Email: e.target.email.value, Password: e.target.password.value },
      });
      setToken(tokenData.token);
      await bootApp();
    } catch (err) {
      showStatus(err.message, true);
      showAuthError(err.message);
    }
  });

  $("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    showAuthError("");
    try {
      const tokenData = await api("/api/visitor/register", {
        method: "POST",
        body: {
          Name: e.target.name.value,
          Phone: e.target.phone.value || null,
          Email: e.target.email.value,
          Password: e.target.password.value,
          Gender: e.target.gender.value || null,
          Age: e.target.age.value === "" ? null : Number(e.target.age.value),
        },
      });
      setToken(tokenData.token);
      await bootApp();
    } catch (err) {
      showStatus(err.message, true);
      showAuthError(err.message);
    }
  });
}

function bindAppActions() {
  $("btnLogout").addEventListener("click", logoutVisitor);
  $("btnLogoutAccount").addEventListener("click", logoutVisitor);

  document.querySelectorAll(".tab-btn").forEach((btn) => btn.addEventListener("click", () => setTab(btn.dataset.tab)));

  $("profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/api/visitor/profile", {
      method: "PUT",
      token: getToken(),
      body: {
        Name: $("profileName").value,
        Phone: $("profilePhone").value || null,
        Gender: $("profileGender").value || null,
        Age: $("profileAge").value === "" ? null : Number($("profileAge").value),
      },
    });
    showStatus("Profile updated.");
    await fullRefresh();
  });

  $("ticketCategory").addEventListener("change", updateTicketPricingPreview);
  $("ticketPlan").addEventListener("change", updateTicketPricingPreview);
  $("diningShopViewSelect").addEventListener("change", (e) => setDiningShopView(e.target.value));
  $("diningSearch").addEventListener("input", renderDiningList);
  $("diningZoneFilter").addEventListener("change", renderDiningList);
  $("diningSort").addEventListener("change", renderDiningList);
  $("diningMaxPrice").addEventListener("input", renderDiningList);
  $("merchSearch").addEventListener("input", renderMerchList);
  $("merchZoneFilter").addEventListener("change", renderMerchList);
  $("merchSort").addEventListener("change", renderMerchList);
  $("merchMaxPrice").addEventListener("input", renderMerchList);
  $("parkContentView").addEventListener("change", (e) => setParkContentView(e.target.value));

  $("ticketPurchaseForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/api/tickets/purchase", {
      method: "POST",
      token: getToken(),
      body: {
        TicketPlan: $("ticketPlan").value,
        TicketCategory: $("ticketCategory").value,
        ExpiryDate: $("ticketExpiry").value,
        PromoCode: $("ticketPromo").value || null,
        PaymentMethod: $("ticketPaymentMethod").value || null,
      },
    });
    showStatus("Ticket purchased.");
    e.target.reset();
    await fullRefresh();
  });

  $("reservationForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/api/reservations", {
      method: "POST",
      token: getToken(),
      body: {
        ReservationType: $("reservationType").value,
        AttractionID: $("reservationAttraction").value || null,
        DiningID: $("reservationDining").value || null,
        ReservationDate: $("reservationDate").value,
        TimeSlot: $("reservationTimeSlot").value,
        PartySize: Number($("reservationPartySize").value || 1),
        Notes: $("reservationNotes").value || null,
      },
    });
    showStatus("Reservation saved.");
    e.target.reset();
    await renderReservations();
  });

  $("reservationsTbody").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-cancel-res]");
    if (!btn) return;
    const id = Number(btn.dataset.cancelRes);
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 5);
    await api(`/api/reservations/${id}`, {
      method: "PUT",
      token: getToken(),
      body: { ReservationDate: date, TimeSlot: time, PartySize: 1, Status: "Cancelled", Notes: "Cancelled by visitor" },
    });
    await renderReservations();
  });

  $("itineraryForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/api/itinerary", {
      method: "POST",
      token: getToken(),
      body: {
        AttractionID: $("itineraryAttraction").value || null,
        ParkID: $("itineraryPark").value || null,
        PlannedDate: $("itineraryDate").value || null,
        ItemType: $("itineraryType").value,
        Notes: $("itineraryNotes").value || null,
      },
    });
    e.target.reset();
    await renderItinerary();
  });

  $("itineraryList").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-del-itin]");
    if (!btn) return;
    await api(`/api/itinerary/${Number(btn.dataset.delItin)}`, { method: "DELETE", token: getToken() });
    await renderItinerary();
  });

  $("diningOrderForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/api/orders/dining", {
      method: "POST",
      token: getToken(),
      body: {
        DiningID: Number($("diningOrderDining").value),
        Quantity: Number($("diningOrderQty").value || 1),
        UnitPrice: Number($("diningOrderUnitPrice").value),
        PromoCode: $("diningPromo").value || null,
        PaymentMethod: $("diningPaymentMethod").value || null,
      },
    });
    await renderOrders();
  });

  $("diningCards").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add-dining-name]");
    if (!btn) return;
    const name = btn.dataset.addDiningName || "Dining item";
    const zone = btn.dataset.addDiningZone || "General";
    const venue = btn.dataset.addDiningVenue || "Park Dining";
    const price = Number(btn.dataset.addDiningPrice || 0);
    addToDiningCart({ name, zone, venue, price });
    $("diningOrderUnitPrice").value = price.toFixed(2);
    showStatus(`${name} added to dining cart ($${price.toFixed(2)}).`);
  });

  $("diningCartItems").addEventListener("click", (e) => {
    const inc = e.target.closest("[data-dining-cart-inc]");
    if (inc) return updateDiningCartQty(inc.dataset.diningCartInc, 1);
    const dec = e.target.closest("[data-dining-cart-dec]");
    if (dec) return updateDiningCartQty(dec.dataset.diningCartDec, -1);
    const remove = e.target.closest("[data-dining-cart-remove]");
    if (remove) return removeDiningCartItem(remove.dataset.diningCartRemove);
  });

  $("btnClearDiningCart").addEventListener("click", () => {
    state.diningCart = [];
    renderDiningCart();
    showStatus("Dining cart cleared.");
  });

  $("btnCheckoutDiningCart").addEventListener("click", async () => {
    if (!state.diningCart.length) {
      showStatus("Your dining cart is empty.", true);
      return;
    }
    const paymentMethod = $("diningPaymentMethod").value || "Card";
    const promoCode = $("diningPromo").value || null;
    const fallbackDiningId = Number($("diningOrderDining").value || 0);
    if (!fallbackDiningId) {
      showStatus("Select a dining option before checkout.", true);
      return;
    }
    for (const item of state.diningCart) {
      await api("/api/orders/dining", {
        method: "POST",
        token: getToken(),
        body: {
          DiningID: fallbackDiningId,
          Quantity: Number(item.qty),
          UnitPrice: Number(item.price),
          PromoCode: promoCode,
          PaymentMethod: paymentMethod,
        },
      });
    }
    state.diningCart = [];
    renderDiningCart();
    await renderOrders();
    showStatus("Dining cart checkout complete.");
  });

  $("merchOrderForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/api/orders/merchandise", {
      method: "POST",
      token: getToken(),
      body: {
        ItemID: Number($("merchOrderItem").value),
        Quantity: Number($("merchOrderQty").value || 1),
        PromoCode: $("merchPromo").value || null,
        PaymentMethod: $("merchPaymentMethod").value || null,
      },
    });
    await renderOrders();
  });

  $("merchCards").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add-merch]");
    if (!btn) return;
    const itemId = Number(btn.dataset.addMerch);
    const itemName = btn.dataset.addMerchName || "Merch item";
    const shopName = btn.dataset.addMerchShop || "Unknown shop";
    const price = Number(btn.dataset.addMerchPrice || 0);
    addToMerchCart({ itemId, name: itemName, shop: shopName, price });
    $("merchOrderItem").value = String(itemId);
    showStatus(`${itemName} added to quick order ($${price.toFixed(2)}). Complete payment below.`);
  });

  $("merchCartItems").addEventListener("click", (e) => {
    const inc = e.target.closest("[data-cart-inc]");
    if (inc) return updateCartItemQty(Number(inc.dataset.cartInc), 1);
    const dec = e.target.closest("[data-cart-dec]");
    if (dec) return updateCartItemQty(Number(dec.dataset.cartDec), -1);
    const remove = e.target.closest("[data-cart-remove]");
    if (remove) return removeCartItem(Number(remove.dataset.cartRemove));
  });

  $("btnClearMerchCart").addEventListener("click", () => {
    state.merchCart = [];
    renderMerchCart();
    showStatus("Merch cart cleared.");
  });

  $("btnCheckoutMerchCart").addEventListener("click", async () => {
    if (!state.merchCart.length) {
      showStatus("Your merch cart is empty.", true);
      return;
    }
    const paymentMethod = $("merchPaymentMethod").value || "Card";
    const promoCode = $("merchPromo").value || null;

    for (const item of state.merchCart) {
      await api("/api/orders/merchandise", {
        method: "POST",
        token: getToken(),
        body: {
          ItemID: Number(item.itemId),
          Quantity: Number(item.qty),
          PromoCode: promoCode,
          PaymentMethod: paymentMethod,
        },
      });
    }

    state.merchCart = [];
    renderMerchCart();
    await renderOrders();
    showStatus("Merch cart checkout complete.");
  });

  $("ordersTbody").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-order-items]");
    if (!btn) return;
    const rows = await api(`/api/orders/${Number(btn.dataset.orderItems)}/items`, { token: getToken() });
    $("orderItemsPreview").textContent = JSON.stringify(rows, null, 2);
  });

  $("feedbackForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await api("/api/feedback-submissions", {
      method: "POST",
      token: getToken(),
      body: {
        AttractionID: $("feedbackAttraction").value || null,
        Rating: $("feedbackRating").value === "" ? null : Number($("feedbackRating").value),
        FeedbackType: $("feedbackType").value,
        Message: $("feedbackMessage").value,
      },
    });
    e.target.reset();
    await renderFeedback();
  });
}

async function bootApp() {
  const token = getToken();
  if (!token) {
    showAuth(true);
    return;
  }
  try {
    await loadLookups(token);
    showAuth(false);
    await fullRefresh();
    setTab("account");
  } catch (err) {
    clearToken();
    showAuth(true);
    showStatus(`Session reset: ${err.message}`, true);
  }
}

bindAuthForms();
bindAppActions();
updateTicketPricingPreview();
setDiningShopView("dining");
setParkContentView("attractions");
renderMerchCart();
renderDiningCart();
bootApp();

