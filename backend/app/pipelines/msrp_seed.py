"""
Pipeline: Seed MSRP (retail price) data for popular LEGO sets.

LEGO set MSRPs are publicly listed on LEGO.com. This module provides a curated
list of current/popular sets with their known retail prices. These prices are
stable (LEGO rarely changes MSRP during a set's lifetime).

Also generates retailer search URLs for Amazon, Target, and Walmart.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from urllib.parse import quote

from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Offer as OfferModel, Set as SetModel

logger = logging.getLogger("bricktrack.pipeline.msrp_seed")

# Curated MSRP data: {plain_set_num: (price_usd, name_hint)}
# Source: LEGO.com published retail prices (public information)
MSRP_DATA: dict[str, tuple[float, str]] = {
    # Icons / Creator Expert / Modular Buildings
    "11371": (249.99, "Shopping Street"),
    "10305": (399.99, "Lion Knights' Castle"),
    "10497": (99.99, "Galaxy Explorer"),
    "10330": (199.99, "McLaren MP4/4 & Ayrton Senna"),
    "10331": (89.99, "Kingfisher Bird"),
    "10332": (79.99, "Medieval Town Square"),
    "10333": (259.99, "Hogwarts Castle and Grounds"),
    "10334": (99.99, "Jazz Club"),
    "10336": (349.99, "Titanic"),
    "10316": (499.99, "The Lord of the Rings: Rivendell"),
    "10317": (219.99, "Land Rover Classic Defender 90"),
    "10318": (169.99, "Concorde"),
    "10319": (24.99, "Tulips"),
    "10328": (179.99, "Bouquet of Roses"),
    "10329": (49.99, "Tiny Plants"),
    "10311": (49.99, "Orchid"),
    "10314": (99.99, "Dried Flower Centerpiece"),
    "10313": (49.99, "Wildflower Bouquet"),
    "10281": (49.99, "Bonsai Tree"),
    "10280": (59.99, "Flower Bouquet"),
    "10312": (99.99, "Jazz Club"),
    # Architecture
    "21060": (99.99, "Himeji Castle"),
    "21061": (119.99, "Notre-Dame de Paris"),
    "21062": (29.99, "Taj Mahal"),
    "21057": (59.99, "Singapore"),
    "21056": (39.99, "Taj Mahal"),
    "21054": (119.99, "The White House"),
    # Technic
    "42182": (239.99, "NASA Apollo Lunar Roving Vehicle"),
    "42183": (449.99, "Bugatti Bolide"),
    "42176": (49.99, "Porsche GT4 e-Performance"),
    "42177": (159.99, "Lamborghini Huracán Tecnica"),
    "42178": (27.99, "Space Shuttle"),
    "42179": (99.99, "Planet Earth and Moon in Orbit"),
    "42181": (199.99, "VTOL Heavy Cargo Spaceship LT81"),
    "42151": (49.99, "Bugatti Bolide"),
    "42145": (449.99, "Airbus H175 Rescue Helicopter"),
    "42143": (449.99, "Ferrari Daytona SP3"),
    "42141": (199.99, "McLaren Formula 1 Race Car"),
    "42115": (379.99, "Lamborghini Sián FKP 37"),
    # Star Wars
    "75403": (159.99, "Clone Trooper & Battle Droid Battle Pack"),
    "75404": (49.99, "Naboo Starfighter"),
    "75405": (129.99, "AT-TE Walker"),
    "75406": (79.99, "Republic Attack Cruiser"),
    "75407": (29.99, "X-wing Starfighter"),
    "75393": (79.99, "The Battle of Endor"),
    "75394": (499.99, "Millennium Falcon"),
    "75395": (39.99, "Battle on Takodana"),
    "75388": (169.99, "Clone Turbo Tank"),
    "75389": (499.99, "Dark Falcon"),
    "75390": (149.99, "Luke Skywalker's X-Wing"),
    "75391": (34.99, "Captain Rex's Y-Wing"),
    "75392": (59.99, "Tantive IV"),
    "75379": (79.99, "R2-D2"),
    "75380": (349.99, "Mos Espa Podrace Diorama"),
    "75381": (39.99, "Droideka"),
    "75378": (19.99, "BARC Speeder Escape"),
    "75375": (499.99, "Millennium Falcon"),
    "75376": (79.99, "Tantive IV"),
    "75371": (499.99, "Chewbacca"),
    "75367": (529.99, "Venator-Class Republic Attack Cruiser"),
    "75366": (99.99, "Advent Calendar"),
    "75364": (29.99, "New Republic E-Wing"),
    "75363": (15.99, "N-1 Starfighter Microfighter"),
    "75360": (34.99, "Yoda's Jedi Starfighter"),
    "75357": (79.99, "Ghost & Phantom II"),
    "75356": (39.99, "Executor Super Star Destroyer"),
    # Harry Potter
    "76435": (109.99, "Hogwarts Castle: The Great Hall"),
    "76434": (79.99, "Hogwarts Castle: Potions Class"),
    "76433": (49.99, "Hogwarts Castle: Astronomy Tower"),
    "76432": (34.99, "Forbidden Forest: Magical Creatures"),
    "76431": (29.99, "Hogwarts Castle: Herbology Class"),
    "76430": (19.99, "Hogwarts Castle Owlery"),
    "76429": (149.99, "Talking Sorting Hat"),
    "76428": (99.99, "Hagrid's Hut"),
    # City
    "60431": (59.99, "Space Explorer Rover and Alien Life"),
    "60432": (49.99, "Command Rover and Crane Loader"),
    "60433": (99.99, "Modular Space Station"),
    "60434": (29.99, "Space Base and Rocket Launchpad"),
    "60430": (9.99, "Interstellar Spaceship"),
    # Friends
    "42635": (79.99, "Heartlake City School"),
    "42636": (59.99, "Heartlake City Preschool"),
    "42637": (34.99, "Sunshine Flower Shop"),
    "42638": (29.99, "Heartlake City Bike Park"),
    # Speed Champions
    "76924": (29.99, "Mercedes-AMG GT3"),
    "76925": (24.99, "Aston Martin Safety Car"),
    "76926": (54.99, "BMW M4 GT3 & BMW M Hybrid V8"),
    "76927": (24.99, "Audi S1 e-tron quattro"),
    # Ideas
    "21351": (199.99, "Nightmare Before Christmas"),
    "21350": (79.99, "Back to the Future Time Machine"),
    "21348": (49.99, "Dungeons & Dragons"),
    "21345": (29.99, "Polaroid OneStep SX-70"),
    "21344": (79.99, "Orient Express Train"),
    "21343": (99.99, "Viking Village"),
    "21342": (89.99, "The Insect Collection"),
    "21341": (99.99, "Disney Hocus Pocus"),
    "21340": (249.99, "Tales of the Space Age"),
    "21339": (169.99, "BTS Dynamite"),
    "21338": (299.99, "A-Frame Cabin"),
    "21337": (99.99, "Table Football"),
    "21336": (69.99, "The Office"),
    "21335": (229.99, "Motorized Lighthouse"),
    "21334": (169.99, "Jazz Quartet"),
    "21333": (79.99, "Vincent van Gogh - The Starry Night"),
    "21332": (199.99, "The Globe"),
    "21331": (199.99, "Sonic the Hedgehog - Green Hill Zone"),
    "21330": (169.99, "Home Alone"),
    "21329": (79.99, "Fender Stratocaster"),
    "21327": (179.99, "Typewriter"),
    "21325": (179.99, "Medieval Blacksmith"),
    "21323": (299.99, "Grand Piano"),
    "21322": (199.99, "Pirates of Barracuda Bay"),
    "21318": (199.99, "Tree House"),
    # Super Mario
    "71437": (269.99, "Bowser's Airship"),
    "71438": (34.99, "Donkey Kong's Mine Cart Ride"),
    "71439": (59.99, "Dry Bowser Castle Battle"),
    # Disney
    "43276": (39.99, "Moana's Wayfinding Boat"),
    "43266": (109.99, "Frozen Ice Castle"),
    # Ninjago
    "71821": (99.99, "Cole's Titan Dragon Mech"),
    "71822": (59.99, "Source Dragon of Motion"),
    "71823": (149.99, "Nya's Water Dragon EVO"),
    # Art
    "31213": (119.99, "World Map"),
    "31212": (49.99, "The Milky Way Galaxy"),
    "31211": (79.99, "The Fauna Collection - Macaw Parrots"),
    "31210": (49.99, "Modern Art"),
    "31209": (99.99, "The Amazing Spider-Man"),
    "31208": (149.99, "Hokusai - The Great Wave"),
    # Marvel
    "76300": (39.99, "Iron Spider-Man Construction Figure"),
    "76301": (29.99, "Spider-Man Race Car & Venom Green Goblin"),
    "76298": (89.99, "Iron Spider-Man Mech"),
    "76295": (49.99, "Spider-Man Final Battle"),
    "76294": (59.99, "Baby Groot"),
    "76290": (69.99, "The Avengers Assemble: Age of Ultron"),
    "76266": (499.99, "Endgame Final Battle"),
    "76261": (179.99, "Spider-Man Final Battle"),
    "76257": (249.99, "Wolverine Construction Figure"),
    "76248": (99.99, "The Avengers Quinjet"),
    # DC
    "76275": (14.99, "Batman Construction Figure"),
    "76274": (49.99, "Batman with the Batmobile"),
    "76273": (29.99, "Batman Mech Armor"),
    "76272": (59.99, "The Batcave with Batman, Batgirl, and The Joker"),
    "76271": (109.99, "Batman: The Animated Series Gotham City"),
    "76270": (249.99, "Batman vs. The Joker Chase"),
    "76269": (149.99, "Batwing: Batman vs. The Joker"),
}


def _build_amazon_url(plain: str, name: str) -> str:
    return f"https://www.amazon.com/s?k={quote(f'LEGO {plain} {name}')}"


def _build_target_url(plain: str) -> str:
    return f"https://www.target.com/s?searchTerm=lego+{plain}"


def _build_walmart_url(plain: str) -> str:
    return f"https://www.walmart.com/search?q=lego+{plain}"


def _build_lego_url(plain: str) -> str:
    return f"https://www.lego.com/en-us/product/{plain}"


def _upsert_offer(
    db: Session,
    set_num_plain: str,
    store: str,
    price: float | None,
    currency: str,
    url: str,
    in_stock: bool | None,
) -> bool:
    """Insert or update offer by (set_num, store). Returns True if new."""
    now = datetime.now(timezone.utc)

    existing = db.execute(
        select(OfferModel).where(
            and_(OfferModel.set_num == set_num_plain, OfferModel.store == store)
        )
    ).scalar_one_or_none()

    if existing:
        if price is not None:
            existing.price = price
        existing.currency = currency
        existing.url = url
        if in_stock is not None:
            existing.in_stock = in_stock
        existing.last_checked = now
        return False
    else:
        db.add(OfferModel(
            set_num=set_num_plain,
            store=store,
            price=price,
            currency=currency,
            url=url,
            in_stock=in_stock,
            last_checked=now,
        ))
        return True


def run_msrp_seed() -> dict:
    """
    Seed MSRP offers for curated sets and generate retailer search links.

    Called by:
    - POST /admin/pipelines/msrp_seed/run
    """
    logger.info("Starting MSRP seed...")
    t0 = time.time()

    db = SessionLocal()
    inserted = 0
    updated = 0
    matched = 0

    try:
        for plain, (price, name) in MSRP_DATA.items():
            # Check if set exists in DB (try both formats)
            set_exists = False
            for sn in [f"{plain}-1", plain]:
                row = db.execute(
                    select(SetModel).where(SetModel.set_num == sn)
                ).scalar_one_or_none()
                if row:
                    set_exists = True
                    # Update retail_price on the Set model
                    if row.retail_price != price:
                        row.retail_price = price
                        row.retail_currency = "USD"
                    # Mark as available (these are current sets on LEGO.com)
                    if row.retirement_status != "available":
                        row.retirement_status = "available"
                    break

            if not set_exists:
                continue

            matched += 1

            # LEGO.com offer (with price)
            is_new = _upsert_offer(
                db, plain, "LEGO", price, "USD",
                _build_lego_url(plain), True,
            )
            if is_new:
                inserted += 1
            else:
                updated += 1

            # Amazon search link
            is_new = _upsert_offer(
                db, plain, "Amazon", None, "USD",
                _build_amazon_url(plain, name), None,
            )
            if is_new:
                inserted += 1
            else:
                updated += 1

            # Target search link
            is_new = _upsert_offer(
                db, plain, "Target", None, "USD",
                _build_target_url(plain), None,
            )
            if is_new:
                inserted += 1
            else:
                updated += 1

            # Walmart search link
            is_new = _upsert_offer(
                db, plain, "Walmart", None, "USD",
                _build_walmart_url(plain), None,
            )
            if is_new:
                inserted += 1
            else:
                updated += 1

        db.commit()

        stats = {
            "curated_sets": len(MSRP_DATA),
            "matched_in_db": matched,
            "offers_inserted": inserted,
            "offers_updated": updated,
        }

        # --- Year-based retirement inference ---
        # Sets from 2023 or earlier are almost certainly retired.
        # Sets from 2024+ without explicit status stay "unknown" (NULL).
        retired_count = 0
        old_sets = db.execute(
            select(SetModel).where(
                and_(
                    SetModel.year.isnot(None),
                    SetModel.year <= 2023,
                    SetModel.retirement_status.is_(None),
                )
            )
        ).scalars().all()

        for s in old_sets:
            s.retirement_status = "retired"
            retired_count += 1

        db.commit()
        stats["retired_by_year"] = retired_count

        elapsed = time.time() - t0
        stats["elapsed_seconds"] = round(elapsed, 1)
        logger.info("MSRP seed complete: %s", stats)
        return stats

    except Exception:
        db.rollback()
        logger.exception("MSRP seed failed")
        return {"error": "seed_failed", "completed_at": datetime.now(timezone.utc).isoformat()}
    finally:
        db.close()
