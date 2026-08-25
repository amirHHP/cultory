import { db, uid, sha256 } from "./db.js";
import bcrypt from "bcryptjs";

export function seed(force = false): void {
// deterministic PRNG so demo data is stable
let s = 42;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

if (!force && (db.prepare(`SELECT COUNT(*) c FROM users`).get() as any).c > 0) return;

const wipe = ["transactions", "bookings", "itinerary_stops", "itineraries", "stories", "api_keys", "interview_sessions", "users", "municipalities"];
for (const t of wipe) db.exec(`DELETE FROM ${t}`);

const pw = bcrypt.hashSync("cultory123", 10);

// ---------- Municipalities ----------
const muns = [
  { id: "mun_seed_metsovo", name: "Metsovo", country: "Greece", region: "Epirus", lat: 39.7667, lng: 21.1797 },
  { id: "mun_seed_obidos", name: "Óbidos", country: "Portugal", region: "Centro", lat: 39.3611, lng: -9.1578 },
  { id: "mun_seed_bosa", name: "Bosa", country: "Italy", region: "Sardinia", lat: 40.2997, lng: 8.4975 },
  { id: "mun_seed_holloko", name: "Hollókő", country: "Hungary", region: "Nógrád", lat: 48.0167, lng: 19.9333 },
];
for (const m of muns)
  db.prepare(`INSERT INTO municipalities (id, name, country, region, plan_tier, plan_price_cents, package_status, lat, lng)
              VALUES (?, ?, ?, ?, 'premium', 2500000, 'active', ?, ?)`)
    .run(m.id, m.name, m.country, m.region, m.lat, m.lng);

// ---------- Users ----------
const users: [string, string, string, string, string | null][] = [
  ["usr_admin", "admin@cultory.eu", "Aurora Papadaki", "super_admin", null],
  ["usr_mun_mets", "metsovo@cultory.eu", "Kostas Zikos", "municipality", "mun_seed_metsovo"],
  ["usr_mun_obid", "obidos@cultory.eu", "Inês Carvalho", "municipality", "mun_seed_obidos"],
  ["usr_ent_ota", "partners@getyourguide.example", "Jonas Weber", "enterprise", null],
  ["usr_ent_hotel", "digital@marriott-lisbon.example", "Sofia Ramos", "enterprise", null],
  ["usr_guide_elena", "elena@cultory.eu", "Eleni Vasiliou", "guide", "mun_seed_metsovo"],
  ["usr_guide_nikos", "nikos@cultory.eu", "Nikos Kastritis", "guide", "mun_seed_metsovo"],
  ["usr_guide_joao", "joao@cultory.eu", "João Almeida", "guide", "mun_seed_obidos"],
  ["usr_elder_maria", "maria@elders.cultory.eu", "Maria Douska", "elder", "mun_seed_metsovo"],
  ["usr_elder_giorgo", "giorgos@elders.cultory.eu", "Giorgos Lappas", "elder", "mun_seed_metsovo"],
];
for (const [id, email, name, role, mun] of users)
  db.prepare(`INSERT INTO users (id, email, password_hash, name, role, municipality_id) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, email, pw, name, role, mun);

// ---------- Stories ----------
type StorySeed = { mun: string; contributor: string; title: string; category: string; place: string; lat: number; lng: number; lang: string; text: string; en: string };
const stories: StorySeed[] = [
  { mun: "mun_seed_metsovo", contributor: "usr_elder_maria", title: "The Bell That Rang Itself", category: "folklore", place: "Agios Nikolaos Chapel", lat: 39.7671, lng: 20.9672, lang: "el",
    text: "Τα Χριστούγεννα του '54, η καμπάνα του Αγίου Νικολάου χτύπησε μόνη της τρεις φορές. Οι γέροντες λένε ότι ήταν για τα χιόνια που έσωσαν τη σοδειά.", en: "At Christmas 1954 the bell of St Nicholas rang three times by itself. The elders said it was for the snows that saved the harvest." },
  { mun: "mun_seed_metsovo", contributor: "usr_elder_giorgo", title: "Weaving the Metsovo Mantle", category: "crafts_music", place: "Tositsa Weaver's House", lat: 39.7643, lng: 21.1812, lang: "el",
    text: "Η μάνα μου ύφαινε το μανδύα με μαλλί από τα κοπάδια των Βλάχων. Τραγουδούσε όλο το δείλι — κάθε μοτίβο είχε το τραγούδι του.", en: "My mother wove the Vlach mantle from mountain wool, singing all dusk long — every pattern had its own song." },
  { mun: "mun_seed_metsovo", contributor: "usr_elder_maria", title: "Batzina Pie of the Shepherds", category: "cuisine", place: "Vlach Village Ovens", lat: 39.7712, lng: 21.1755, lang: "el",
    text: "Η μπατζίνα φτιάχνεται με καλαμποκάλευρο και τυρί. Οι βοσκοί την έπαιρναν στο βουνό για σαράντα μέρες.", en: "Batzina is cornbread and cheese baked thick. Shepherds carried it up the mountain for forty days at a time." },
  { mun: "mun_seed_obidos", contributor: "usr_guide_joao", title: "Ginjinha Vows at Porta da Vila", category: "rituals", place: "Porta da Vila", lat: 39.3622, lng: -9.1567, lang: "pt",
    text: "Diz-se que quem bebe ginja na muralha com a pessoa amada volta sempre a Óbidos. A tradição é mais velha do que a vila mesma, dizem os antigos.", en: "They say whoever drinks ginja on the ramparts with their beloved will always return to Óbidos. The tradition is older than the village walls themselves." },
  { mun: "mun_seed_obidos", contributor: "usr_guide_joao", title: "The Medieval Market Bells", category: "oral_history", place: "Praça de Santa Maria", lat: 39.3605, lng: -9.1571, lang: "pt",
    text: "Antes dos relógios, os sinos marcavam o mercado. Meio-dia era quando os mercadores de Caldas abriam as arcas de sal.", en: "Before clocks, bells marked the market. Noon was when salt merchants from Caldas opened their chests." },
  { mun: "mun_seed_bosa", contributor: "usr_guide_nikos", title: "Malvasia Wine and the Castle", category: "cuisine", place: "Castello Malaspina", lat: 40.2990, lng: 8.5000, lang: "it",
    text: "La Malvasia di Bosa arrivava nelle navi verso la Spagna. I bottai dicevano che il vino 'respirava il fiume' durante il viaggio.", en: "Bosa's Malvasia sailed in casks toward Spain. Coopers swore the wine 'breathed the river' during the voyage." },
  { mun: "mun_seed_bosa", contributor: "usr_guide_nikos", title: "Fishing Songs of the Temo", category: "crafts_music", place: "Fiume Temo Banks", lat: 40.3012, lng: 8.4940, lang: "it",
    text: "I pescatori cantavano a turno: uno faceva la voce del fiume, gli altri rispondevano. Si sentiva da piazza fino al ponte vecchio.", en: "Fishermen sang in turns — one led with the river's voice, others answered. You could hear it from the square to the old bridge." },
  { mun: "mun_seed_holloko", contributor: "usr_elder_maria", title: "Palóc Wedding Procession", category: "rituals", place: "Village Main Street", lat: 47.9950, lng: 19.9410, lang: "hu",
    text: "A menyasszonyt háromszor körbevitték a falun. Aki látta, egy darab kalácsot kapott — így nem maradt éhes senki.", en: "The bride was paraded three times around the village. Whoever saw her received a piece of sweet bread — no one went hungry that day." },
  { mun: "mun_seed_holloko", contributor: "usr_guide_nikos", title: "Charcoal Burners' Whisper Pines", category: "nature_wisdom", place: "Cserhát Pine Forest", lat: 48.0100, lng: 19.9520, lang: "hu",
    text: "Az égetők tudták, hogy a fenyő 'suttog', amikor vihar jön. Három napig nem gyújtottak tüzet, ha a fák beszéltek.", en: "Charcoal burners knew pines 'whisper' before storms. If the trees spoke, no fire was lit for three days." },
  { mun: "mun_seed_metsovo", contributor: "usr_elder_giorgo", title: "Snow Roads to Ioannina", category: "oral_history", place: "Katara Pass", lat: 39.7550, lng: 21.1200, lang: "el",
    text: "Πριν τον δρόμο, μες στον χειμώνα περνούσαν το Καταρα με μουλάρια. Ο καθένας φορούσε δύο κάπες και κρατούσε ψωμί στη μέση.", en: "Before the highway, mule trains crossed Katara Pass all winter. Each man wore two capes and kept his bread against his chest." },
  { mun: "mun_seed_obidos", contributor: "usr_guide_joao", title: "Lagoon Salt, Church Silver", category: "nature_wisdom", place: "Lagoa de Óbidos Shore", lat: 39.4050, lng: -9.2100, lang: "pt",
    text: "O sal da lagoa pagava os altares. Quando a maré estava boa, tocavam os sinos duas vezes — uma pelo sal, outra pela chuva que não veio.", en: "Lagoon salt paid for church altars. When the tide was generous, bells rang twice — once for the salt, once for rain that never came." },
  { mun: "mun_seed_bosa", contributor: "usr_elder_maria", title: "Stonemasons' Secret Marks", category: "crafts_music", place: "Sa Costa Quarter", lat: 40.2985, lng: 8.4960, lang: "it",
    text: "Ogni mastro lasciava un segreto inciso nella pietra d'angolo. Ancora oggi si possono contare quarantadue segni diversi.", en: "Every master mason left a secret mark in the cornerstones. Even today you can count forty-two different signs." },
];

const insertStory = db.prepare(
  `INSERT INTO stories (id, municipality_id, contributor_id, title, transcript, translation_en, category, language, place_name, lat, lng, duration_sec, source, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'interview', ?)`
);
const storyIds: string[] = [];
stories.forEach((st, i) => {
  const id = uid("sto");
  storyIds.push(id);
  const daysAgo = 30 + i * 26;
  const created = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 19).replace("T", " ");
  insertStory.run(id, st.mun, st.contributor, st.title, st.text, st.en, st.category, st.lang, st.place, st.lat, st.lng, 60 + Math.floor(rnd() * 240), created);
});

// ---------- Itineraries ----------
const tours = [
  { id: "itr_mets_bells", mun: "mun_seed_metsovo", guide: "usr_guide_elena", title: "Bells, Wool & Mountain Songs", desc: "Walk Metsovo's stone lanes with certified guide Eleni and hear the Vlach songs woven into its walls.", price: 2900, min: 150, diff: "easy", emoji: "🔔", stops: [storyIds[1], storyIds[2], storyIds[0], storyIds[9]] },
  { id: "itr_mets_shepherds", mun: "mun_seed_metsovo", guide: "usr_guide_nikos", title: "Shepherd Trails of the Katara Pass", desc: "Follow ancient mule routes above the clouds with stories from the last shepherds of Epirus.", price: 4500, min: 240, diff: "challenging", emoji: "🐑", stops: [storyIds[9], storyIds[2]] },
  { id: "itr_obido_walls", mun: "mun_seed_obidos", guide: "usr_guide_joao", title: "Óbidos by Lamplight & Ginja", desc: "Sunset walk along medieval ramparts ending with a ginjinha toast at Porta da Vila.", price: 3500, min: 120, diff: "easy", emoji: "🏰", stops: [storyIds[3], storyIds[4], storyIds[10]] },
  { id: "itr_bosa_river", mun: "mun_seed_bosa", guide: "usr_guide_nikos", title: "Malvasia & the River Temo", desc: "From castle cellars to fishermen's banks — taste, listen and sail through Bosa's memory.", price: 4200, min: 180, diff: "moderate", emoji: "🍷", stops: [storyIds[5], storyIds[6], storyIds[11]] },
  { id: "itr_hollo_paloc", mun: "mun_seed_holloko", guide: "usr_guide_elena", title: "Palóc Weddings & Whispering Pines", desc: "UNESCO-village folklore walk: wedding bread, secret marks and storm-reading wisdom.", price: 2600, min: 90, diff: "easy", emoji: "🌸", stops: [storyIds[7], storyIds[8]] },
];
const insertTour = db.prepare(
  `INSERT INTO itineraries (id, municipality_id, guide_id, title, description, price_cents, duration_min, difficulty, cover_emoji, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const insertStop = db.prepare(`INSERT INTO itinerary_stops (id, itinerary_id, story_id, position) VALUES (?, ?, ?, ?)`);
for (const t of tours) {
  insertTour.run(t.id, t.mun, t.guide, t.title, t.desc, t.price, t.min, t.diff, t.emoji, 4.5 + rnd() * 0.5);
  t.stops.forEach((sid, pos) => insertStop.run(uid("stp"), t.id, sid, pos + 1));
}

// ---------- Bookings + transactions over last 12 months ----------
const countries = ["DE", "FR", "GB", "NL", "US", "IT", "SE", "ES"];
const ageGroups = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const names = ["Anna Müller", "Tom Becker", "Julie Laurent", "Mark Evans", "Sanne Visser", "Luca Rossi", "Erik Larsson", "Carmen Ruiz", "Grace Hall", "Peter Novak"];
const insBooking = db.prepare(
  `INSERT INTO bookings (id, itinerary_id, tourist_name, tourist_email, tourist_country, age_group, seats, tour_date, total_cents, status, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?)`
);
const insTxn = db.prepare(
  `INSERT INTO transactions (id, booking_id, municipality_id, kind, payer, amount_cents, fee_pct, platform_fee_cents, payout_cents, status, created_at)
   VALUES (?, ?, (SELECT municipality_id FROM itineraries WHERE id=?), 'booking', ?, ?, 0.25, ?, ?, 'settled', ?)`
);
const now = new Date();
let bCount = 0;
for (let m = 11; m >= 0; m--) {
  const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
  // seasonality: peaks Jun–Sep
  const seasonal = 1 + 0.9 * Math.max(0, Math.sin(((monthDate.getMonth() - 3) / 12) * Math.PI * 2));
  const nBookings = Math.round((6 + rnd() * 6) * seasonal);
  for (let i = 0; i < nBookings; i++) {
    const tour = pick(tours);
    const day = 1 + Math.floor(rnd() * 27);
    const createdAt = new Date(monthDate.getFullYear(), monthDate.getMonth(), day, 10 + Math.floor(rnd() * 8));
    if (createdAt > now) continue;
    const seats = 1 + Math.floor(rnd() * 4);
    const total = tour.price * seats;
    const id = uid("bkg");
    const iso = createdAt.toISOString().slice(0, 19).replace("T", " ");
    insBooking.run(id, tour.id, pick(names), `tourist${bCount}@example.com`, pick(countries), pick(ageGroups), seats,
      createdAt.toISOString().slice(0, 10), total, iso);
    const fee = Math.round(total * 0.25);
    insTxn.run(uid("txn"), id, tour.id, `tourist${bCount}@example.com`, total, fee, total - fee, iso);
    bCount++;
  }
}

console.log(`Seeded: ${users.length} users, ${muns.length} municipalities, ${stories.length} stories, ${tours.length} itineraries, ${bCount} paid bookings.`);
}
