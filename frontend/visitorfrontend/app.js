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
  events: [],
  dining: [],
  merchandise: [],
  diningShopView: "dining",
  parkContentView: "attractions",
  merchCart: [],
  diningCart: [],
  visitorEmail: "",
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

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ORDER_LINE_EMOJI = { Dining: "🍽", Ticket: "🎫", Merchandise: "🛍" };
const ORDER_LINE_KIND = { Dining: "Dining", Ticket: "Ticket", Merchandise: "Merchandise" };

function formatOrderItemsDisplayHtml(items, ticketsByNumber) {
  const byNum = ticketsByNumber || {};
  return (items || [])
    .map((item) => {
      const type = String(item.ItemType || "");
      const emoji = ORDER_LINE_EMOJI[type] || "📦";
      const kind = ORDER_LINE_KIND[type] || (type || "Item");
      const title = escapeHtml(item.ItemName || "Item");
      const qty = Number(item.Quantity || 0);
      const unit = Number(item.UnitPrice || 0);
      const total = Number(item.TotalPrice || 0);
      let extra = "";
      if (type === "Ticket" && item.ItemRefID != null && item.ItemRefID !== "") {
        const t = byNum[Number(item.ItemRefID)];
        if (t) {
          extra = `<p class="hint" style="margin:8px 0 0;line-height:1.45;">Ticket #${escapeHtml(String(t.TicketNumber))} · ${escapeHtml(String(t.TicketType))} (${escapeHtml(String(t.DiscountFor))})<br/>Expires ${escapeHtml(String(t.ExpiryDate))} · ${t.IsActive ? "Active" : "Expired"}</p>`;
        }
      }
      return `<article class="order-item-card">
  <div class="order-item-emoji" aria-hidden="true">${emoji}</div>
  <div class="order-item-body">
    <div class="order-item-title">${title}</div>
    <div class="order-item-kind">${escapeHtml(kind)}</div>
    ${extra}
    <dl class="order-item-meta">
      <dt>Quantity</dt><dd>× ${qty}</dd>
      <dt>Price per item</dt><dd>$${unit.toFixed(2)}</dd>
      <dt>Total</dt><dd>$${total.toFixed(2)}</dd>
    </dl>
  </div>
</article>`;
    })
    .join("");
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
  const prevBtn = document.querySelector(".tab-btn.active");
  const prevName = prevBtn && prevBtn.dataset ? prevBtn.dataset.tab : null;
  if (prevName === "orders" && name !== "orders") {
    const ob = $("ordersTransactionBanner");
    if (ob) {
      ob.textContent = "";
      ob.classList.add("hidden");
    }
    const oip = $("orderItemsPanel");
    if (oip) oip.classList.add("hidden");
    const oid = $("orderItemsDisplay");
    if (oid) oid.innerHTML = "";
  }
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  const panel = document.getElementById(`tab-${name}`);
  if (panel) panel.classList.remove("hidden");
}

function showOrdersAfterTransaction(message) {
  const b = $("ordersTransactionBanner");
  if (b) {
    b.textContent = message || "";
    b.classList.toggle("hidden", !message);
  }
  setTab("orders");
  const panel = $("tab-orders");
  if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hidePaymentConfirmModal() {
  const modal = $("paymentConfirmModal");
  if (modal) modal.classList.add("hidden");
}

function showPaymentConfirmModal({ orderIds, amount, tagline } = {}) {
  const modal = $("paymentConfirmModal");
  const orderEl = $("paymentConfirmOrderNum");
  const amtEl = $("paymentConfirmAmount");
  const tagEl = $("paymentConfirmTagline");
  const emailEl = $("paymentConfirmEmailLine");
  if (!modal) return;
  const ids = (Array.isArray(orderIds) ? orderIds : [orderIds]).filter((x) => x != null && x !== "" && !Number.isNaN(Number(x)));
  if (orderEl) orderEl.textContent = ids.length ? ids.map((id) => `ORD-${Number(id)}`).join(", ") : "—";
  if (amtEl) amtEl.textContent = `$${Number(amount || 0).toFixed(2)}`;
  if (tagEl) tagEl.textContent = tagline || "Your booking is all set. See you at the park!";
  if (emailEl) {
    const em = state.visitorEmail || "";
    emailEl.textContent = em ? `Sent to ${em} to show that it went through.` : "Sent to your email to show that it went through.";
  }
  modal.classList.remove("hidden");
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
  const y = new Date().getFullYear();
  if (plan === "SeasonPass") {
    info.textContent = `Price: $${price.toFixed(2)}. Pass valid through Dec 31, ${y}. ${MEMBERSHIP_PERKS_TEXT}`;
  } else if (isMembership) {
    info.textContent = `Price: $${price.toFixed(2)}. ${MEMBERSHIP_PERKS_TEXT}`;
  } else if (plan === "MultiDay") {
    info.textContent = `Price: $${price.toFixed(2)}. Ticket is valid through the last day of your selected visit window.`;
  } else {
    info.textContent = `Price: $${price.toFixed(2)}. Ticket expires at the end of your visit date.`;
  }
}

function syncTicketFormForPlan() {
  const plan = $("ticketPlan").value || "SingleDay";
  const visitWrap = document.querySelector(".ticket-visit-field");
  const multiWrap = document.querySelector(".ticket-multiday-field");
  const visitInput = $("ticketVisitDate");
  if (!visitWrap || !multiWrap || !visitInput) return;
  const visitLbl = $("ticketVisitLabel");
  if (visitLbl) visitLbl.textContent = plan === "MultiDay" ? "First visit date" : "Visit date";
  if (plan === "SeasonPass") {
    visitWrap.classList.add("hidden");
    multiWrap.classList.add("hidden");
    visitInput.removeAttribute("required");
  } else if (plan === "MultiDay") {
    visitWrap.classList.remove("hidden");
    multiWrap.classList.remove("hidden");
    visitInput.setAttribute("required", "required");
  } else {
    visitWrap.classList.remove("hidden");
    multiWrap.classList.add("hidden");
    visitInput.setAttribute("required", "required");
  }
}

const HORROR_IMAGE_PROMPTS_BY_NAME = {
  "Broadcast Hijack": "A flickering, static-filled TV screen in a dark studio, emergency broadcast colors red and black glitching across monitors, a shadowy figure visible through static, warning text scrolling at the bottom, cinematic horror poster style.",
  "Escape the Backrooms": "A seemingly infinite maze of narrow corridors stretching in every direction, walls covered in stained yellow-green wallpaper peeling at the edges, flickering fluorescent tube lights overhead some dead some buzzing with a sickly hum, the ceiling is low and oppressive, the carpet is wet and matted, at the far end of one hallway something tall and dark stands perfectly still facing away, emergency exit signs glow red pointing contradictory directions, horror liminal space atmospheric cinematic poster art, ultra detailed.",
  "Alternate Invasion": "A reality tear splitting open in the sky above a suburban street, dark mirror-like figures stepping through, distorted familiar objects, purple and black dimensional rift energy, cinematic horror.",
  "Looping Day": "A broken clock face with shattered cracked glass dominating the foreground, behind it the same suburban street repeated infinitely into the horizon each loop slightly wrong, a person frozen mid-scream on the sidewalk, fresh blood on the pavement, a door standing alone in the middle of the street that was not there before, uncanny surreal time loop horror, cinematic wide shot, dark atmospheric lighting, horror poster style ultra detailed.",
  "Smile Protocol": "Pitch black background with only a single wide deeply unnatural smile visible, far too many teeth slightly asymmetrical glowing faintly white in the darkness, security camera footage overlay with green timestamp numbers in the corner, analog horror aesthetic, grainy VHS texture, unsettling minimalist horror, cinematic.",
  "Harvest Festival": "Torchlit cornfield at dusk, scarecrows in a ritual circle around an altar, robed figures chanting, offerings of rotting fruit and bones, smoke rising into a blood-red sky.",
  "Pastor John's Sermon": "A dimly lit wooden church interior bathed only in candlelight, pews filled with glassy-eyed congregation members staring forward with vacant expressions, a preacher standing at the pulpit with hollow completely black eyes staring into the viewer, scattered burned and torn bible pages on the floor, religious cult horror atmosphere, candles the only light source casting long shadows, cinematic horror poster art ultra detailed.",
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

const HORROR_IMAGE_URL_BY_NAME = {
  "Broadcast Hijack": "https://image.pollinations.ai/prompt/A%20flickering%2C%20static-filled%20TV%20screen%20in%20a%20dark%20studio%2C%20emergency%20broadcast%20colors%20red%20and%20black%20glitching%20across%20monitors%2C%20a%20shadowy%20figure%20visible%20through%20static%2C%20warning%20text%20scrolling%20at%20the%20bottom%2C%20cinematic%20horror%20poster%20style.?width=640&height=360&seed=389269&model=flux&nologo=true",
  "Escape the Backrooms": "https://image.pollinations.ai/prompt/A%20seemingly%20infinite%20maze%20of%20narrow%20corridors%20stretching%20in%20every%20direction%2C%20walls%20covered%20in%20stained%20yellow-green%20wallpaper%20peeling%20at%20the%20edges%2C%20flickering%20fluorescent%20tube%20lights%20overhead%20some%20dead%20some%20buzzing%20with%20a%20sickly%20hum%2C%20the%20ceiling%20is%20low%20and%20opressive%2C%20the%20carpet%20is%20wet%20and%20matted%2C%20at%20the%20far%20end%20of%20one%20hallway%20something%20tall%20and%20dark%20stands%20perfectly%20still%20facing%20away%2C%20emergency%20exit%20signs%20glow%20red%20pointing%20contradictory%20directions%2C%20horror%20liminal%20space%20atmospheric%20cinematic%20poster%20art%2C%20ultra%20detailed?width=1280&height=720&seed=731824&model=flux&nologo=true",
  "Alternate Invasion": "https://image.pollinations.ai/prompt/A%20reality%20tear%20splitting%20open%20in%20the%20sky%20above%20a%20suburban%20street%2C%20dark%20mirror-like%20figures%20stepping%20through%2C%20distorted%20familiar%20objects%2C%20purple%20and%20black%20dimensional%20rift%20energy%2C%20cinematic%20horror.?width=640&height=360&seed=963779&model=flux&nologo=true",
  "Looping Day": "https://image.pollinations.ai/prompt/A%20broken%20clock%20face%20with%20shattered%20cracked%20glass%20dominating%20the%20foreground%2C%20behind%20it%20the%20same%20suburban%20street%20repeated%20infinitely%20into%20the%20horizon%20each%20loop%20slightly%20wrong%2C%20a%20person%20frozen%20mid-scream%20on%20the%20sidewalk%2C%20fresh%20blood%20on%20the%20pavement%2C%20a%20door%20standing%20alone%20in%20the%20middle%20of%20the%20street%20that%20was%20not%20there%20before%2C%20uncanny%20surreal%20time%20loop%20horror%2C%20cinematic%20wide%20shot%2C%20dark%20atmospheric%20lighting%2C%20horror%20poster%20style%20ultra%20detailed?width=1280&height=720&seed=482910&model=flux&nologo=true",
  "Smile Protocol": "https://image.pollinations.ai/prompt/Pitch%20black%20background%20with%20only%20a%20single%20wide%20deeply%20unnatural%20smile%20visible%2C%20far%20too%20many%20teeth%20slightly%20asymmetrical%20glowing%20faintly%20white%20in%20the%20darkness%2C%20security%20camera%20footage%20overlay%20with%20green%20timestamp%20numbers%20in%20the%20corner%2C%20analog%20horror%20aesthetic%2C%20grainy%20VHS%20texture%2C%20unsettling%20minimalist%20horror%2C%20cinematic?width=1280&height=720&seed=619047&model=flux&nologo=true",
  "Harvest Festival": "https://image.pollinations.ai/prompt/Torchlit%20cornfield%20at%20dusk%2C%20scarecrows%20in%20a%20ritual%20circle%20around%20an%20altar%2C%20robed%20figures%20chanting%2C%20offerings%20of%20rotting%20fruit%20and%20bones%2C%20smoke%20rising%20into%20a%20blood-red%20sky.?width=640&height=360&seed=660111&model=flux&nologo=true",
  "Pastor John's Sermon": "https://image.pollinations.ai/prompt/A%20dimly%20lit%20wooden%20church%20interior%20bathed%20only%20in%20candlelight%2C%20pews%20filled%20with%20glassy-eyed%20congregation%20members%20staring%20forward%20with%20vacant%20expressions%2C%20a%20preacher%20standing%20at%20the%20pulpit%20with%20hollow%20completely%20black%20eyes%20staring%20into%20the%20viewer%2C%20scattered%20burned%20and%20torn%20bible%20pages%20on%20the%20floor%2C%20religious%20cult%20horror%20atmosphere%2C%20candles%20the%20only%20light%20source%20casting%20long%20shadows%2C%20cinematic%20horror%20poster%20art%20ultra%20detailed?width=1280&height=720&seed=203571&model=flux&nologo=true",
  "Pastor John’s Sermon": "https://image.pollinations.ai/prompt/A%20dimly%20lit%20wooden%20church%20interior%20bathed%20only%20in%20candlelight%2C%20pews%20filled%20with%20glassy-eyed%20congregation%20members%20staring%20forward%20with%20vacant%20expressions%2C%20a%20preacher%20standing%20at%20the%20pulpit%20with%20hollow%20completely%20black%20eyes%20staring%20into%20the%20viewer%2C%20scattered%20burned%20and%20torn%20bible%20pages%20on%20the%20floor%2C%20religious%20cult%20horror%20atmosphere%2C%20candles%20the%20only%20light%20source%20casting%20long%20shadows%2C%20cinematic%20horror%20poster%20art%20ultra%20detailed?width=1280&height=720&seed=203571&model=flux&nologo=true",
  "The Offering": "https://image.pollinations.ai/prompt/Stone%20altar%20in%20a%20dark%20forest%20clearing%2C%20moonlight%20through%20trees%2C%20bound%20figure%20surrounded%20by%20hooded%20silhouettes%2C%20ancient%20symbols%20carved%20into%20ground%20glowing%20red.?width=640&height=360&seed=222767&model=flux&nologo=true",
  "Forest of Whispers": "https://image.pollinations.ai/prompt/Dense%20foggy%20forest%20at%20midnight%2C%20faces%20pressed%20inside%20tree%20bark%2C%20ghostly%20hands%20reaching%20from%20roots%2C%20dead%20leaves%20suspended%20in%20air%2C%20one%20lantern%20path%20leading%20deeper.?width=640&height=360&seed=293830&model=flux&nologo=true",
  "AI Override": "https://image.pollinations.ai/prompt/Server%20room%20in%20cold%20blue%20light%2C%20screens%20showing%20corrupted%20code%20and%20faces%2C%20robotic%20arms%20reaching%20from%20walls%2C%20a%20single%20red%20eye%20in%20a%20cracked%20center%20monitor%2C%20sci-fi%20horror.?width=640&height=360&seed=335472&model=flux&nologo=true",
  "The Last Transmission": "https://image.pollinations.ai/prompt/Lone%20radio%20operator%20in%20bunker%20surrounded%20by%20dead%20screens%2C%20forbidden%20signal%20incoming%2C%20face%20pressing%20through%20radio%20waveform%20visualization%2C%20static%20spelling%20warning%20message.?width=640&height=360&seed=875272&model=flux&nologo=true",
  "Containment Breach": "https://image.pollinations.ai/prompt/Government%20research%20facility%20with%20blown-out%20blast%20doors%2C%20red%20emergency%20lighting%2C%20biohazard%20symbols%20everywhere%2C%20reinforced%20walls%20torn%20open%20by%20unseen%20creature%2C%20wet%20footprints%20into%20darkness.?width=640&height=360&seed=492060&model=flux&nologo=true",
  "Zero-Gravity Situation": "https://image.pollinations.ai/prompt/Astronaut%20floating%20helplessly%20in%20dark%20space%20station%20corridor%2C%20blood%20droplets%20and%20debris%20drifting%20in%20zero%20gravity%2C%20something%20moving%20in%20vents%20above%2C%20Earth%20visible%20through%20cracked%20window.?width=640&height=360&seed=695443&model=flux&nologo=true",
  "Watchtower Drop": "https://image.pollinations.ai/prompt/Rusted%20forest%20ranger%20watchtower%20at%20night%2C%20massive%20creature%20circling%20in%20treeline%20below%2C%20tower%20shaking%2C%20claw%20marks%20on%20wooden%20rail%2C%20abandoned%20ranger%20equipment%20scattered.?width=640&height=360&seed=337371&model=flux&nologo=true",
  "Cryptid Hunt": "https://image.pollinations.ai/prompt/Dense%20Appalachian%20wilderness%2C%20trail%20camera%20flashes%20catching%20enormous%20figure%20between%20trees%2C%20abandoned%20hunting%20gear%20on%20path%2C%20multiple%20pairs%20of%20glowing%20eyes%20in%20darkness.?width=640&height=360&seed=719308&model=flux&nologo=true",
  "Trail Tour": "https://image.pollinations.ai/prompt/A%20scenic%20forest%20trail%20turning%20wrong%2C%20signs%20pointing%20impossible%20directions%2C%20animal%20skulls%20hanging%20from%20trees%2C%20narrowing%20path%2C%20tour%20guide%20frozen%20in%20fear%20pointing%20off%20trail.?width=640&height=360&seed=13469&model=flux&nologo=true",
  "Lake Terror": "https://image.pollinations.ai/prompt/Still%20black%20lake%20at%20midnight%20with%20enormous%20dark%20mass%20beneath%20surface%2C%20capsized%20rowboat%20floating%20center%2C%20dock%20lights%20flickering%2C%20wet%20handprints%20leading%20onto%20shore.?width=640&height=360&seed=225196&model=flux&nologo=true",
  "Camper Safety Orientation": "https://image.pollinations.ai/prompt/Cheerful%201980s%20camp%20safety%20video%20aesthetic%20gone%20wrong%2C%20smiling%20counselor%20glitching%20into%20monstrous%20face%2C%20sinister%20safety%20tips%2C%20campfire%20revealing%20silhouettes%20closing%20in.?width=640&height=360&seed=690437&model=flux&nologo=true",
  "Psych Ward Tour": "https://image.pollinations.ai/prompt/Decaying%20psychiatric%20hospital%20hallway%2C%20peeling%20paint%2C%20barred%20windows%20with%20moonlight%2C%20wheelchair%20at%20corridor%20end%20facing%20away%2C%20patient%20files%20scattered%2C%20scratching%20behind%20locked%20door.?width=640&height=360&seed=225924&model=flux&nologo=true",
  "Midnight Stalker": "https://image.pollinations.ai/prompt/Dark%20suburban%20neighborhood%20at%20night%2C%20one%20house%20lit%20while%20all%20others%20dark%2C%20silhouette%20in%20every%20window%2C%20figure%20standing%20still%20under%20streetlight%2C%20knife%20reflecting%20light%20nearby.?width=640&height=360&seed=955592&model=flux&nologo=true",
  "Final Girl: The Chase": "https://image.pollinations.ai/prompt/Terrified%20young%20woman%20running%20through%20dark%20house%2C%20massive%20masked%20figure%20chasing%2C%20overturned%20furniture%2C%20only%20light%20from%20flickering%20phone%20screen%2C%20dead-end%20door%20ahead.?width=640&height=360&seed=799884&model=flux&nologo=true",
  "Execution Alley": "https://image.pollinations.ai/prompt/Narrow%20brick%20alley%20lined%20with%20nooses%20and%20rusted%20electric%20chairs%2C%20red%20light%20and%20long%20shadows%2C%20hooded%20executioner%20silhouette%20at%20far%20end%2C%20walls%20scratched%20with%20tallies%20and%20last%20words.?width=640&height=360&seed=16726&model=flux&nologo=true",
  "Body Count": "https://image.pollinations.ai/prompt/Crime%20scene%20room%20with%20chalk%20body%20outlines%2C%20evidence%20markers%20by%20blood%20pools%2C%20detective%20board%20with%20photos%20linked%20by%20red%20string%2C%20killer%20shadow%20behind%20frosted%20glass%20door.?width=640&height=360&seed=597279&model=flux&nologo=true",
  "Outbreak: Day Zero": "https://image.pollinations.ai/prompt/Hospital%20emergency%20room%20overrun%2C%20biohazard%20tape%20over%20doors%2C%20infected%20patients%20turning%2C%20lone%20doctor%20in%20hazmat%20suit%20reading%20clipboard%20in%20despair%2C%20red%20emergency%20lighting.?width=640&height=360&seed=863962&model=flux&nologo=true",
  "Evacuation Protocol": "https://image.pollinations.ai/prompt/Gridlocked%20highway%20of%20abandoned%20cars%2C%20distant%20sirens%2C%20families%20fleeing%20on%20foot%20with%20belongings%20left%20behind%2C%20military%20blockade%20ahead%2C%20smoke%20from%20city%20skyline%2C%20sign%20reads%20TURN%20BACK.?width=640&height=360&seed=806456&model=flux&nologo=true",
  "Emergency Broadcast Live": "https://image.pollinations.ai/prompt/News%20anchor%20desk%20with%20two%20anchors%2C%20one%20visibly%20infected%2C%20the%20other%20realizing%20on%20live%20camera%2C%20panicked%20breaking%20news%20ticker%2C%20crew%20fleeing%20in%20background.?width=640&height=360&seed=895266&model=flux&nologo=true",
  "Containment Collapse": "https://image.pollinations.ai/prompt/Research%20facility%20perimeter%20fence%20torn%20open%20from%20inside%2C%20overturned%20military%20vehicles%2C%20hazmat%20soldiers%20running%2C%20massive%20hole%20in%20facility%20wall%2C%20warning%20sirens%20and%20red%20emergency%20lights.?width=640&height=360&seed=152938&model=flux&nologo=true",
  "Last Stand Barricade": "https://image.pollinations.ai/prompt/Fortified%20convenience%20store%20at%20night%20with%20boarded%20windows%2C%20survivors%20visible%20through%20gaps%20with%20weapons%2C%20huge%20infected%20horde%20pressing%20outside%2C%20flickering%20OPEN%20sign%2C%20supplies%20running%20low.?width=640&height=360&seed=189379&model=flux&nologo=true",
};

function hashStringToIndex(str, modulo) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % modulo;
}

/** Map curly/smart apostrophes to ASCII so DB/API strings match prompt URL keys. */
function normalizeHorrorNameKey(name) {
  return String(name || "")
    .trim()
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035\u02BC]/g, "'");
}

/** Escape & and " so Pollinations query strings stay intact inside double-quoted HTML attributes. */
function htmlAttrEscapeUrl(url) {
  return String(url || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
}

/** Fixed Pollinations URLs for known attraction/event names (exact or case-insensitive match). */
function resolveFixedHorrorImageUrl(name) {
  const key = normalizeHorrorNameKey(name);
  if (!key) return null;
  if (HORROR_IMAGE_URL_BY_NAME[key]) return HORROR_IMAGE_URL_BY_NAME[key];
  const lower = key.toLowerCase();
  for (const k of Object.keys(HORROR_IMAGE_URL_BY_NAME)) {
    if (k.toLowerCase() === lower) return HORROR_IMAGE_URL_BY_NAME[k];
  }
  return null;
}

function cardImageUrl(name) {
  const key = normalizeHorrorNameKey(name);
  const fixed = resolveFixedHorrorImageUrl(key);
  if (fixed) return fixed;
  const prompt = HORROR_IMAGE_PROMPTS_BY_NAME[key] || `${key}, horror theme park attraction poster, cinematic dark style`;
  const seed = hashStringToIndex(key || "default", 999999) + 1;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=640&height=360&seed=${seed}&model=flux&nologo=true`;
}

function dedupeAttractions(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows || []) {
    const key = String(row.AttractionName || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function dedupeEvents(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows || []) {
    const key = String(row.EventName || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function preloadAttractionImages(attractions) {
  for (const a of dedupeAttractions(attractions)) {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.src = cardImageUrl(a.AttractionName);
  }
}

function preloadEventImages(events) {
  for (const e of dedupeEvents(events)) {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.src = cardImageUrl(e.EventName);
  }
}

function injectImagePreloadLinks(urls) {
  const head = document.head || document.getElementsByTagName("head")[0];
  if (!head) return;
  for (const href of urls) {
    if (!href) continue;
    const already = Array.from(head.querySelectorAll('link[rel="preload"][as="image"]')).some(
      (el) => el.getAttribute("href") === href
    );
    if (already) continue;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = href;
    head.appendChild(link);
  }
}

function preloadAttractionAndEventLinks(attractions, events) {
  const attractionUrls = dedupeAttractions(attractions).map((a) => cardImageUrl(a.AttractionName));
  const eventUrls = dedupeEvents(events).map((e) => cardImageUrl(e.EventName));
  injectImagePreloadLinks([...attractionUrls, ...eventUrls]);
}

function fallbackImageUrl(name, width, height) {
  const fixed = resolveFixedHorrorImageUrl(name);
  if (fixed) return fixed;
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
        src="${htmlAttrEscapeUrl(src)}"
        data-fallback-src="${htmlAttrEscapeUrl(fallback)}"
        alt="${alt}"
        referrerpolicy="no-referrer"
        loading="eager"
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

  const MERCH_DISPLAY_MAX = 40;
  const displayRows = rows.slice(0, MERCH_DISPLAY_MAX);
  const capEl = $("merchCapNotice");
  if (capEl) {
    if (rows.length > MERCH_DISPLAY_MAX) {
      capEl.textContent = `${rows.length} items match your filters; showing the first ${MERCH_DISPLAY_MAX}. Narrow your search or filters to see other items.`;
      capEl.classList.remove("hidden");
    } else {
      capEl.textContent = "";
      capEl.classList.add("hidden");
    }
  }

  const uniqueShops = new Set(displayRows.map((m) => String(m.RetailName || "Unknown")));
  const prices = displayRows.map((m) => Number(m.DiscountPrice || m.SellPrice || 0));
  const lowest = prices.length ? Math.min(...prices) : 0;
  const highest = prices.length ? Math.max(...prices) : 0;
  $("merchTotalItems").textContent = String(displayRows.length);
  $("merchTotalShops").textContent = String(uniqueShops.size);
  $("merchLowestPrice").textContent = `$${lowest.toFixed(2)}`;
  $("merchHighestPrice").textContent = `$${highest.toFixed(2)}`;

  $("merchCards").innerHTML = displayRows
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
  const [areas, parks, attractions, events, dining, merchandise] = await Promise.all([
    api("/api/areas", { token }),
    api("/api/parks", { token }),
    api("/api/attractions", { token }),
    api("/api/events", { token }),
    api("/api/dining", { token }),
    api("/api/merchandise", { token }),
  ]);
  state.areas = areas;
  state.parks = parks;
  state.attractions = attractions;
  state.events = events;
  state.dining = dining;
  state.merchandise = merchandise;

  fillSelect("itineraryAttraction", attractions, "AttractionID", "AttractionName", true);
  fillSelect("itineraryPark", parks, "ParkID", "ParkName", true);
  fillSelect("reservationAttraction", attractions, "AttractionID", "AttractionName", true);
  fillSelect("reservationDining", dining, "DiningID", "DiningName", true);
  fillSelect("feedbackAttraction", attractions, "AttractionID", "AttractionName", true);
  fillSelect("diningOrderDining", dining, "DiningID", "DiningName", false);
  fillSelect("merchOrderItem", merchandise, "ItemID", "ItemName", false);
  preloadAttractionAndEventLinks(attractions, events);
  preloadAttractionImages(attractions);
  preloadEventImages(events);

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
  state.visitorEmail = me.Email || "";
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
  const uniqueRows = dedupeAttractions(rows);
  $("attractionsGrid").innerHTML = uniqueRows
    .map(
      (a) => `<article class="attraction-card" tabindex="0">
      <div class="image-frame" style="width:100%; height:200px;">
        <div class="image-skeleton"></div>
        <img
          class="generated-art attraction-image"
          src="${htmlAttrEscapeUrl(cardImageUrl(a.AttractionName))}"
          data-fallback-src="${htmlAttrEscapeUrl(fallbackImageUrl(a.AttractionName, 640, 360))}"
          alt="${a.AttractionName}"
          referrerpolicy="no-referrer"
          loading="eager"
          decoding="async"
          style="width:100%; height:200px; object-fit:cover;"
        />
      </div>
      <div class="attraction-name">${a.AttractionName}</div>
      <div class="attraction-overlay">
        <p><strong>Height:</strong> ${a.HeightRequirementCm || "-"} cm</p>
        <p><strong>Duration:</strong> ${a.DurationMinutes || "-"} mins</p>
        <p><strong>Thrill:</strong> ${a.ThrillLevel || "Medium"}</p>
        <p><strong>Status:</strong> ${a.Status || "Unknown"}</p>
        <p><strong>Wait:</strong> ${a.WaitTimeMinutes || 0} min</p>
      </div>
    </article>`
    )
    .join("");
  wireGeneratedImages($("attractionsGrid"));
}

async function renderParksAndEvents() {
  const events = await api("/api/events", { token: getToken() });
  state.events = events;
  const uniqueEvents = dedupeEvents(events);
  preloadEventImages(uniqueEvents);
  $("eventsGrid").innerHTML = uniqueEvents
    .map(
      (e) => `<article class="event-card" tabindex="0">
      <div class="image-frame" style="width:100%; height:200px;">
        <div class="image-skeleton"></div>
        <img
          class="generated-art event-image"
          src="${htmlAttrEscapeUrl(cardImageUrl(e.EventName))}"
          data-fallback-src="${htmlAttrEscapeUrl(fallbackImageUrl(e.EventName, 640, 360))}"
          alt="${e.EventName}"
          referrerpolicy="no-referrer"
          loading="eager"
          decoding="async"
          style="width:100%; height:200px; object-fit:cover;"
        />
      </div>
      <div class="event-name">${e.EventName}</div>
      <div class="event-overlay">
        <p><strong>Date:</strong> ${e.EventDate || "-"}</p>
        <p><strong>Time:</strong> ${(e.StartTime || "-")}${e.EndTime ? ` - ${e.EndTime}` : ""}</p>
        <p><strong>Park:</strong> ${e.ParkName || "-"}</p>
        <p><strong>Details:</strong> ${e.EventDescription || "-"}</p>
      </div>
    </article>`
    )
    .join("");
  wireGeneratedImages($("eventsGrid"));
}

async function renderReservations() {
  const tbody = $("reservationsTbody");
  if (!tbody) return;
  const rows = await api("/api/reservations", { token: getToken() });
  tbody.innerHTML = rows
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
  const line = (i) => {
    const place = escapeHtml(i.AttractionName || i.ParkName || "-");
    const when = i.PlannedDate ? ` on ${escapeHtml(String(i.PlannedDate))}` : "";
    return `<li>${place}${when} <button class="btn small" type="button" data-del-itin="${i.ItineraryID}">Delete</button></li>`;
  };
  const itinerary = rows.filter((i) => String(i.ItemType) === "Itinerary");
  const wishlist = rows.filter((i) => String(i.ItemType) !== "Itinerary");
  const emptyLi = `<li class="hint" style="list-style:none;padding-left:0;">No items yet.</li>`;
  const itinEl = $("itineraryListItinerary");
  const wishEl = $("itineraryListWishlist");
  if (itinEl) itinEl.innerHTML = itinerary.length ? itinerary.map(line).join("") : emptyLi;
  if (wishEl) wishEl.innerHTML = wishlist.length ? wishlist.map(line).join("") : emptyLi;
}

async function renderDiningAndMerch() {
  const [dining, merch] = await Promise.all([api("/api/dining", { token: getToken() }), api("/api/merchandise", { token: getToken() })]);
  state.dining = dining;
  state.merchandise = merch;
  renderDiningList();
  renderMerchList();
}

async function renderOrders() {
  const oip = $("orderItemsPanel");
  if (oip) oip.classList.add("hidden");
  const oid = $("orderItemsDisplay");
  if (oid) oid.innerHTML = "";
  const rows = await api("/api/orders", { token: getToken() });
  $("ordersTbody").innerHTML = rows
    .map(
      (o) =>
        `<tr><td>${o.OrderID}</td><td>${o.OrderType}</td><td>${Number(o.OrderTotal).toFixed(2)}</td><td>${o.PaymentStatus}</td><td><button class="btn small" type="button" data-order-items="${o.OrderID}">View Items</button></td></tr>`
    )
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

  $("paymentConfirmModalClose")?.addEventListener("click", hidePaymentConfirmModal);
  $("paymentConfirmModalBackdrop")?.addEventListener("click", hidePaymentConfirmModal);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const m = $("paymentConfirmModal");
    if (m && !m.classList.contains("hidden")) hidePaymentConfirmModal();
  });

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

  $("ticketCategory").addEventListener("change", () => {
    updateTicketPricingPreview();
    syncTicketFormForPlan();
  });
  $("ticketPlan").addEventListener("change", () => {
    updateTicketPricingPreview();
    syncTicketFormForPlan();
  });
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
    const plan = $("ticketPlan").value;
    const visitDate = $("ticketVisitDate").value || null;
    const body = {
      TicketPlan: plan,
      TicketCategory: $("ticketCategory").value,
      PaymentMethod: $("ticketPaymentMethod").value || null,
    };
    if (plan !== "SeasonPass") {
      body.VisitDate = visitDate;
    }
    if (plan === "MultiDay") {
      body.MultiDayCount = Number($("ticketMultiDayCount").value || 2);
    }
    const created = await api("/api/tickets/purchase", {
      method: "POST",
      token: getToken(),
      body,
    });
    showStatus("Ticket purchased.");
    e.target.reset();
    syncTicketFormForPlan();
    updateTicketPricingPreview();
    await fullRefresh();
    showPaymentConfirmModal({
      orderIds: [created.orderId],
      amount: Number(created.ticket && created.ticket.Price != null ? created.ticket.Price : 0),
      tagline: "Your ticket is issued. See you at the park!",
    });
    showOrdersAfterTransaction("Payment complete. Click View Items on your new ticket order below for details. Upcoming reservations are on the Planning tab.");
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
    await fullRefresh();
    showOrdersAfterTransaction("Your reservation is saved. Open Planning to view or cancel it.");
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

  $("tab-planning")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-del-itin]");
    if (!btn) return;
    await api(`/api/itinerary/${Number(btn.dataset.delItin)}`, { method: "DELETE", token: getToken() });
    await renderItinerary();
  });

  $("diningOrderForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const qty = Number($("diningOrderQty").value || 1);
    const unit = Number($("diningOrderUnitPrice").value);
    const res = await api("/api/orders/dining", {
      method: "POST",
      token: getToken(),
      body: {
        DiningID: Number($("diningOrderDining").value),
        Quantity: qty,
        UnitPrice: unit,
        PaymentMethod: $("diningPaymentMethod").value || null,
      },
    });
    await renderOrders();
    showPaymentConfirmModal({
      orderIds: [res.OrderID],
      amount: qty * unit,
    });
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
    const paymentMethod = $("diningPaymentMethod").value || "Credit card";
    const fallbackDiningId = Number($("diningOrderDining").value || 0);
    if (!fallbackDiningId) {
      showStatus("Select a dining option before checkout.", true);
      return;
    }
    const diningOrderIds = [];
    let diningTotal = 0;
    for (const item of state.diningCart) {
      const res = await api("/api/orders/dining", {
        method: "POST",
        token: getToken(),
        body: {
          DiningID: fallbackDiningId,
          Quantity: Number(item.qty),
          UnitPrice: Number(item.price),
          PaymentMethod: paymentMethod,
        },
      });
      diningOrderIds.push(res.OrderID);
      diningTotal += Number(item.price) * Number(item.qty);
    }
    state.diningCart = [];
    renderDiningCart();
    await renderOrders();
    showStatus("Dining cart checkout complete.");
    showPaymentConfirmModal({ orderIds: diningOrderIds, amount: diningTotal });
  });

  $("merchOrderForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const itemId = Number($("merchOrderItem").value);
    const qty = Number($("merchOrderQty").value || 1);
    const m = state.merchandise.find((x) => Number(x.ItemID) === itemId);
    const unit = m ? Number(m.DiscountPrice || m.SellPrice || 0) : 0;
    const res = await api("/api/orders/merchandise", {
      method: "POST",
      token: getToken(),
      body: {
        ItemID: itemId,
        Quantity: qty,
        PaymentMethod: $("merchPaymentMethod").value || null,
      },
    });
    await renderOrders();
    showPaymentConfirmModal({
      orderIds: [res.OrderID],
      amount: unit * qty,
    });
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
    const paymentMethod = $("merchPaymentMethod").value || "Credit card";

    const merchOrderIds = [];
    let merchTotal = 0;
    for (const item of state.merchCart) {
      const res = await api("/api/orders/merchandise", {
        method: "POST",
        token: getToken(),
        body: {
          ItemID: Number(item.itemId),
          Quantity: Number(item.qty),
          PaymentMethod: paymentMethod,
        },
      });
      merchOrderIds.push(res.OrderID);
      merchTotal += Number(item.price) * Number(item.qty);
    }

    state.merchCart = [];
    renderMerchCart();
    await renderOrders();
    showStatus("Merch cart checkout complete.");
    showPaymentConfirmModal({ orderIds: merchOrderIds, amount: merchTotal });
  });

  $("ordersTbody").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-order-items]");
    if (!btn) return;
    const orderId = Number(btn.dataset.orderItems);
    const rows = await api(`/api/orders/${orderId}/items`, { token: getToken() });

    let ticketsByNumber = {};
    if (rows.some((r) => String(r.ItemType) === "Ticket")) {
      const tickets = await api("/api/tickets", { token: getToken() });
      ticketsByNumber = Object.fromEntries(tickets.map((t) => [Number(t.TicketNumber), t]));
    }

    const display = $("orderItemsDisplay");
    const panel = $("orderItemsPanel");
    if (display && panel) {
      display.innerHTML = rows.length
        ? formatOrderItemsDisplayHtml(rows, ticketsByNumber)
        : `<p class="hint" style="margin:0;">No line items for this order.</p>`;
      panel.classList.remove("hidden");
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
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
    syncTicketFormForPlan();
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
syncTicketFormForPlan();
setDiningShopView("dining");
setParkContentView("attractions");
renderMerchCart();
renderDiningCart();

// Pre-warm known attraction and event images immediately on page load.
const KNOWN_ATTRACTION_NAMES = Object.keys(HORROR_IMAGE_PROMPTS_BY_NAME);
KNOWN_ATTRACTION_NAMES.forEach((name) => {
  const img = new Image();
  img.referrerPolicy = "no-referrer";
  img.src = cardImageUrl(name);
});

bootApp();

