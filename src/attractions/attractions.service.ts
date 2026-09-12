import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateAttractionDto } from './dto/create-attraction.dto';
import { ListAttractionsDto } from './dto/list-attractions.dto';
import { UpdateAttractionDto } from './dto/update-attraction.dto';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

type UploadedFiles = {
  thumbnail?: Express.Multer.File[];
  banner?:    Express.Multer.File[];
  images?:    Express.Multer.File[];
};

const SETUP_SQL = `
  CREATE TABLE IF NOT EXISTS attractions (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    country_id        UUID         NOT NULL,
    city_id           UUID         NOT NULL,
    destination_id    UUID         NOT NULL,
    module_id         UUID         NOT NULL,
    collection_id     UUID,
    name              VARCHAR(255) NOT NULL,
    slug              VARCHAR(255) NOT NULL,
    short_name        VARCHAR(150),
    attraction_type   VARCHAR(100),
    short_description TEXT,
    description       TEXT,
    address           VARCHAR(500),
    latitude          NUMERIC(10,8),
    longitude         NUMERIC(11,8),
    google_map_url    VARCHAR(1000),
    opening_time      VARCHAR(10),
    closing_time      VARCHAR(10),
    ticket_price      NUMERIC(10,2),
    currency          VARCHAR(10),
    duration          VARCHAR(100),
    contact_number    VARCHAR(30),
    email             VARCHAR(255),
    featured          BOOLEAN      NOT NULL DEFAULT false,
    thumbnail         VARCHAR(500),
    banner            VARCHAR(500),
    images            TEXT,
    publish_status    BOOLEAN      NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
  );
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS collection_id     UUID;
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS short_name        VARCHAR(150);
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS attraction_type   VARCHAR(100);
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS short_description TEXT;
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS description       TEXT;
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS address           VARCHAR(500);
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS latitude          NUMERIC(10,8);
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS longitude         NUMERIC(11,8);
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS google_map_url    VARCHAR(1000);
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS opening_time      VARCHAR(10);
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS closing_time      VARCHAR(10);
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS ticket_price      NUMERIC(10,2);
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS currency          VARCHAR(10);
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS duration          VARCHAR(100);
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS contact_number    VARCHAR(30);
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS email             VARCHAR(255);
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS featured          BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS thumbnail         VARCHAR(500);
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS banner            VARCHAR(500);
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS images            TEXT;
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE attractions ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_attn_slug           ON attractions(slug)                         WHERE deleted_at IS NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_attn_name_dest      ON attractions(name, destination_id)         WHERE deleted_at IS NULL;
  CREATE INDEX        IF NOT EXISTS idx_attn_country_id     ON attractions(country_id);
  CREATE INDEX        IF NOT EXISTS idx_attn_city_id        ON attractions(city_id);
  CREATE INDEX        IF NOT EXISTS idx_attn_destination_id ON attractions(destination_id);
  CREATE INDEX        IF NOT EXISTS idx_attn_module_id      ON attractions(module_id);
  CREATE INDEX        IF NOT EXISTS idx_attn_collection_id  ON attractions(collection_id);
  CREATE INDEX        IF NOT EXISTS idx_attn_type           ON attractions(attraction_type);
  CREATE INDEX        IF NOT EXISTS idx_attn_featured       ON attractions(featured)       WHERE deleted_at IS NULL;
  CREATE INDEX        IF NOT EXISTS idx_attn_publish        ON attractions(publish_status) WHERE deleted_at IS NULL;
  CREATE INDEX        IF NOT EXISTS idx_attn_deleted_at     ON attractions(deleted_at);

  SELECT pg_notify('pgrst', 'reload schema');
`;

const ATTN_LIST_FIELDS = [
  'id', 'country_id', 'city_id', 'destination_id', 'module_id', 'collection_id',
  'name', 'slug', 'short_name', 'attraction_type', 'thumbnail',
  'ticket_price', 'currency', 'featured', 'publish_status', 'created_at',
].join(', ');

const ATTN_DETAIL_FIELDS = [
  'id', 'country_id', 'city_id', 'destination_id', 'module_id', 'collection_id',
  'name', 'slug', 'short_name', 'attraction_type',
  'short_description', 'description',
  'address', 'latitude', 'longitude', 'google_map_url',
  'opening_time', 'closing_time', 'ticket_price', 'currency', 'duration',
  'contact_number', 'email',
  'featured', 'thumbnail', 'banner', 'images',
  'publish_status', 'created_at', 'updated_at',
].join(', ');

@Injectable()
export class AttractionsService {
  constructor(private readonly supabase: SupabaseService) {}

  // ─── Setup ───────────────────────────────────────────────────────────────────

  async setup(): Promise<{ success: boolean; message: string }> {
    await this.supabase.db.storage
      .createBucket(process.env.STORAGE_BUCKET!, { public: true })
      .catch(() => {});

    const res = await fetch(
      `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: SETUP_SQL }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Migration failed: ${body}`);
    }

    return { success: true, message: 'Attractions table migrated successfully.' };
  }

  // ─── Seed ────────────────────────────────────────────────────────────────────

  async seed(): Promise<{ success: boolean; message: string; inserted: number; skipped: number }> {
    // 1. Resolve UAE
    const { data: country } = await this.supabase.db
      .from('countries')
      .select('id')
      .or('name.ilike.%united arab emirates%,iso2.eq.AE,iso3.eq.ARE')
      .is('deleted_at', null)
      .maybeSingle();
    if (!country) throw new NotFoundException('Country "United Arab Emirates" not found. Run the countries seed or create it first.');

    // 2. Resolve Dubai city
    const { data: city } = await this.supabase.db
      .from('cities')
      .select('id')
      .ilike('name', 'Dubai')
      .eq('country_id', country.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!city) throw new NotFoundException('City "Dubai" not found under UAE. Create it first.');

    // 3. Resolve first available module
    const { data: module } = await (this.supabase.db as any)
      .from('modules')
      .select('id')
      .limit(1)
      .maybeSingle();
    if (!module) throw new NotFoundException('No modules found. Create at least one module first.');

    // 4. Upsert seed destinations in Dubai (check by slug, insert if missing)
    const seedDestinations = [
      {
        slug:          'downtown-dubai',
        name:          'Downtown Dubai',
        description:   'The heart of modern Dubai — home to the Burj Khalifa, Dubai Mall, and Dubai Fountain.',
        address:       'Downtown Dubai, Dubai, UAE',
        latitude:      25.1972,
        longitude:     55.2744,
        publish_status: true,
      },
      {
        slug:          'deira-dubai',
        name:          'Deira',
        description:   'The historic commercial hub of Dubai featuring the Gold Souk, Spice Souk, and Dubai Creek.',
        address:       'Deira, Dubai, UAE',
        latitude:      25.2732,
        longitude:     55.3088,
        publish_status: true,
      },
      {
        slug:          'jumeirah-dubai',
        name:          'Jumeirah',
        description:   'A coastal residential and tourism district known for its stunning beaches and luxury hotels.',
        address:       'Jumeirah, Dubai, UAE',
        latitude:      25.2048,
        longitude:     55.2477,
        publish_status: true,
      },
      {
        slug:          'dubai-marina',
        name:          'Dubai Marina',
        description:   'A vibrant waterfront district with a stunning marina, JBR Beach, Ain Dubai, and world-class dining.',
        address:       'Dubai Marina, Dubai, UAE',
        latitude:      25.0804,
        longitude:     55.1403,
        publish_status: true,
      },
      {
        slug:          'palm-jumeirah-dubai',
        name:          'Palm Jumeirah',
        description:   'The iconic palm-shaped artificial island with luxury resorts, beaches, and world-class attractions.',
        address:       'Palm Jumeirah, Dubai, UAE',
        latitude:      25.1124,
        longitude:     55.1390,
        publish_status: true,
      },
    ];

    const destMap: Record<string, string> = {};
    for (const dest of seedDestinations) {
      const { data: existing } = await this.supabase.db
        .from('destinations')
        .select('id')
        .eq('slug', dest.slug)
        .is('deleted_at', null)
        .maybeSingle();

      if (existing) {
        destMap[dest.slug] = existing.id;
      } else {
        const { data: inserted } = await this.supabase.db
          .from('destinations')
          .insert({
            country_id:    country.id,
            city_id:       city.id,
            module_id:     module.id,
            name:          dest.name,
            slug:          dest.slug,
            description:   dest.description,
            address:       dest.address,
            latitude:      dest.latitude,
            longitude:     dest.longitude,
            publish_status: dest.publish_status,
          })
          .select('id')
          .single();
        if (inserted) destMap[dest.slug] = (inserted as any).id;
      }
    }

    // 5. Seed attractions
    const attractionsData = [
      // ── Downtown Dubai ──────────────────────────────────────────────────────
      {
        destination_slug:  'downtown-dubai',
        name:              'Burj Khalifa',
        short_name:        'Burj Khalifa',
        attraction_type:   'Observation Tower',
        short_description: 'The world\'s tallest building at 828 m with breathtaking observation decks on floors 124 and 148.',
        description:       'Standing 828 metres tall, the Burj Khalifa is the centrepiece of Downtown Dubai. Visitors can access the "At the Top" observation deck on the 124th floor or the premium "At the Top SKY" on the 148th floor for panoramic views of Dubai, the Arabian Gulf, and the desert beyond. Designed by Skidmore, Owings & Merrill, it opened in January 2010.',
        address:           '1 Sheikh Mohammed bin Rashid Blvd, Downtown Dubai, Dubai, UAE',
        latitude:          25.1972,
        longitude:         55.2744,
        google_map_url:    'https://maps.google.com/?q=Burj+Khalifa+Dubai',
        opening_time:      '08:30',
        closing_time:      '23:00',
        ticket_price:      149,
        currency:          'AED',
        duration:          '1-2 hours',
        contact_number:    '+971 4 888 8888',
        email:             'atthetopdubai@emaar.ae',
        featured:          true,
        publish_status:    true,
      },
      {
        destination_slug:  'downtown-dubai',
        name:              'The Dubai Mall',
        short_name:        'Dubai Mall',
        attraction_type:   'Shopping Mall',
        short_description: 'One of the world\'s largest shopping malls with over 1,200 stores, an ice rink, aquarium, and more.',
        description:       'The Dubai Mall is one of the world\'s largest shopping and entertainment destinations, housing over 1,200 retail stores, a 10-million-litre aquarium and underwater zoo, an Olympic-size ice skating rink, a dinosaur skeleton, and the Dubai Fountain — the world\'s largest choreographed fountain system. Adjacent to the Burj Khalifa, it attracts over 80 million visitors annually.',
        address:           'Financial Centre Rd, Downtown Dubai, Dubai, UAE',
        latitude:          25.1985,
        longitude:         55.2796,
        google_map_url:    'https://maps.google.com/?q=The+Dubai+Mall',
        opening_time:      '10:00',
        closing_time:      '00:00',
        ticket_price:      0,
        currency:          'AED',
        duration:          '3-6 hours',
        contact_number:    '+971 800 382 246',
        email:             'info@thedubaimall.com',
        featured:          true,
        publish_status:    true,
      },
      {
        destination_slug:  'downtown-dubai',
        name:              'Dubai Fountain',
        short_name:        'Dubai Fountain',
        attraction_type:   'Landmark',
        short_description: 'The world\'s largest choreographed fountain system illuminated by 6,600 lights and shooting water 150 m high.',
        description:       'Set on the 30-acre Burj Khalifa Lake, the Dubai Fountain is the world\'s largest choreographed fountain system. The fountain shoots water jets up to 150 metres and is illuminated by 6,600 lights and 50 colour projectors. Free to watch from the waterfront promenade, evening shows run every 30 minutes from 18:00 to 23:00.',
        address:           'Burj Khalifa Lake, Downtown Dubai, Dubai, UAE',
        latitude:          25.1958,
        longitude:         55.2791,
        google_map_url:    'https://maps.google.com/?q=Dubai+Fountain',
        opening_time:      '18:00',
        closing_time:      '23:00',
        ticket_price:      0,
        currency:          'AED',
        duration:          '30-60 minutes',
        featured:          false,
        publish_status:    true,
      },
      {
        destination_slug:  'downtown-dubai',
        name:              'Dubai Frame',
        short_name:        'Dubai Frame',
        attraction_type:   'Landmark',
        short_description: 'A 150-metre picture frame shaped structure offering views of old and new Dubai from its glass-floored sky bridge.',
        description:       'The Dubai Frame is a 150.24-metre tall structure shaped like a giant picture frame. One side overlooks the old neighbourhoods of Deira, Karama and Satwa; the other faces the modern skyline of Downtown Dubai and Sheikh Zayed Road. A glass-floored sky bridge connects the two towers at the top for a thrilling 360-degree view.',
        address:           'Zabeel Park, Zabeel, Dubai, UAE',
        latitude:          25.2353,
        longitude:         55.3004,
        google_map_url:    'https://maps.google.com/?q=Dubai+Frame',
        opening_time:      '09:00',
        closing_time:      '21:30',
        ticket_price:      50,
        currency:          'AED',
        duration:          '1-2 hours',
        contact_number:    '+971 4 392 5252',
        featured:          true,
        publish_status:    true,
      },
      // ── Deira ───────────────────────────────────────────────────────────────
      {
        destination_slug:  'deira-dubai',
        name:              'Gold Souk',
        short_name:        'Gold Souk',
        attraction_type:   'Traditional Market',
        short_description: 'One of the largest gold markets in the world with over 300 retailers selling jewellery and precious metals.',
        description:       'The Dubai Gold Souk is a traditional covered market in the Deira district housing over 300 retailers selling gold, silver, diamonds and other precious stones. The souk is famous worldwide for its variety and competitive pricing. Visitors can browse intricate jewellery crafted in 18, 21, 22 and 24-karat gold in every style imaginable, from classic Arabic designs to modern pieces.',
        address:           'Gold Souk, Deira, Dubai, UAE',
        latitude:          25.2697,
        longitude:         55.2985,
        google_map_url:    'https://maps.google.com/?q=Gold+Souk+Dubai',
        opening_time:      '09:30',
        closing_time:      '22:00',
        ticket_price:      0,
        currency:          'AED',
        duration:          '1-2 hours',
        featured:          false,
        publish_status:    true,
      },
      {
        destination_slug:  'deira-dubai',
        name:              'Spice Souk',
        short_name:        'Spice Souk',
        attraction_type:   'Traditional Market',
        short_description: 'A fragrant open-air market selling saffron, frankincense, dried herbs and spices from across the region.',
        description:       'The Dubai Spice Souk is a charming open-air market adjacent to the Gold Souk where vendors sell aromatic spices, herbs, incense, dried fruits and nuts. Highlights include saffron from Iran, frankincense from Oman, and exotic blends unique to the region. Bargaining is expected and adds to the authentic Arabian bazaar experience.',
        address:           'Spice Souk, Deira, Dubai, UAE',
        latitude:          25.2702,
        longitude:         55.2978,
        google_map_url:    'https://maps.google.com/?q=Spice+Souk+Dubai',
        opening_time:      '09:00',
        closing_time:      '22:00',
        ticket_price:      0,
        currency:          'AED',
        duration:          '1 hour',
        featured:          false,
        publish_status:    true,
      },
      {
        destination_slug:  'deira-dubai',
        name:              'Al Fahidi Fort (Dubai Museum)',
        short_name:        'Dubai Museum',
        attraction_type:   'Museum',
        short_description: 'Dubai\'s oldest surviving building (1787) housing a museum that tells the story of Dubai\'s transformation.',
        description:       'Al Fahidi Fort is the oldest existing building in Dubai, built in 1787 and now housing the Dubai Museum. The museum traces Dubai\'s transformation from a small fishing village to a global metropolis through life-size displays, artefacts, manuscripts, maps and audio-visual presentations. The fort itself is a fascinating example of traditional Arabic mud-brick architecture.',
        address:           'Al Fahidi St, Al Fahidi, Bur Dubai, Dubai, UAE',
        latitude:          25.2632,
        longitude:         55.2973,
        google_map_url:    'https://maps.google.com/?q=Dubai+Museum+Al+Fahidi',
        opening_time:      '08:30',
        closing_time:      '20:30',
        ticket_price:      3,
        currency:          'AED',
        duration:          '1-2 hours',
        contact_number:    '+971 4 353 1862',
        featured:          false,
        publish_status:    true,
      },
      {
        destination_slug:  'deira-dubai',
        name:              'Dubai Creek',
        short_name:        'Dubai Creek',
        attraction_type:   'Waterway',
        short_description: 'A natural seawater inlet that was the lifeline of old Dubai, now a scenic heritage waterway with traditional abra boats.',
        description:       'Dubai Creek is a natural seawater inlet that splits Dubai into the districts of Deira and Bur Dubai. Historically the heart of Dubai\'s pearling and trading economy, it remains a vibrant waterway. Visitors can cross between banks on traditional wooden abra boats for just AED 1, explore the riverside promenades, and discover heritage architecture in the Al Fahidi Historical Neighbourhood.',
        address:           'Dubai Creek, Deira, Dubai, UAE',
        latitude:          25.2627,
        longitude:         55.3074,
        google_map_url:    'https://maps.google.com/?q=Dubai+Creek',
        opening_time:      '00:00',
        closing_time:      '23:59',
        ticket_price:      1,
        currency:          'AED',
        duration:          '1-3 hours',
        featured:          false,
        publish_status:    true,
      },
      // ── Jumeirah ─────────────────────────────────────────────────────────────
      {
        destination_slug:  'jumeirah-dubai',
        name:              'Jumeirah Beach',
        short_name:        'Jumeirah Beach',
        attraction_type:   'Beach',
        short_description: 'Dubai\'s most iconic public beach with crystal-clear blue water, white sand, and views of the Burj Al Arab.',
        description:       'Jumeirah Beach is a 4-km stretch of pristine white sand along the Arabian Gulf, one of Dubai\'s most beloved public beaches. The beach offers clear, warm waters, free access, changing facilities, and an iconic backdrop of the Burj Al Arab hotel on its private island. The adjacent Kite Beach section is popular for water sports, beach volleyball, and food trucks.',
        address:           'Jumeirah Beach Road, Jumeirah 1, Dubai, UAE',
        latitude:          25.2048,
        longitude:         55.2477,
        google_map_url:    'https://maps.google.com/?q=Jumeirah+Beach+Dubai',
        opening_time:      '00:00',
        closing_time:      '23:59',
        ticket_price:      0,
        currency:          'AED',
        duration:          '2-4 hours',
        featured:          true,
        publish_status:    true,
      },
      {
        destination_slug:  'jumeirah-dubai',
        name:              'Jumeirah Mosque',
        short_name:        'Jumeirah Mosque',
        attraction_type:   'Religious Site',
        short_description: 'One of the most photographed buildings in Dubai — a stunning white mosque open to non-Muslim visitors.',
        description:       'The Jumeirah Mosque is one of the most beautiful and photographed mosques in Dubai, built in the medieval Fatimid tradition and carved entirely from white stone. It is one of the few mosques in Dubai open to non-Muslim visitors. The Sheikh Mohammed Centre for Cultural Understanding offers guided tours on selected days, providing insight into Islamic beliefs and Emirati traditions.',
        address:           'Jumeirah Beach Road, Jumeirah 1, Dubai, UAE',
        latitude:          25.2271,
        longitude:         55.2618,
        google_map_url:    'https://maps.google.com/?q=Jumeirah+Mosque+Dubai',
        opening_time:      '10:00',
        closing_time:      '16:00',
        ticket_price:      35,
        currency:          'AED',
        duration:          '1-2 hours',
        contact_number:    '+971 4 353 6666',
        email:             'info@cultures.ae',
        featured:          false,
        publish_status:    true,
      },
      // ── Dubai Marina ─────────────────────────────────────────────────────────
      {
        destination_slug:  'dubai-marina',
        name:              'Ain Dubai',
        short_name:        'Ain Dubai',
        attraction_type:   'Observation Wheel',
        short_description: 'The world\'s largest and tallest observation wheel at 250 m, offering sweeping views over Dubai Marina and beyond.',
        description:       'Ain Dubai — Arabic for "Eye of Dubai" — is the world\'s largest and tallest observation wheel, standing 250 metres tall on Bluewaters Island. The wheel has 48 air-conditioned cabins, each holding up to 40 guests, and makes a full rotation in 38 minutes. It offers spectacular panoramic views of the Dubai Marina skyline, Palm Jumeirah, the Arabian Gulf, and on a clear day, the Burj Khalifa.',
        address:           'Bluewaters Island, Dubai, UAE',
        latitude:          25.0804,
        longitude:         55.1294,
        google_map_url:    'https://maps.google.com/?q=Ain+Dubai+Bluewaters+Island',
        opening_time:      '10:00',
        closing_time:      '00:00',
        ticket_price:      130,
        currency:          'AED',
        duration:          '1-2 hours',
        contact_number:    '+971 4 247 3333',
        featured:          true,
        publish_status:    true,
      },
      {
        destination_slug:  'dubai-marina',
        name:              'The Walk JBR',
        short_name:        'The Walk JBR',
        attraction_type:   'Waterfront Promenade',
        short_description: 'A lively 1.7-km waterfront promenade lined with restaurants, shops, and direct access to JBR Beach.',
        description:       'The Walk at JBR (Jumeirah Beach Residence) is a 1.7-kilometre open-air promenade along the Arabian Gulf, flanked by residential towers, restaurants, cafes, boutiques and entertainment venues. Adjacent to JBR Public Beach, it is one of Dubai\'s most popular outdoor destinations, especially during the cooler winter months. Regular events, live entertainment and a fresh market make it a year-round attraction.',
        address:           'Jumeirah Beach Residence, Dubai Marina, Dubai, UAE',
        latitude:          25.0781,
        longitude:         55.1333,
        google_map_url:    'https://maps.google.com/?q=The+Walk+JBR+Dubai',
        opening_time:      '00:00',
        closing_time:      '23:59',
        ticket_price:      0,
        currency:          'AED',
        duration:          '2-4 hours',
        featured:          false,
        publish_status:    true,
      },
      // ── Palm Jumeirah ─────────────────────────────────────────────────────────
      {
        destination_slug:  'palm-jumeirah-dubai',
        name:              'Aquaventure Waterpark',
        short_name:        'Aquaventure',
        attraction_type:   'Water Park',
        short_description: 'A world-renowned waterpark at Atlantis The Palm with record-breaking slides and a private beach.',
        description:       'Aquaventure Waterpark at Atlantis The Palm is one of the world\'s top-rated waterparks, offering over 30 water slides and attractions, a 700-metre river ride, a private beach with water sports, kids\' splash zones and a dedicated area for toddlers. Highlights include the Leap of Faith, a near-vertical 9-storey slide, and the Aquaconda, a six-person raft slide. The park also grants access to the private beach and marine habitats.',
        address:           'Atlantis The Palm, Palm Jumeirah, Dubai, UAE',
        latitude:          25.1304,
        longitude:         55.1173,
        google_map_url:    'https://maps.google.com/?q=Aquaventure+Waterpark+Atlantis+Dubai',
        opening_time:      '10:00',
        closing_time:      '19:00',
        ticket_price:      395,
        currency:          'AED',
        duration:          'Full day',
        contact_number:    '+971 4 426 2000',
        email:             'reservations@atlantisthepalm.com',
        featured:          true,
        publish_status:    true,
      },
      {
        destination_slug:  'palm-jumeirah-dubai',
        name:              'The Lost Chambers Aquarium',
        short_name:        'Lost Chambers',
        attraction_type:   'Aquarium',
        short_description: 'An underwater maze of 21 chambers and tunnels home to over 65,000 marine animals at Atlantis The Palm.',
        description:       'The Lost Chambers Aquarium at Atlantis The Palm is built around the myth of the lost city of Atlantis. Spanning 21 interconnected underwater chambers and tunnels, it is home to over 65,000 marine animals including sharks, rays, piranhas, seahorses and jellyfish. Visitors can take guided tours, snorkel with sharks, or dine beneath a giant aquarium tank in the Ambassador Lagoon restaurant.',
        address:           'Atlantis The Palm, Palm Jumeirah, Dubai, UAE',
        latitude:          25.1303,
        longitude:         55.1170,
        google_map_url:    'https://maps.google.com/?q=Lost+Chambers+Aquarium+Dubai',
        opening_time:      '10:00',
        closing_time:      '22:00',
        ticket_price:      125,
        currency:          'AED',
        duration:          '1-2 hours',
        contact_number:    '+971 4 426 1000',
        featured:          false,
        publish_status:    true,
      },
      {
        destination_slug:  'palm-jumeirah-dubai',
        name:              'Miracle Garden',
        short_name:        'Miracle Garden',
        attraction_type:   'Garden',
        short_description: 'The world\'s largest natural flower garden with over 150 million blooming flowers in spectacular themed displays.',
        description:       'Dubai Miracle Garden is the world\'s largest natural flower garden, spread over 72,000 square metres and blooming with more than 150 million flowers in artistic arrangements. Iconic displays include a life-size Emirates A380 aircraft, life-size Disney characters, heart-shaped arches and towering floral castles. The garden is seasonal, typically open from November to May, and is especially magical at night when illuminated.',
        address:           'Al Barsha South 3, Dubai, UAE',
        latitude:          25.0657,
        longitude:         55.2439,
        google_map_url:    'https://maps.google.com/?q=Dubai+Miracle+Garden',
        opening_time:      '09:00',
        closing_time:      '21:00',
        ticket_price:      55,
        currency:          'AED',
        duration:          '2-3 hours',
        contact_number:    '+971 4 422 8902',
        featured:          true,
        publish_status:    true,
      },
    ];

    let inserted = 0;
    let skipped  = 0;

    for (const attn of attractionsData) {
      const destinationId = destMap[attn.destination_slug];
      if (!destinationId) { skipped++; continue; }

      const slug = this.generateSlug(attn.name);

      const { data: existing } = await this.supabase.db
        .from('attractions')
        .select('id')
        .eq('slug', slug)
        .is('deleted_at', null)
        .maybeSingle();

      if (existing) { skipped++; continue; }

      const { error } = await this.supabase.db.from('attractions').insert({
        country_id:       country.id,
        city_id:          city.id,
        destination_id:   destinationId,
        module_id:        module.id,
        name:             attn.name,
        slug,
        short_name:       attn.short_name       ?? null,
        attraction_type:  attn.attraction_type   ?? null,
        short_description: attn.short_description ?? null,
        description:      attn.description       ?? null,
        address:          attn.address           ?? null,
        latitude:         attn.latitude          ?? null,
        longitude:        attn.longitude         ?? null,
        google_map_url:   attn.google_map_url    ?? null,
        opening_time:     attn.opening_time      ?? null,
        closing_time:     attn.closing_time      ?? null,
        ticket_price:     attn.ticket_price      ?? null,
        currency:         attn.currency          ?? null,
        duration:         attn.duration          ?? null,
        contact_number:   attn.contact_number    ?? null,
        email:            (attn as any).email    ?? null,
        featured:         attn.featured          ?? false,
        publish_status:   attn.publish_status,
      });

      if (error) { skipped++; } else { inserted++; }
    }

    return {
      success:  true,
      message:  `Dubai attractions seed completed. ${inserted} inserted, ${skipped} skipped (already exist or error).`,
      inserted,
      skipped,
    };
  }

  // ─── Dropdown ────────────────────────────────────────────────────────────────

  async dropdown(
    country_id?: string,
    city_id?: string,
    destination_id?: string,
  ): Promise<{ success: boolean; data: object[] }> {
    let q = this.supabase.db
      .from('attractions')
      .select('id, name, slug, country_id, city_id, destination_id, attraction_type')
      .eq('publish_status', true)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (country_id)    q = q.eq('country_id',    country_id);
    if (city_id)       q = q.eq('city_id',       city_id);
    if (destination_id) q = q.eq('destination_id', destination_id);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { success: true, data: data ?? [] };
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(
    dto: CreateAttractionDto,
    files: UploadedFiles,
  ): Promise<{ success: boolean; message: string; data: object }> {
    await this.validateRef('countries',    dto.country_id,    'name');
    await this.validateCityBelongsToCountry(dto.city_id, dto.country_id);
    await this.validateDestinationBelongsToCity(dto.destination_id, dto.city_id);
    await this.validateRef('modules',      dto.module_id,     'module_name');
    if (dto.collection_id) await this.validateRef('collections', dto.collection_id, 'name');

    const slug = dto.slug ?? this.generateSlug(dto.name);
    await this.assertUniqueSlug(slug);
    await this.assertUniqueName(dto.name, dto.destination_id);

    const [thumbnailUrl, bannerUrl, imageUrls] = await Promise.all([
      files?.thumbnail?.[0] ? this.uploadFile(files.thumbnail[0], 'attn-thumbnails', ALLOWED_MIME_TYPES) : Promise.resolve(null),
      files?.banner?.[0]    ? this.uploadFile(files.banner[0],    'attn-banners',    ALLOWED_MIME_TYPES) : Promise.resolve(null),
      files?.images?.length ? this.uploadMultiple(files.images,   'attn-images',     ALLOWED_MIME_TYPES) : Promise.resolve([]),
    ]);

    const { data: rawData, error } = await this.supabase.db
      .from('attractions')
      .insert({
        country_id:       dto.country_id,
        city_id:          dto.city_id,
        destination_id:   dto.destination_id,
        module_id:        dto.module_id,
        collection_id:    dto.collection_id    ?? null,
        name:             dto.name,
        slug,
        short_name:       dto.short_name       ?? null,
        attraction_type:  dto.attraction_type  ?? null,
        short_description: dto.short_description ?? null,
        description:      dto.description      ?? null,
        address:          dto.address          ?? null,
        latitude:         dto.latitude         ?? null,
        longitude:        dto.longitude        ?? null,
        google_map_url:   dto.google_map_url   ?? null,
        opening_time:     dto.opening_time     ?? null,
        closing_time:     dto.closing_time     ?? null,
        ticket_price:     dto.ticket_price     ?? null,
        currency:         dto.currency         ?? null,
        duration:         dto.duration         ?? null,
        contact_number:   dto.contact_number   ?? null,
        email:            dto.email            ?? null,
        featured:         dto.featured         ?? false,
        thumbnail:        thumbnailUrl,
        banner:           bannerUrl,
        images:           imageUrls.length ? JSON.stringify(imageUrls) : null,
        publish_status:   dto.publish_status,
      })
      .select(ATTN_DETAIL_FIELDS)
      .single();

    if (error) throw new Error(error.message);
    const data = rawData as Record<string, any>;

    const [enriched] = await this.enrichWithRelations([data]);
    return { success: true, message: 'Attraction created successfully.', data: enriched };
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(query: ListAttractionsDto) {
    const {
      page = 1, limit = 10, search,
      country_id, city_id, destination_id, module_id, collection_id,
      attraction_type, featured, publish_status,
      sortBy = 'created_at', sortOrder = 'DESC',
    } = query;

    const from = (page - 1) * limit;

    let dbQuery = this.supabase.db
      .from('attractions')
      .select(ATTN_LIST_FIELDS, { count: 'exact' })
      .is('deleted_at', null);

    if (search) {
      dbQuery = dbQuery.or(
        `name.ilike.%${search}%,slug.ilike.%${search}%,attraction_type.ilike.%${search}%,address.ilike.%${search}%,short_description.ilike.%${search}%`,
      );
    }
    if (country_id)                   dbQuery = dbQuery.eq('country_id',    country_id);
    if (city_id)                      dbQuery = dbQuery.eq('city_id',       city_id);
    if (destination_id)               dbQuery = dbQuery.eq('destination_id', destination_id);
    if (module_id)                    dbQuery = dbQuery.eq('module_id',     module_id);
    if (collection_id)                dbQuery = dbQuery.eq('collection_id', collection_id);
    if (attraction_type)              dbQuery = dbQuery.ilike('attraction_type', `%${attraction_type}%`);
    if (featured        !== undefined) dbQuery = dbQuery.eq('featured',       featured);
    if (publish_status  !== undefined) dbQuery = dbQuery.eq('publish_status', publish_status);

    const { data, error, count } = await dbQuery
      .order(sortBy, { ascending: sortOrder === 'ASC' })
      .range(from, from + limit - 1);

    if (error) throw new Error(error.message);

    const enriched = await this.enrichWithRelations(data ?? []);
    return { success: true, data: enriched, pagination: { page, limit, total: count ?? 0 } };
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const { data: rawData, error } = await this.supabase.db
      .from('attractions')
      .select(ATTN_DETAIL_FIELDS)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !rawData) throw new NotFoundException('Attraction not found.');
    const data = rawData as Record<string, any>;

    const [enriched] = await this.enrichWithRelations([data]);
    return { success: true, data: enriched };
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateAttractionDto,
    files: UploadedFiles,
  ): Promise<{ success: boolean; message: string; data: object }> {
    const { data: existing } = await this.supabase.db
      .from('attractions')
      .select('id, country_id, city_id, destination_id, images')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Attraction not found.');

    const effectiveCountryId     = dto.country_id     ?? existing.country_id;
    const effectiveCityId        = dto.city_id        ?? existing.city_id;
    const effectiveDestinationId = dto.destination_id ?? existing.destination_id;

    if (dto.country_id) await this.validateRef('countries', dto.country_id, 'name');
    if (dto.city_id || dto.country_id) {
      await this.validateCityBelongsToCountry(effectiveCityId, effectiveCountryId);
    }
    if (dto.destination_id || dto.city_id) {
      await this.validateDestinationBelongsToCity(effectiveDestinationId, effectiveCityId);
    }
    if (dto.module_id)     await this.validateRef('modules',     dto.module_id,     'module_name');
    if (dto.collection_id) await this.validateRef('collections', dto.collection_id, 'name');

    const updates: Record<string, any> = { ...dto, updated_at: new Date().toISOString() };

    if (dto.slug) {
      await this.assertUniqueSlug(dto.slug, id);
    } else if (dto.name) {
      updates.slug = this.generateSlug(dto.name);
    }

    if (dto.name) await this.assertUniqueName(dto.name, effectiveDestinationId, id);

    const [thumbnailUrl, bannerUrl] = await Promise.all([
      files?.thumbnail?.[0] ? this.uploadFile(files.thumbnail[0], 'attn-thumbnails', ALLOWED_MIME_TYPES) : Promise.resolve(null),
      files?.banner?.[0]    ? this.uploadFile(files.banner[0],    'attn-banners',    ALLOWED_MIME_TYPES) : Promise.resolve(null),
    ]);

    if (thumbnailUrl) updates.thumbnail = thumbnailUrl;
    if (bannerUrl)    updates.banner    = bannerUrl;

    if (files?.images?.length) {
      const newUrls  = await this.uploadMultiple(files.images, 'attn-images', ALLOWED_MIME_TYPES);
      const current  = this.parseImages(existing.images);
      updates.images = JSON.stringify([...current, ...newUrls]);
    }

    const { data: rawUpdated, error } = await this.supabase.db
      .from('attractions')
      .update(updates)
      .eq('id', id)
      .select(ATTN_DETAIL_FIELDS)
      .single();

    if (error) throw new Error(error.message);
    const updated = rawUpdated as Record<string, any>;

    const [enriched] = await this.enrichWithRelations([updated]);
    return { success: true, message: 'Attraction updated successfully.', data: enriched };
  }

  // ─── Delete (Soft) ───────────────────────────────────────────────────────────

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const { data: existing } = await this.supabase.db
      .from('attractions')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Attraction not found.');

    const { error } = await this.supabase.db
      .from('attractions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true, message: 'Attraction deleted successfully.' };
  }

  // ─── Gallery: Add Images ──────────────────────────────────────────────────────

  async addGalleryImages(
    id: string,
    files: Express.Multer.File[],
  ): Promise<{ success: boolean; message: string; data: { images: string[] } }> {
    const { data: existing } = await this.supabase.db
      .from('attractions')
      .select('id, images')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Attraction not found.');
    if (!files?.length) throw new UnprocessableEntityException('No images provided.');

    const newUrls = await this.uploadMultiple(files, 'attn-images', ALLOWED_MIME_TYPES);
    const current = this.parseImages(existing.images);
    const merged  = [...current, ...newUrls];

    const { error } = await this.supabase.db
      .from('attractions')
      .update({ images: JSON.stringify(merged), updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true, message: 'Gallery images added successfully.', data: { images: merged } };
  }

  // ─── Gallery: Remove Image ────────────────────────────────────────────────────

  async removeGalleryImage(
    id: string,
    imageUrl: string,
  ): Promise<{ success: boolean; message: string; data: { images: string[] } }> {
    const { data: existing } = await this.supabase.db
      .from('attractions')
      .select('id, images')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Attraction not found.');

    const images = this.parseImages(existing.images).filter(url => url !== imageUrl);

    const { error } = await this.supabase.db
      .from('attractions')
      .update({
        images:     images.length ? JSON.stringify(images) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true, message: 'Gallery image removed successfully.', data: { images } };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private parseImages(raw: string | null): string[] {
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  private async assertUniqueSlug(slug: string, excludeId?: string) {
    let q = this.supabase.db
      .from('attractions')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q.maybeSingle();
    if (data) throw new ConflictException('An attraction with this slug already exists.');
  }

  private async assertUniqueName(name: string, destination_id: string, excludeId?: string) {
    let q = this.supabase.db
      .from('attractions')
      .select('id')
      .eq('name', name)
      .eq('destination_id', destination_id)
      .is('deleted_at', null);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q.maybeSingle();
    if (data) throw new ConflictException('An attraction with this name already exists in this destination.');
  }

  private async validateCityBelongsToCountry(city_id: string, country_id: string) {
    const { data } = await this.supabase.db
      .from('cities')
      .select('id')
      .eq('id', city_id)
      .eq('country_id', country_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!data) throw new NotFoundException('City not found or does not belong to the selected country.');
  }

  private async validateDestinationBelongsToCity(destination_id: string, city_id: string) {
    const { data } = await this.supabase.db
      .from('destinations')
      .select('id')
      .eq('id', destination_id)
      .eq('city_id', city_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!data) throw new NotFoundException('Destination not found or does not belong to the selected city.');
  }

  private async validateRef(table: string, id: string, _labelField: string) {
    const { data } = await (this.supabase.db as any)
      .from(table)
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (!data) throw new NotFoundException(`${table.replace(/_/g, ' ').replace(/s$/, '')} not found.`);
  }

  private async uploadFile(
    file: Express.Multer.File,
    folder: string,
    allowedTypes: string[],
  ): Promise<string> {
    if (!allowedTypes.includes(file.mimetype)) {
      throw new UnprocessableEntityException(
        `Invalid file type "${file.mimetype}". Allowed: ${allowedTypes.join(', ')}.`,
      );
    }
    const ext    = file.originalname.split('.').pop() ?? 'jpg';
    const path   = `${folder}/${Date.now()}-${randomUUID()}.${ext}`;
    const bucket = process.env.STORAGE_BUCKET!;

    const { data, error } = await this.supabase.db.storage
      .from(bucket)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

    if (error) throw new Error(`File upload failed: ${error.message}`);

    const { data: { publicUrl } } = this.supabase.db.storage.from(bucket).getPublicUrl(data.path);
    return publicUrl;
  }

  private async uploadMultiple(
    files: Express.Multer.File[],
    folder: string,
    allowedTypes: string[],
  ): Promise<string[]> {
    return Promise.all(files.map(f => this.uploadFile(f, folder, allowedTypes)));
  }

  private async enrichWithRelations(records: any[]) {
    if (!records.length) return records;

    const pick = (arr: any[], key: string) => [...new Set(arr.filter(r => r[key]).map(r => r[key]))];

    const countryIds     = pick(records, 'country_id');
    const cityIds        = pick(records, 'city_id');
    const destIds        = pick(records, 'destination_id');
    const moduleIds      = pick(records, 'module_id');
    const collectionIds  = pick(records, 'collection_id');

    const [countriesRes, citiesRes, destRes, modulesRes, collectionsRes] = await Promise.all([
      countryIds.length    ? this.supabase.db.from('countries').select('id, name, iso2').in('id', countryIds)                                                              : { data: [] },
      cityIds.length       ? this.supabase.db.from('cities').select('id, name, slug').in('id', cityIds)                                                                    : { data: [] },
      destIds.length       ? this.supabase.db.from('destinations').select('id, name, slug').in('id', destIds).is('deleted_at', null)                                       : { data: [] },
      moduleIds.length     ? this.supabase.db.from('modules').select('id, module_name').in('id', moduleIds)                                                                : { data: [] },
      collectionIds.length ? this.supabase.db.from('collections').select('id, name, slug').in('id', collectionIds).is('deleted_at', null)                                  : { data: [] },
    ]);

    const countryMap    = Object.fromEntries((countriesRes.data    ?? []).map((c: any) => [c.id, { id: c.id, name: c.name, iso2: c.iso2 }]));
    const cityMap       = Object.fromEntries((citiesRes.data       ?? []).map((c: any) => [c.id, { id: c.id, name: c.name, slug: c.slug }]));
    const destMap       = Object.fromEntries((destRes.data         ?? []).map((d: any) => [d.id, { id: d.id, name: d.name, slug: d.slug }]));
    const moduleMap     = Object.fromEntries((modulesRes.data      ?? []).map((m: any) => [m.id, { id: m.id, name: m.module_name }]));
    const collectionMap = Object.fromEntries((collectionsRes.data  ?? []).map((c: any) => [c.id, { id: c.id, name: c.name, slug: c.slug }]));

    return records.map(r => ({
      ...r,
      images:      this.parseImages(r.images),
      country:     r.country_id     ? (countryMap[r.country_id]         ?? null) : null,
      city:        r.city_id        ? (cityMap[r.city_id]               ?? null) : null,
      destination: r.destination_id ? (destMap[r.destination_id]        ?? null) : null,
      module:      r.module_id      ? (moduleMap[r.module_id]           ?? null) : null,
      collection:  r.collection_id  ? (collectionMap[r.collection_id]   ?? null) : null,
    }));
  }
}
