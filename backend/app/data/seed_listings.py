"""
Run inside the backend container:
  docker compose exec backend python app/data/seed_listings.py

Images are stored as 'listings/{id}/1.jpg', 'listings/{id}/2.jpg', etc.
When objectstore is enabled, the script uploads images from the local
/app/data/seed-images/ directory. When disabled, images are served from
/app/uploads/images/listings/{id}/.
"""
import sys
sys.path.insert(0, '/app')

from datetime import datetime, timezone, timedelta
from app.database import SessionLocal
from app.models.user import User
from app.models.listing import Listing, ListingCondition, ListingStatus
from app.models.message import Conversation, Message
from app.routers.auth import hash_password
from app.models.category import Category
from decimal import Decimal
import random

db = SessionLocal()

# ── Users ────────────────────────────────────────────────────────────────────
def _avatar(name: str, bg: str) -> str:
    encoded = name.replace(" ", "+")
    return f"https://ui-avatars.com/api/?name={encoded}&background={bg}&color=fff&size=128"

# (email, full_name, location, phone, whatsapp, contact_method, languages, preferred_language, avatar_url)
USERS = [
    ("john@duffeaap.com",    "John Waverly",   "Noord",          "+297 5601001", "+297 5601001", "phone,whatsapp",  "english,papiamento",          "en", _avatar("John Waverly",   "2d7ac8")),
    ("maria@duffeaap.com",   "Maria Tromp",    "Oranjestad",     "+297 5602002", "+297 5602002", "whatsapp,phone",  "papiamento,spanish,english",  "es", _avatar("Maria Tromp",    "c8102e")),
    ("tom@duffeaap.com",     "Tom Fischer",    "Palm Beach",     "+297 5603003", "+297 5603003", "phone",           "english,dutch",               "en", _avatar("Tom Fischer",    "2363a3")),
    ("alex@duffeaap.com",    "Alex Windberg",  "Westpunt",       "+297 5604004", "+297 5604004", "whatsapp",        "english,dutch,papiamento",    "en", _avatar("Alex Windberg",  "418FDE")),
    ("sandra@duffeaap.com",  "Sandra Tromp",   "Punta Brabo",    "+297 5605005", "+297 5605005", "phone",           "papiamento,english",          "en", _avatar("Sandra Tromp",   "9333aa")),
    ("lisa@duffeaap.com",    "Lisa van Dijk",  "Savaneta",       "+297 5606006", "+297 5606006", "whatsapp",        "dutch,english",               "en", _avatar("Lisa van Dijk",  "e67e22")),
    ("carlos@duffeaap.com",  "Carlos Perez",   "San Nicolas",    "+297 5607007", "+297 5607007", "phone",           "spanish,papiamento,english",  "es", _avatar("Carlos Perez",   "27ae60")),
    ("dave@duffeaap.com",    "Dave Mulder",    "Santa Cruz",     "+297 5608008", "+297 5608008", "phone,whatsapp",  "dutch,english,papiamento",    "en", _avatar("Dave Mulder",    "1b4d7e")),
    ("amy@duffeaap.com",     "Amy Johnson",    "Paradera",       "+297 5609009", "+297 5609009", "whatsapp",        "english",                     "en", _avatar("Amy Johnson",    "c0392b")),
    ("rob@duffeaap.com",     "Rob Geerman",    "Tanki Leendert", "+297 5601010", "+297 5601010", "phone,whatsapp",  "papiamento,dutch,english",    "en", _avatar("Rob Geerman",    "16a085")),
]

for email, full_name, location, phone, whatsapp, contact_method, languages, preferred_language, avatar_url in USERS:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        existing.full_name = full_name
        existing.location = location
        existing.phone = phone
        existing.whatsapp = whatsapp
        existing.contact_method = contact_method
        existing.languages = languages
        existing.preferred_language = preferred_language
        existing.avatar_url = avatar_url
    else:
        db.add(User(
            email=email,
            hashed_password=hash_password("password123"),
            full_name=full_name,
            location=location,
            phone=phone,
            whatsapp=whatsapp,
            contact_method=contact_method,
            languages=languages,
            preferred_language=preferred_language,
            avatar_url=avatar_url,
        ))
db.commit()
all_users = db.query(User).all()
u_map = {u.email: u for u in all_users}

def u(name):
    return f"{name}.jpg"

# ── Listings ─────────────────────────────────────────────────────────────────
# (title, description, category_slug, price, condition, images, seller_email, view_count_range)
LISTINGS = [

    # ── Watersports ──────────────────────────────────────────────────────────
    ("Lost Mayhem 5'10 Shortboard", "Great all-round shortboard. Minor pressure dings on deck. FCS II fins included.", "surfboards", "320", "like_new", [u("surfboard-1"), u("surfboard-2")], "john@duffeaap.com", (20, 80)),
    ("Channel Islands Al Merrick 6'2", "Classic CI shape, surfed ~30 sessions. Small nose repair. Fast and responsive.", "surfboards", "280", "good", [u("surfboard-3")], "maria@duffeaap.com", (10, 50)),
    ("Firewire Helium 6'0", "Lightweight Helium construction, super fast. Selling because I upgraded.", "surfboards", "410", "like_new", [u("surfboard-4")], "alex@duffeaap.com", (30, 90)),
    ("9'2 Noserider Longboard", "Classic heavy glasswork noserider. Perfect for small days. Single fin included.", "surfboards", "250", "good", [u("surfboard-1"), u("surfboard-3")], "tom@duffeaap.com", (5, 40)),
    ("Mini Simmons Fish 5'4 Twin Fin", "Super fun in small surf. Used one season, no repairs needed.", "surfboards", "195", "good", [u("surfboard-2"), u("surfboard-4")], "sandra@duffeaap.com", (15, 60)),
    ("5'6 Funboard – Beginner/Intermediate", "Great for learning. Soft-top deck, thruster setup. One small ding on nose.", "surfboards", "130", "fair", [u("surfboard-3")], "lisa@duffeaap.com", (5, 30)),
    ("Rip Curl Flashbomb 4/3 – Size M", "Used 2 seasons, seams still watertight. Great suit for cooler water.", "snorkeling-diving", "120", "good", [u("wetsuit-1")], "maria@duffeaap.com", (10, 45)),
    ("O'Neill Spring Suit 2mm – Size L", "Barely used, like-new condition. Excellent for tropical water sports.", "snorkeling-diving", "65", "like_new", [u("wetsuit-2")], "john@duffeaap.com", (8, 35)),
    ("Cabrinha Switchblade 12m 2022", "Powerful all-round kite with bar and lines. 2 minor patches. Ready to fly.", "kitesurfing", "650", "good", [u("kite-1"), u("kite-2")], "alex@duffeaap.com", (40, 120)),
    ("North Orbit 9m + Bar", "Fast kite for experienced riders. Full bar and lines included.", "kitesurfing", "580", "good", [u("kite-2")], "john@duffeaap.com", (25, 80)),
    ("Airush Ultra 14m", "Large kite, ideal for lighter winds. Needs one bladder. Bar included.", "kitesurfing", "420", "fair", [u("kite-1")], "rob@duffeaap.com", (10, 40)),
    ("Duotone Juice 7m + Bar", "Small kite for strong wind days. Excellent condition, used one season.", "kitesurfing", "490", "like_new", [u("kite-2"), u("kite-1")], "amy@duffeaap.com", (15, 55)),
    ("Red Paddle Co 11'3 Sport iSUP", "Inflatable SUP in great shape. Includes paddle, pump and bag.", "sup", "680", "good", [u("sup-1")], "maria@duffeaap.com", (20, 75)),
    ("Starboard Touring 12'6 Hard Board", "Hard board, fast and stable. Minor scratches on rails. Paddle not included.", "sup", "520", "good", [u("sup-2"), u("sup-1")], "tom@duffeaap.com", (12, 50)),
    ("Sevylor Tahiti 2-Person Kayak", "Inflatable kayak with 2 paddles and pump. Barely used. Great for calm water.", "kayaking", "145", "like_new", [u("kayak-1")], "sandra@duffeaap.com", (8, 30)),

    # ── Cars ─────────────────────────────────────────────────────────────────
    ("Toyota Hilux 2018 4WD", "Well-maintained pickup, full service history. 95,000 km. Bull bar and towbar included.", "unleaded-cars", "22500", "good", [u("pickup-truck")], "carlos@duffeaap.com", (50, 200), {"make": "Toyota", "model": "Hilux", "year": "2018", "mileage": "50,000 – 100,000 km", "color": "White", "transmission": "Automatic"}),
    ("Honda Jazz 2016 1.3i", "Reliable city car, low fuel consumption. 78,000 km. New tyres, AC works perfectly.", "unleaded-cars", "9800", "good", [u("hatchback")], "dave@duffeaap.com", (30, 110), {"make": "Honda", "model": "Jazz 1.3i", "year": "2016", "mileage": "50,000 – 100,000 km", "color": "Silver", "transmission": "Automatic"}),
    ("Ford Ranger 2020 XLT", "Low-mileage Ranger, barely used. Tow package included. One owner.", "unleaded-cars", "28000", "like_new", [u("pickup-truck"), u("car-interior")], "rob@duffeaap.com", (60, 180), {"make": "Ford", "model": "Ranger XLT", "year": "2020", "mileage": "10,000 – 50,000 km", "color": "Grey", "transmission": "Automatic"}),
    ("Suzuki Jimny 2019", "Fun off-roader, great for island life. Very low mileage. Full service history.", "unleaded-cars", "19500", "like_new", [u("suv")], "carlos@duffeaap.com", (45, 160), {"make": "Suzuki", "model": "Jimny", "year": "2019", "mileage": "10,000 – 50,000 km", "color": "Green", "transmission": "Manual"}),
    ("Volkswagen Golf 2017 1.4 TSI", "Euro import, well maintained. 68,000 km. Sunroof, climate control.", "unleaded-cars", "14500", "good", [u("hatchback"), u("car-interior")], "dave@duffeaap.com", (25, 90), {"make": "Volkswagen", "model": "Golf 1.4 TSI", "year": "2017", "mileage": "50,000 – 100,000 km", "color": "Blue", "transmission": "Automatic"}),
    ("Kia Picanto 2020 – LOW KM", "City car, only 22,000 km. Single owner. Excellent AC. Ideal first car.", "unleaded-cars", "11200", "like_new", [u("city-car")], "lisa@duffeaap.com", (20, 70), {"make": "Kia", "model": "Picanto", "year": "2020", "mileage": "10,000 – 50,000 km", "color": "Red", "transmission": "Automatic"}),
    ("Tesla Model 3 Standard Range", "Electric sedan, 2021. 45,000 km. Autopilot included. Charging cable.", "electric-cars", "32000", "good", [u("tesla"), u("car-interior")], "rob@duffeaap.com", (55, 190), {"make": "Other", "model": "Model 3 Standard Range", "year": "2021", "mileage": "10,000 – 50,000 km", "color": "White", "transmission": "Automatic"}),

    # ── Motorcycles ──────────────────────────────────────────────────────────
    ("Honda CB500F 2020", "Naked bike, great condition. 15,000 km. Full Honda service history. ABS.", "naked-bikes", "5800", "good", [u("motorcycle-naked")], "carlos@duffeaap.com", (20, 75)),
    ("Yamaha NMAX 125 2021", "Scooter, perfect for island commuting. 8,000 km. One small scratch on fairing.", "scooters", "2900", "good", [u("scooter")], "amy@duffeaap.com", (15, 55)),
    ("Kawasaki Z400 2022", "Sportbike in mint condition. 5,500 km. Akrapovic exhaust. Always garaged.", "sportbikes", "6900", "like_new", [u("motorcycle-sport")], "rob@duffeaap.com", (30, 100)),
    ("Honda Ruckus 2019 – Customised", "Custom Ruckus, lowered and wide wheels. Great island cruiser.", "scooters", "2200", "good", [u("scooter"), u("motorcycle-naked")], "john@duffeaap.com", (12, 48)),

    # ── Furniture ────────────────────────────────────────────────────────────
    ("IKEA MALM King Bed + Mattress", "White king bed frame with storage drawers. Mattress 3 years old, good condition.", "beds", "180", "good", [u("bed")], "sandra@duffeaap.com", (10, 40)),
    ("Solid Oak Dining Table 180cm + 6 Chairs", "Beautiful solid oak dining set. Table has minor scratches. Chairs excellent.", "tables", "450", "good", [u("dining-table")], "dave@duffeaap.com", (15, 55)),
    ("IKEA KALLAX 2×4 Shelving", "White shelving unit. Small chip on one corner. Perfect for books or vinyl records.", "storage", "45", "good", [u("shelving")], "john@duffeaap.com", (5, 25)),
    ("3-Seater Leather Sofa – Dark Brown", "Italian leather, minor armrest wear. Very comfortable.", "sofas", "290", "good", [u("sofa")], "maria@duffeaap.com", (12, 48)),
    ("Electric Standing Desk 160×80", "Height-adjustable electric desk. Two height presets. Very good condition.", "tables", "380", "like_new", [u("standing-desk"), u("office-chair")], "amy@duffeaap.com", (18, 65)),
    ("IKEA PAX Wardrobe 200×236cm", "Large wardrobe with sliding doors and interior shelves. Disassembled, ready to pick up.", "storage", "140", "good", [u("wardrobe")], "carlos@duffeaap.com", (6, 30)),
    ("Herman Miller Aeron Chair – Size B", "Genuine Aeron. Minor armrest wear. Excellent lumbar support.", "furniture-other", "480", "good", [u("office-chair")], "rob@duffeaap.com", (22, 80)),
    ("Rattan Garden Sofa Set 4-piece", "Outdoor rattan sofa, 2 chairs and coffee table. Some UV fading but structurally solid.", "garden-furniture", "320", "fair", [u("garden-furniture")], "lisa@duffeaap.com", (8, 35)),
    ("Teak Garden Set 200cm + 8 Chairs", "Solid teak set, weathered to silver grey. Structurally excellent. No cushions.", "garden-furniture", "580", "good", [u("garden-furniture"), u("garden-plants")], "maria@duffeaap.com", (15, 55)),

    # ── Clothing ─────────────────────────────────────────────────────────────
    ("Patagonia Fleece Jacket – Size L", "Classic fleece, barely worn. Forge grey. Size large.", "mens-jackets", "65", "like_new", [u("jacket")], "dave@duffeaap.com", (8, 30)),
    ("Levi's 501 Jeans W32 L34 – 3 pairs", "Three pairs of classic 501s in blue and black. Light wear.", "mens-jeans", "55", "good", [u("jeans")], "john@duffeaap.com", (5, 20)),
    ("Nike Air Max 90 – EU Size 43", "Classic colourway, worn 5 times. Box included.", "mens-shoes", "85", "like_new", [u("sneakers")], "lisa@duffeaap.com", (12, 45)),
    ("Zara Summer Dresses – Size S (×5)", "5 summer dresses from Zara, size small. All in excellent condition.", "dresses-skirts", "40", "like_new", [u("summer-dress")], "sandra@duffeaap.com", (7, 28)),
    ("Tommy Hilfiger Polo Shirts Size M – 4×", "Four polo shirts in blue, white, navy and red. Worn a few times each.", "mens-shirts", "48", "good", [u("polo-shirt")], "amy@duffeaap.com", (4, 18)),
    ("Adidas Ultraboost 22 – EU Size 41", "Running shoe, used ~100km. Still great cushioning. Original box.", "mens-shoes", "70", "good", [u("running-shoes")], "carlos@duffeaap.com", (9, 35)),
    ("Guess Handbag – Beige", "Barely used. No scratches or marks. Dust bag included.", "handbags", "75", "like_new", [u("handbag")], "maria@duffeaap.com", (11, 42)),
    ("Michael Kors Watch – Gold/White", "Women's watch, quartz movement. Original box and receipt.", "watches", "145", "like_new", [u("watch")], "amy@duffeaap.com", (14, 52)),

    # ── Electronics ──────────────────────────────────────────────────────────
    ("Apple iPhone 14 Pro 256GB – Space Black", "Excellent condition. Always in case with screen protector. Battery at 91%.", "mobile-phones", "820", "like_new", [u("iphone")], "rob@duffeaap.com", (35, 130), {"brand": "Apple", "model": "iPhone 14 Pro", "storage": "256GB", "color": "Space Black"}),
    ("Samsung Galaxy S22 128GB", "Good working condition. Minor scratches on back glass. Unlocked.", "mobile-phones", "450", "good", [u("android-phone")], "dave@duffeaap.com", (20, 75), {"brand": "Samsung", "model": "Galaxy S22", "storage": "128GB", "color": "Phantom Black"}),
    ("Sony PlayStation 5 + 2 Controllers", "Disc edition, barely played. Comes with 3 games. All cables and box included.", "playstation", "520", "like_new", [u("playstation")], "lisa@duffeaap.com", (40, 150)),
    ("MacBook Air M2 13\" 8GB/256GB", "2022 model, perfect condition. Midnight colour. Charger included.", "laptops", "1050", "like_new", [u("macbook")], "amy@duffeaap.com", (50, 180), {"brand": "Apple", "model": "MacBook Air M2 13\"", "ram": "8GB", "storage": "256GB SSD"}),
    ("Bose QuietComfort 45 Headphones", "Noise-cancelling headphones in excellent condition. Case and cables included.", "portable-audio", "220", "like_new", [u("headphones")], "sandra@duffeaap.com", (15, 60)),
    ("iPad Air 5th Gen 64GB WiFi", "Barely used. Smart Folio case included. Perfect for kids or travel.", "tablets", "480", "like_new", [u("ipad")], "john@duffeaap.com", (25, 90), {"brand": "Apple", "model": "iPad Air 5th Gen", "storage": "64GB", "color": "Starlight"}),
    ("Samsung 55\" 4K QLED TV 2022", "Excellent picture quality. Wall bracket included. Remote and original box.", "televisions", "650", "like_new", [u("tv")], "alex@duffeaap.com", (30, 110), {"brand": "Samsung", "model": "QN55Q80B", "size": "55\""}),
    ("DJI Mini 3 Pro Drone + Extra Battery", "Drone with 3 batteries and ND filter set. Under 50 flights. Excellent condition.", "drones", "680", "like_new", [u("drone")], "rob@duffeaap.com", (40, 140)),
    ("Canon EOS 90D + 18-55mm Lens", "Semi-pro DSLR, low shutter count (~8,000). Kit lens, strap and bag included.", "cameras", "820", "like_new", [u("camera-dslr")], "dave@duffeaap.com", (25, 90)),
    ("Nintendo Switch OLED + 5 Games", "White OLED model. Includes Mario Kart, Zelda, Splatoon 3 and more.", "nintendo", "380", "like_new", [u("nintendo-switch")], "carlos@duffeaap.com", (28, 95)),

    # ── Garden & Tools ────────────────────────────────────────────────────────
    ("Weber Master-Touch BBQ 57cm", "Classic Weber kettle BBQ. Used 2 seasons, cleaned and ready. Cover included.", "bbq", "120", "good", [u("bbq-grill")], "alex@duffeaap.com", (8, 35)),
    ("Makita Electric Lawnmower 36cm", "Works perfectly. Grass collector included. Small scratch on housing.", "garden-tools", "75", "good", [u("lawnmower")], "dave@duffeaap.com", (6, 25)),
    ("Terracotta Plant Pots ×20", "Assorted sizes 10–40 cm. Some chips. Ideal for indoor/outdoor plants.", "plant-pots", "35", "fair", [u("plant-pots")], "lisa@duffeaap.com", (3, 15)),
    ("Kärcher K4 Pressure Washer", "Works great. Patio cleaner attachment included. Hose replaced last year.", "power-tools", "95", "good", [u("pressure-washer")], "carlos@duffeaap.com", (7, 30)),
    ("DeWalt DCD796 18V Combi Drill", "Brushless drill, excellent condition. 2×2Ah batteries and charger included.", "power-tools", "140", "good", [u("power-drill")], "rob@duffeaap.com", (10, 40)),
    ("Bosch PST 900 Jigsaw", "Used for one project. Excellent condition. 3 blades included.", "power-tools", "55", "like_new", [u("jigsaw")], "amy@duffeaap.com", (5, 20)),
    ("Stanley Hand Tool Set 65-piece", "Full set in toolbox. Never used professionally. All pieces present.", "hand-tools", "75", "good", [u("hand-tools")], "sandra@duffeaap.com", (6, 25)),
    ("Bosch GLL 3-80 Laser Level", "Self-levelling 3-line laser. Case and mounting included. Used twice.", "hand-tools", "160", "like_new", [u("laser-level")], "dave@duffeaap.com", (8, 30)),

    # ── Sport & Fitness ───────────────────────────────────────────────────────
    ("Concept2 RowErg Rowing Machine", "Model D with PM5 monitor. Excellent condition. Folds for storage.", "fitness", "750", "good", [u("rowing-machine")], "john@duffeaap.com", (20, 75)),
    ("Adjustable Dumbbell Set 5–30kg", "Selectorized dumbbell set. Full range 5 to 30 kg. Stand included.", "fitness", "320", "good", [u("dumbbells")], "maria@duffeaap.com", (15, 55)),
    ("Trek FX3 Hybrid Bike 2021", "Lightweight hybrid, 21 speeds. 3,000 km. Serviced 6 months ago.", "road-bikes", "480", "good", [u("road-bike")], "alex@duffeaap.com", (18, 65)),
    ("Peloton Bike (original model)", "Fully functional, screen works great. Shoes and weights included. Moving, must sell.", "fitness", "900", "good", [u("exercise-bike")], "lisa@duffeaap.com", (30, 100)),
    ("Yoga Mat + Blocks + Strap Set", "Cork yoga mat, 2 blocks, 1 strap. Barely used. Great quality.", "fitness", "0", "like_new", [u("yoga-mat")], "sandra@duffeaap.com", (5, 20)),
    ("Giant Escape 3 City Bike – Size M", "Lightweight city bike. Recently tuned. Front light included.", "city-bikes", "280", "good", [u("city-bike")], "amy@duffeaap.com", (10, 40)),
    ("Wilson Clash 100 Tennis Racket", "Barely strung. Comes with cover. Great racket for intermediate players.", "racket-sports", "95", "like_new", [u("tennis-racket")], "rob@duffeaap.com", (7, 28)),

    # ── Kids ─────────────────────────────────────────────────────────────────
    ("LEGO Technic Bugatti Chiron 42083", "Complete set, all pieces present. Built once and displayed. Box included.", "toys", "180", "like_new", [u("lego")], "dave@duffeaap.com", (12, 50)),
    ("Maclaren Quest Stroller – Black", "Lightweight umbrella stroller. Used 1 year. Rain cover included.", "prams", "85", "good", [u("stroller")], "carlos@duffeaap.com", (7, 28)),
    ("Strider 14x Balance Bike – Blue", "Kids balance bike, suitable 3–7 years. Adjustable seat. Minor scuffs.", "kids-bikes", "45", "good", [u("kids-bike")], "rob@duffeaap.com", (5, 22)),
    ("Baby Bjorn Bouncer Balance Soft", "Used for 8 months, excellent condition. Washable fabric cover.", "baby-gear", "65", "good", [u("baby-bouncer")], "lisa@duffeaap.com", (6, 24)),

    # ── Music ────────────────────────────────────────────────────────────────
    ("Fender Player Telecaster – Sunburst", "MIM Telecaster, plays great. Comes with gig bag. Upgraded tuners.", "guitars", "580", "good", [u("guitar")], "lisa@duffeaap.com", (18, 65)),
    ("Yamaha P-45 Digital Piano + Stand", "88 weighted keys. Stand and sustain pedal included. Great for beginners.", "keyboards-pianos", "290", "good", [u("piano-keyboard")], "john@duffeaap.com", (12, 48)),
    ("Pioneer DJ DDJ-400 Controller", "2-deck DJ controller. Comes with Rekordbox licence. Barely used.", "dj-studio", "320", "like_new", [u("dj-controller")], "alex@duffeaap.com", (14, 55)),

    # ── Books & Appliances ────────────────────────────────────────────────────
    ("Box of English & Dutch books ×40", "Assorted fiction and non-fiction. All in good condition. Pick up only.", "fiction", "0", "good", [u("books")], "maria@duffeaap.com", (3, 12)),
    ("Nespresso Vertuo Next + 100 pods", "Coffee machine with 100 assorted pods. Works perfectly. Selling after upgrade.", "coffee", "65", "good", [u("coffee-machine")], "alex@duffeaap.com", (8, 35)),
    ("Dyson V11 Cordless Vacuum", "Powerful cordless vacuum. 2 extra heads, charger. Battery holds full charge.", "vacuums", "220", "good", [u("vacuum-cleaner")], "dave@duffeaap.com", (12, 45)),
    ("Philips Air Fryer XL 6.2L", "Barely used. All accessories included. Perfect for healthy cooking.", "cooking", "75", "like_new", [u("air-fryer")], "sandra@duffeaap.com", (9, 35)),
]

cat_map = {c.slug: c.id for c in db.query(Category).all()}

listing_objects = []
added = 0
now = datetime.now(timezone.utc)

for row in LISTINGS:
    title, desc, cat_slug, price, condition, images, seller_email, view_range = row[:8]
    attrs = row[8] if len(row) > 8 else {}
    cat_id = cat_map.get(cat_slug)
    if not cat_id:
        print(f"  SKIP (no category '{cat_slug}'): {title}")
        continue
    seller = u_map.get(seller_email) or random.choice(all_users)
    existing = db.query(Listing).filter(Listing.title == title).first()
    if existing:
        existing.description = desc
        existing.price = Decimal(price)
        existing.condition = ListingCondition(condition)
        existing.images = images
        existing.category_id = cat_id
        existing.seller_id = seller.id
        existing.attributes = attrs
        listing_objects.append((existing, seller))
        continue
    created = now - timedelta(days=random.randint(0, 60), hours=random.randint(0, 23))
    listing = Listing(
        title=title,
        description=desc,
        price=Decimal(price),
        is_negotiable=random.choice([True, False]),
        condition=ListingCondition(condition),
        status=ListingStatus.ACTIVE,
        seller_id=seller.id,
        category_id=cat_id,
        images=images,
        attributes=attrs,
        view_count=random.randint(*view_range),
        created_at=created,
        updated_at=created,
    )
    db.add(listing)
    listing_objects.append((listing, seller))
    added += 1

db.commit()
for listing, _ in listing_objects:
    db.refresh(listing)

# Store images as listings/{id}/1.jpg, listings/{id}/2.jpg, ...
# (source stem filenames are replaced with positional keys)
for listing, _ in listing_objects:
    source_stems = listing.images  # e.g. ["surfboard-1.jpg", "surfboard-2.jpg"]
    if not source_stems:
        continue
    new_keys = [f'listings/{listing.id}/{idx}.jpg' for idx, _ in enumerate(source_stems, start=1)]
    listing.images = new_keys
db.commit()

print(f"Added {added} listings.")
print("Run scripts/upload-seed-images.py to upload images to the objectstore.")

# ── Expiry test listings ──────────────────────────────────────────────────────
# These listings are seeded with specific updated_at values to test the
# expiry/renewal lifecycle without having to wait 30 days.
#
# Lifecycle reference (based on updated_at):
#   23 days → warning email sent, reminder_sent = True
#   30 days → status set to EXPIRED (hidden from browse, visible on owner's profile)
#   Owner can renew at any time to make it active again.
#
# (days_inactive, status, reminder_sent, title, seller_email, cat_slug, price)
EXPIRY_TEST_LISTINGS = [
    (26, ListingStatus.ACTIVE,  True,  "TEST: Expiring soon (warning sent, 4 days left)", "john@duffeaap.com",  "surfboards",      "150"),
    (30, ListingStatus.EXPIRED, True,  "TEST: Expired listing (just expired, renewable)", "tom@duffeaap.com",   "mobile-phones",   "200"),
]

expiry_added = 0
for days_inactive, status, reminder_sent, title, seller_email, cat_slug, price in EXPIRY_TEST_LISTINGS:
    cat_id = cat_map.get(cat_slug)
    seller = u_map.get(seller_email) or random.choice(all_users)
    existing = db.query(Listing).filter(Listing.title == title).first()
    if existing:
        # Don't reset updated_at on re-seed to avoid triggering expiry emails
        existing.status = status
        existing.reminder_sent = reminder_sent
        continue
    inactive_since = now - timedelta(days=days_inactive)
    listing = Listing(
        title=title,
        description="This is a test listing seeded to verify the expiry/renewal flow.",
        price=Decimal(price),
        is_negotiable=False,
        condition=ListingCondition.GOOD,
        status=status,
        seller_id=seller.id,
        category_id=cat_id,
        images=[],
        attributes={},
        view_count=random.randint(5, 30),
        reminder_sent=reminder_sent,
        created_at=inactive_since,
        updated_at=inactive_since,
    )
    db.add(listing)
    expiry_added += 1

db.commit()
print(f"Added {expiry_added} expiry-test listings.")

# ── Conversations & Messages ──────────────────────────────────────────────────
MESSAGE_PAIRS = [
    ("Hi, is this still available?",          "Yes, still available! When can you come?"),
    ("What's the lowest you'd go?",           "I can do a bit less — best offer wins!"),
    ("Can I see more photos?",                "Sure, I'll send a few more. Any specific angles?"),
    ("Does it come with any accessories?",    "Yes, everything described in the listing is included."),
    ("Where exactly are you located?",        "Easy to find, free parking. Message me for the address."),
    ("Would you consider delivery?",          "I'm afraid pickup only, sorry!"),
    ("I'm interested! Can we meet tomorrow?", "Tomorrow works great. Morning or afternoon?"),
    ("Is there any damage I should know about?", "Just what's mentioned in the listing — no surprises."),
    ("Is the price negotiable?",              "There's a little room, yes. Make me an offer!"),
    ("Can I test it before buying?",          "Absolutely, come have a look anytime."),
]

sample = random.sample(listing_objects, min(20, len(listing_objects)))
conv_added = 0

for listing, seller in sample:
    buyers = [u for u in all_users if u.id != seller.id]
    if not buyers:
        continue
    buyer = random.choice(buyers)

    existing = db.query(Conversation).filter_by(
        listing_id=listing.id, buyer_id=buyer.id, seller_id=seller.id
    ).first()
    if existing:
        continue

    conv = Conversation(listing_id=listing.id, buyer_id=buyer.id, seller_id=seller.id)
    db.add(conv)
    db.flush()

    n = random.randint(1, 3)
    chosen = random.sample(MESSAGE_PAIRS, n)
    t = now - timedelta(days=random.randint(0, 14), hours=random.randint(1, 10))
    for buyer_msg, seller_msg in chosen:
        db.add(Message(conversation_id=conv.id, sender_id=buyer.id,  body=buyer_msg,  is_read=True, created_at=t))
        t += timedelta(minutes=random.randint(5, 90))
        db.add(Message(conversation_id=conv.id, sender_id=seller.id, body=seller_msg, is_read=random.choice([True, False]), created_at=t))
        t += timedelta(minutes=random.randint(5, 90))

    conv_added += 1

db.commit()
print(f"Added {conv_added} conversations with messages.")

# ── Ratings ───────────────────────────────────────────────────────────────────
from app.models.rating import Rating
from sqlalchemy.exc import IntegrityError

ratings_added = 0
# Take the first 8 seeded conversations, mark their listings as sold, add ratings
all_convs = db.query(Conversation).limit(8).all()
for conv in all_convs:
    listing = db.query(Listing).filter(Listing.id == conv.listing_id).first()
    if not listing:
        continue
    # Mark as sold if still active
    if listing.status == ListingStatus.ACTIVE:
        listing.status = ListingStatus.SOLD

    # Buyer rates seller
    if not db.query(Rating).filter_by(rater_id=conv.buyer_id, listing_id=listing.id).first():
        db.add(Rating(
            listing_id=listing.id,
            rater_id=conv.buyer_id,
            ratee_id=conv.seller_id,
            role="buyer_rating_seller",
            score_description=random.randint(3, 5),
            score_communication=random.randint(3, 5),
            score_exchange=random.randint(3, 5),
        ))
        ratings_added += 1

    # Seller rates buyer
    if not db.query(Rating).filter_by(rater_id=conv.seller_id, listing_id=listing.id).first():
        db.add(Rating(
            listing_id=listing.id,
            rater_id=conv.seller_id,
            ratee_id=conv.buyer_id,
            role="seller_rating_buyer",
            score_overall=random.randint(3, 5),
        ))
        ratings_added += 1

try:
    db.commit()
    print(f"Added {ratings_added} ratings.")
except IntegrityError:
    db.rollback()
    print("Some ratings already existed, skipped.")

db.close()
