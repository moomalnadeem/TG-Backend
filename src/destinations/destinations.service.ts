import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { ListDestinationsDto } from './dto/list-destinations.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';

const ALLOWED_MIME_TYPES      = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_FLAG_MIME_TYPES = [...ALLOWED_MIME_TYPES, 'image/svg+xml'];

type UploadedFiles = {
  flag_image?: Express.Multer.File[];
  thumbnail?:  Express.Multer.File[];
  banner?:     Express.Multer.File[];
  images?:     Express.Multer.File[];
};

const SETUP_SQL = `
  CREATE TABLE IF NOT EXISTS destinations (
    id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    country_id        UUID           NOT NULL,
    city_id           UUID           NOT NULL,
    module_id         UUID           NOT NULL,
    language_id       UUID,
    seo_id            UUID,
    category_id       UUID,
    name              VARCHAR(255)   NOT NULL,
    slug              VARCHAR(255)   NOT NULL,
    short_name        VARCHAR(150),
    short_description TEXT,
    description       TEXT,
    address           VARCHAR(500),
    latitude          NUMERIC(10,8),
    longitude         NUMERIC(11,8),
    map_url           VARCHAR(1000),
    opening_time      VARCHAR(10),
    closing_time      VARCHAR(10),
    ticket_price      NUMERIC(10,2),
    currency          VARCHAR(10),
    duration          VARCHAR(100),
    contact_number    VARCHAR(30),
    email             VARCHAR(255),
    website           VARCHAR(500),
    featured          BOOLEAN        NOT NULL DEFAULT false,
    flag_image        VARCHAR(500),
    thumbnail         VARCHAR(500),
    banner            VARCHAR(500),
    images            TEXT,
    publish_status    BOOLEAN        NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
  );
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS country_id        UUID;
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS city_id           UUID;
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS module_id         UUID;
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS language_id       UUID;
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS seo_id            UUID;
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS category_id       UUID;
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS short_name        VARCHAR(150);
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS short_description TEXT;
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS description       TEXT;
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS address           VARCHAR(500);
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS latitude          NUMERIC(10,8);
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS longitude         NUMERIC(11,8);
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS map_url           VARCHAR(1000);
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS opening_time      VARCHAR(10);
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS closing_time      VARCHAR(10);
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS ticket_price      NUMERIC(10,2);
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS currency          VARCHAR(10);
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS duration          VARCHAR(100);
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS contact_number    VARCHAR(30);
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS email             VARCHAR(255);
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS website           VARCHAR(500);
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS featured          BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS flag_image        VARCHAR(500);
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS thumbnail         VARCHAR(500);
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS banner            VARCHAR(500);
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS images            TEXT;
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS publish_status    BOOLEAN NOT NULL DEFAULT true;
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE destinations ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_dest_slug           ON destinations(slug)              WHERE deleted_at IS NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_dest_name_city      ON destinations(name, city_id)     WHERE deleted_at IS NULL;
  CREATE INDEX        IF NOT EXISTS idx_dest_country_id     ON destinations(country_id);
  CREATE INDEX        IF NOT EXISTS idx_dest_city_id        ON destinations(city_id);
  CREATE INDEX        IF NOT EXISTS idx_dest_module_id      ON destinations(module_id);
  CREATE INDEX        IF NOT EXISTS idx_dest_language_id    ON destinations(language_id);
  CREATE INDEX        IF NOT EXISTS idx_dest_category_id    ON destinations(category_id);
  CREATE INDEX        IF NOT EXISTS idx_dest_featured       ON destinations(featured);
  CREATE INDEX        IF NOT EXISTS idx_dest_publish_status ON destinations(publish_status);
  CREATE INDEX        IF NOT EXISTS idx_dest_deleted_at     ON destinations(deleted_at);
  SELECT pg_notify('pgrst', 'reload schema');
`;

const DEST_LIST_FIELDS = [
  'id', 'country_id', 'city_id', 'module_id', 'language_id', 'category_id',
  'name', 'slug', 'short_name', 'thumbnail', 'flag_image',
  'ticket_price', 'currency', 'featured', 'publish_status', 'created_at',
].join(', ');

const DEST_DETAIL_FIELDS = [
  'id', 'country_id', 'city_id', 'module_id', 'language_id', 'seo_id', 'category_id',
  'name', 'slug', 'short_name', 'short_description', 'description',
  'address', 'latitude', 'longitude', 'map_url',
  'opening_time', 'closing_time', 'ticket_price', 'currency', 'duration',
  'contact_number', 'email', 'website',
  'featured', 'flag_image', 'thumbnail', 'banner', 'images',
  'publish_status', 'created_at', 'updated_at',
].join(', ');

@Injectable()
export class DestinationsService {
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

    return { success: true, message: 'Destinations table migrated successfully.' };
  }

  // ─── Dropdown ────────────────────────────────────────────────────────────────

  async dropdown(country_id?: string, city_id?: string): Promise<{ success: boolean; data: object[] }> {
    let q = this.supabase.db
      .from('destinations')
      .select('id, name, slug, country_id, city_id')
      .eq('publish_status', true)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (country_id) q = q.eq('country_id', country_id);
    if (city_id)    q = q.eq('city_id',    city_id);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { success: true, data: data ?? [] };
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(
    dto: CreateDestinationDto,
    files: UploadedFiles,
  ): Promise<{ success: boolean; message: string; data: object }> {
    await this.validateRef('countries', dto.country_id, 'name');
    await this.validateCityBelongsToCountry(dto.city_id, dto.country_id);
    await this.validateRef('modules', dto.module_id, 'module_name');
    if (dto.language_id) await this.validateRef('languages', dto.language_id, 'name');
    if (dto.seo_id)      await this.validateSeoRef(dto.seo_id);
    if (dto.category_id) await this.validateRef('destination_categories', dto.category_id, 'name');

    const slug = dto.slug ?? this.generateSlug(dto.name);
    await this.assertUniqueSlug(slug);
    await this.assertUniqueName(dto.name, dto.city_id);

    const [flagUrl, thumbnailUrl, bannerUrl, imageUrls] = await Promise.all([
      files?.flag_image?.[0] ? this.uploadFile(files.flag_image[0], 'dest-flags',      ALLOWED_FLAG_MIME_TYPES) : Promise.resolve(null),
      files?.thumbnail?.[0]  ? this.uploadFile(files.thumbnail[0],  'dest-thumbnails', ALLOWED_MIME_TYPES)      : Promise.resolve(null),
      files?.banner?.[0]     ? this.uploadFile(files.banner[0],     'dest-banners',    ALLOWED_MIME_TYPES)      : Promise.resolve(null),
      files?.images?.length  ? this.uploadMultiple(files.images,    'dest-images',     ALLOWED_MIME_TYPES)      : Promise.resolve([]),
    ]);

    const { data, error } = await this.supabase.db
      .from('destinations')
      .insert({
        country_id:        dto.country_id,
        city_id:           dto.city_id,
        module_id:         dto.module_id,
        language_id:       dto.language_id       ?? null,
        seo_id:            dto.seo_id            ?? null,
        category_id:       dto.category_id       ?? null,
        name:              dto.name,
        slug,
        short_name:        dto.short_name        ?? null,
        short_description: dto.short_description ?? null,
        description:       dto.description       ?? null,
        address:           dto.address           ?? null,
        latitude:          dto.latitude          ?? null,
        longitude:         dto.longitude         ?? null,
        map_url:           dto.map_url           ?? null,
        opening_time:      dto.opening_time      ?? null,
        closing_time:      dto.closing_time      ?? null,
        ticket_price:      dto.ticket_price      ?? null,
        currency:          dto.currency          ?? null,
        duration:          dto.duration          ?? null,
        contact_number:    dto.contact_number    ?? null,
        email:             dto.email             ?? null,
        website:           dto.website           ?? null,
        featured:          dto.featured,
        flag_image:        flagUrl,
        thumbnail:         thumbnailUrl,
        banner:            bannerUrl,
        images:            imageUrls.length ? JSON.stringify(imageUrls) : null,
        publish_status:    dto.publish_status,
      })
      .select(DEST_DETAIL_FIELDS)
      .single();

    if (error) throw new Error(error.message);

    const [enriched] = await this.enrichWithRelations([data]);
    return { success: true, message: 'Destination created successfully.', data: enriched };
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(query: ListDestinationsDto) {
    const {
      page = 1, limit = 10, search,
      country_id, city_id, module_id, language_id, category_id,
      featured, publish_status,
      sortBy = 'created_at', sortOrder = 'DESC',
    } = query;

    const from = (page - 1) * limit;

    let dbQuery = this.supabase.db
      .from('destinations')
      .select(DEST_LIST_FIELDS, { count: 'exact' })
      .is('deleted_at', null);

    if (search) {
      dbQuery = dbQuery.or(
        `name.ilike.%${search}%,slug.ilike.%${search}%,short_name.ilike.%${search}%,address.ilike.%${search}%`,
      );
    }
    if (country_id)                   dbQuery = dbQuery.eq('country_id',     country_id);
    if (city_id)                      dbQuery = dbQuery.eq('city_id',        city_id);
    if (module_id)                    dbQuery = dbQuery.eq('module_id',      module_id);
    if (language_id)                  dbQuery = dbQuery.eq('language_id',    language_id);
    if (category_id)                  dbQuery = dbQuery.eq('category_id',    category_id);
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
    const { data, error } = await this.supabase.db
      .from('destinations')
      .select(DEST_DETAIL_FIELDS)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) throw new NotFoundException('Destination not found.');

    const [enriched] = await this.enrichWithRelations([data]);
    return { success: true, data: enriched };
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateDestinationDto,
    files: UploadedFiles,
  ): Promise<{ success: boolean; message: string; data: object }> {
    const { data: existing } = await this.supabase.db
      .from('destinations')
      .select('id, country_id, city_id, images')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Destination not found.');

    const effectiveCountryId = dto.country_id ?? existing.country_id;
    const effectiveCityId    = dto.city_id    ?? existing.city_id;

    if (dto.country_id) await this.validateRef('countries', dto.country_id, 'name');
    if (dto.city_id || dto.country_id) {
      await this.validateCityBelongsToCountry(effectiveCityId, effectiveCountryId);
    }
    if (dto.module_id)   await this.validateRef('modules',   dto.module_id,   'module_name');
    if (dto.language_id) await this.validateRef('languages', dto.language_id, 'name');
    if (dto.seo_id)      await this.validateSeoRef(dto.seo_id);
    if (dto.category_id) await this.validateRef('destination_categories', dto.category_id, 'name');

    const updates: Record<string, any> = { ...dto, updated_at: new Date().toISOString() };

    if (dto.slug) {
      await this.assertUniqueSlug(dto.slug, id);
    } else if (dto.name) {
      updates.slug = this.generateSlug(dto.name);
    }

    if (dto.name) await this.assertUniqueName(dto.name, effectiveCityId, id);

    const [flagUrl, thumbnailUrl, bannerUrl] = await Promise.all([
      files?.flag_image?.[0] ? this.uploadFile(files.flag_image[0], 'dest-flags',      ALLOWED_FLAG_MIME_TYPES) : Promise.resolve(null),
      files?.thumbnail?.[0]  ? this.uploadFile(files.thumbnail[0],  'dest-thumbnails', ALLOWED_MIME_TYPES)      : Promise.resolve(null),
      files?.banner?.[0]     ? this.uploadFile(files.banner[0],     'dest-banners',    ALLOWED_MIME_TYPES)      : Promise.resolve(null),
    ]);

    if (flagUrl)      updates.flag_image = flagUrl;
    if (thumbnailUrl) updates.thumbnail  = thumbnailUrl;
    if (bannerUrl)    updates.banner     = bannerUrl;

    if (files?.images?.length) {
      const newUrls  = await this.uploadMultiple(files.images, 'dest-images', ALLOWED_MIME_TYPES);
      const current  = this.parseImages(existing.images);
      updates.images = JSON.stringify([...current, ...newUrls]);
    }

    const { data: updated, error } = await this.supabase.db
      .from('destinations')
      .update(updates)
      .eq('id', id)
      .select(DEST_DETAIL_FIELDS)
      .single();

    if (error) throw new Error(error.message);

    const [enriched] = await this.enrichWithRelations([updated]);
    return { success: true, message: 'Destination updated successfully.', data: enriched };
  }

  // ─── Delete (Soft) ───────────────────────────────────────────────────────────

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const { data: existing } = await this.supabase.db
      .from('destinations')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Destination not found.');

    const { error } = await this.supabase.db
      .from('destinations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true, message: 'Destination deleted successfully.' };
  }

  // ─── Gallery: Add Images ──────────────────────────────────────────────────────

  async addGalleryImages(
    id: string,
    files: Express.Multer.File[],
  ): Promise<{ success: boolean; message: string; data: { images: string[] } }> {
    const { data: existing } = await this.supabase.db
      .from('destinations')
      .select('id, images')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Destination not found.');
    if (!files?.length) throw new UnprocessableEntityException('No images provided.');

    const newUrls = await this.uploadMultiple(files, 'dest-images', ALLOWED_MIME_TYPES);
    const current = this.parseImages(existing.images);
    const merged  = [...current, ...newUrls];

    const { error } = await this.supabase.db
      .from('destinations')
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
      .from('destinations')
      .select('id, images')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Destination not found.');

    const images = this.parseImages(existing.images).filter(url => url !== imageUrl);

    const { error } = await this.supabase.db
      .from('destinations')
      .update({
        images: images.length ? JSON.stringify(images) : null,
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
      .from('destinations')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q.maybeSingle();
    if (data) throw new ConflictException('A destination with this slug already exists.');
  }

  private async assertUniqueName(name: string, city_id: string, excludeId?: string) {
    let q = this.supabase.db
      .from('destinations')
      .select('id')
      .eq('name', name)
      .eq('city_id', city_id)
      .is('deleted_at', null);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q.maybeSingle();
    if (data) throw new ConflictException('A destination with this name already exists in this city.');
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

  private async validateRef(table: string, id: string, _labelField: string) {
    const { data } = await (this.supabase.db as any)
      .from(table)
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (!data) throw new NotFoundException(`${table.replace(/_/g, ' ').replace(/s$/, '')} not found.`);
  }

  private async validateSeoRef(id: string) {
    const { data } = await this.supabase.db
      .from('seo')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (!data) throw new NotFoundException('SEO record not found.');
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

    const countryIds  = pick(records, 'country_id');
    const cityIds     = pick(records, 'city_id');
    const moduleIds   = pick(records, 'module_id');
    const languageIds = pick(records, 'language_id');
    const categoryIds = pick(records, 'category_id');

    const [countriesRes, citiesRes, modulesRes, languagesRes, categoriesRes] = await Promise.all([
      countryIds.length  ? this.supabase.db.from('countries').select('id, name, iso2').in('id', countryIds)                        : { data: [] },
      cityIds.length     ? this.supabase.db.from('cities').select('id, name, slug').in('id', cityIds)                              : { data: [] },
      moduleIds.length   ? this.supabase.db.from('modules').select('id, module_name').in('id', moduleIds)                          : { data: [] },
      languageIds.length ? this.supabase.db.from('languages').select('id, name, code').in('id', languageIds)                       : { data: [] },
      categoryIds.length ? this.supabase.db.from('destination_categories').select('id, name').in('id', categoryIds).catch(() => ({ data: [] })) : { data: [] },
    ]);

    const countryMap  = Object.fromEntries((countriesRes.data   ?? []).map((c: any) => [c.id, { id: c.id, name: c.name, iso2: c.iso2 }]));
    const cityMap     = Object.fromEntries((citiesRes.data      ?? []).map((c: any) => [c.id, { id: c.id, name: c.name, slug: c.slug }]));
    const moduleMap   = Object.fromEntries((modulesRes.data     ?? []).map((m: any) => [m.id, { id: m.id, name: m.module_name }]));
    const languageMap = Object.fromEntries((languagesRes.data   ?? []).map((l: any) => [l.id, { id: l.id, name: l.name, code: l.code }]));
    const categoryMap = Object.fromEntries((categoriesRes.data  ?? []).map((c: any) => [c.id, { id: c.id, name: c.name }]));

    return records.map(r => ({
      ...r,
      images:   this.parseImages(r.images),
      country:  r.country_id  ? (countryMap[r.country_id]   ?? null) : null,
      city:     r.city_id     ? (cityMap[r.city_id]         ?? null) : null,
      module:   r.module_id   ? (moduleMap[r.module_id]     ?? null) : null,
      language: r.language_id ? (languageMap[r.language_id] ?? null) : null,
      category: r.category_id ? (categoryMap[r.category_id] ?? null) : null,
    }));
  }
}
