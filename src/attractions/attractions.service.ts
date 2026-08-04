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
