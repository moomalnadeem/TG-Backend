import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCityDto } from './dto/create-city.dto';
import { ListCitiesDto } from './dto/list-cities.dto';
import { UpdateCityDto } from './dto/update-city.dto';

const ALLOWED_MIME_TYPES     = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_FLAG_MIME_TYPES = [...ALLOWED_MIME_TYPES, 'image/svg+xml'];

type UploadedFiles = {
  flag_image?: Express.Multer.File[];
  thumbnail?:  Express.Multer.File[];
  banner?:     Express.Multer.File[];
  images?:     Express.Multer.File[];
};

const SETUP_SQL = `
  CREATE TABLE IF NOT EXISTS cities (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    country_id     UUID         NOT NULL,
    module_id      UUID         NOT NULL,
    language_id    UUID,
    seo_id         UUID,
    name           VARCHAR(255) NOT NULL,
    slug           VARCHAR(255) NOT NULL,
    short_name     VARCHAR(100),
    code           VARCHAR(20),
    flag_image     VARCHAR(500),
    thumbnail      VARCHAR(500),
    banner         VARCHAR(500),
    images         TEXT,
    description    TEXT,
    publish_status BOOLEAN      NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at     TIMESTAMPTZ
  );
  ALTER TABLE cities ADD COLUMN IF NOT EXISTS country_id     UUID;
  ALTER TABLE cities ADD COLUMN IF NOT EXISTS module_id      UUID;
  ALTER TABLE cities ADD COLUMN IF NOT EXISTS language_id    UUID;
  ALTER TABLE cities ADD COLUMN IF NOT EXISTS seo_id         UUID;
  ALTER TABLE cities ADD COLUMN IF NOT EXISTS short_name     VARCHAR(100);
  ALTER TABLE cities ADD COLUMN IF NOT EXISTS code           VARCHAR(20);
  ALTER TABLE cities ADD COLUMN IF NOT EXISTS flag_image     VARCHAR(500);
  ALTER TABLE cities ADD COLUMN IF NOT EXISTS thumbnail      VARCHAR(500);
  ALTER TABLE cities ADD COLUMN IF NOT EXISTS banner         VARCHAR(500);
  ALTER TABLE cities ADD COLUMN IF NOT EXISTS images         TEXT;
  ALTER TABLE cities ADD COLUMN IF NOT EXISTS description    TEXT;
  ALTER TABLE cities ADD COLUMN IF NOT EXISTS publish_status BOOLEAN NOT NULL DEFAULT true;
  ALTER TABLE cities ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE cities ADD COLUMN IF NOT EXISTS deleted_at     TIMESTAMPTZ;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_cities_slug           ON cities(slug)                      WHERE deleted_at IS NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_cities_name_country   ON cities(name, country_id)          WHERE deleted_at IS NULL;
  CREATE INDEX        IF NOT EXISTS idx_cities_country_id     ON cities(country_id);
  CREATE INDEX        IF NOT EXISTS idx_cities_module_id      ON cities(module_id);
  CREATE INDEX        IF NOT EXISTS idx_cities_language_id    ON cities(language_id);
  CREATE INDEX        IF NOT EXISTS idx_cities_publish_status ON cities(publish_status);
  CREATE INDEX        IF NOT EXISTS idx_cities_deleted_at     ON cities(deleted_at);
  SELECT pg_notify('pgrst', 'reload schema');
`;

const CITY_LIST_FIELDS   = 'id, country_id, module_id, language_id, name, slug, short_name, code, flag_image, thumbnail, publish_status, created_at';
const CITY_DETAIL_FIELDS = 'id, country_id, module_id, language_id, seo_id, name, slug, short_name, code, flag_image, thumbnail, banner, images, description, publish_status, created_at, updated_at';

@Injectable()
export class CitiesService {
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

    return { success: true, message: 'Cities table migrated successfully.' };
  }

  // ─── Dropdown ────────────────────────────────────────────────────────────────

  async dropdown(country_id?: string): Promise<{ success: boolean; data: object[] }> {
    let q = this.supabase.db
      .from('cities')
      .select('id, name, slug, country_id')
      .eq('publish_status', true)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (country_id) q = q.eq('country_id', country_id);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { success: true, data: data ?? [] };
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(
    dto: CreateCityDto,
    files: UploadedFiles,
  ): Promise<{ success: boolean; message: string; data: object }> {
    await this.validateRef('countries', dto.country_id, 'name');
    await this.validateRef('modules',   dto.module_id,  'module_name');
    if (dto.language_id) await this.validateRef('languages', dto.language_id, 'name');
    if (dto.seo_id)      await this.validateSeoRef(dto.seo_id);

    const slug = dto.slug ?? this.generateSlug(dto.name);
    await this.assertUniqueSlug(slug);
    await this.assertUniqueName(dto.name, dto.country_id);

    const [flagUrl, thumbnailUrl, bannerUrl, imageUrls] = await Promise.all([
      files?.flag_image?.[0] ? this.uploadFile(files.flag_image[0], 'city-flags',      ALLOWED_FLAG_MIME_TYPES) : Promise.resolve(null),
      files?.thumbnail?.[0]  ? this.uploadFile(files.thumbnail[0],  'city-thumbnails', ALLOWED_MIME_TYPES)      : Promise.resolve(null),
      files?.banner?.[0]     ? this.uploadFile(files.banner[0],     'city-banners',    ALLOWED_MIME_TYPES)      : Promise.resolve(null),
      files?.images?.length  ? this.uploadMultiple(files.images,    'city-images',     ALLOWED_MIME_TYPES)      : Promise.resolve([]),
    ]);

    const { data, error } = await this.supabase.db
      .from('cities')
      .insert({
        country_id:     dto.country_id,
        module_id:      dto.module_id,
        language_id:    dto.language_id    ?? null,
        seo_id:         dto.seo_id         ?? null,
        name:           dto.name,
        slug,
        short_name:     dto.short_name     ?? null,
        code:           dto.code           ?? null,
        flag_image:     flagUrl,
        thumbnail:      thumbnailUrl,
        banner:         bannerUrl,
        images:         imageUrls.length ? JSON.stringify(imageUrls) : null,
        description:    dto.description    ?? null,
        publish_status: dto.publish_status,
      })
      .select(CITY_DETAIL_FIELDS)
      .single();

    if (error) throw new Error(error.message);

    const [enriched] = await this.enrichWithRelations([data]);
    return { success: true, message: 'City created successfully.', data: enriched };
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(query: ListCitiesDto) {
    const {
      page = 1, limit = 10, search,
      country_id, module_id, language_id, publish_status,
      sortBy = 'created_at', sortOrder = 'DESC',
    } = query;

    const from = (page - 1) * limit;

    let dbQuery = this.supabase.db
      .from('cities')
      .select(CITY_LIST_FIELDS, { count: 'exact' })
      .is('deleted_at', null);

    if (search) {
      dbQuery = dbQuery.or(
        `name.ilike.%${search}%,slug.ilike.%${search}%,short_name.ilike.%${search}%,code.ilike.%${search}%`,
      );
    }
    if (country_id)                   dbQuery = dbQuery.eq('country_id',     country_id);
    if (module_id)                    dbQuery = dbQuery.eq('module_id',      module_id);
    if (language_id)                  dbQuery = dbQuery.eq('language_id',    language_id);
    if (publish_status !== undefined) dbQuery = dbQuery.eq('publish_status', publish_status);

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
      .from('cities')
      .select(CITY_DETAIL_FIELDS)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) throw new NotFoundException('City not found.');

    const [enriched] = await this.enrichWithRelations([data]);
    return { success: true, data: enriched };
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateCityDto,
    files: UploadedFiles,
  ): Promise<{ success: boolean; message: string; data: object }> {
    const { data: existing } = await this.supabase.db
      .from('cities')
      .select('id, country_id, images')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('City not found.');

    if (dto.country_id)  await this.validateRef('countries', dto.country_id, 'name');
    if (dto.module_id)   await this.validateRef('modules',   dto.module_id,  'module_name');
    if (dto.language_id) await this.validateRef('languages', dto.language_id, 'name');
    if (dto.seo_id)      await this.validateSeoRef(dto.seo_id);

    const updates: Record<string, any> = { ...dto, updated_at: new Date().toISOString() };

    if (dto.slug) {
      await this.assertUniqueSlug(dto.slug, id);
    } else if (dto.name) {
      updates.slug = this.generateSlug(dto.name);
    }

    const effectiveCountryId = dto.country_id ?? existing.country_id;
    if (dto.name) await this.assertUniqueName(dto.name, effectiveCountryId, id);

    const [flagUrl, thumbnailUrl, bannerUrl] = await Promise.all([
      files?.flag_image?.[0] ? this.uploadFile(files.flag_image[0], 'city-flags',      ALLOWED_FLAG_MIME_TYPES) : Promise.resolve(null),
      files?.thumbnail?.[0]  ? this.uploadFile(files.thumbnail[0],  'city-thumbnails', ALLOWED_MIME_TYPES)      : Promise.resolve(null),
      files?.banner?.[0]     ? this.uploadFile(files.banner[0],     'city-banners',    ALLOWED_MIME_TYPES)      : Promise.resolve(null),
    ]);

    if (flagUrl)      updates.flag_image = flagUrl;
    if (thumbnailUrl) updates.thumbnail  = thumbnailUrl;
    if (bannerUrl)    updates.banner     = bannerUrl;

    if (files?.images?.length) {
      const newUrls  = await this.uploadMultiple(files.images, 'city-images', ALLOWED_MIME_TYPES);
      const current  = this.parseImages(existing.images);
      updates.images = JSON.stringify([...current, ...newUrls]);
    }

    const { data: updated, error } = await this.supabase.db
      .from('cities')
      .update(updates)
      .eq('id', id)
      .select(CITY_DETAIL_FIELDS)
      .single();

    if (error) throw new Error(error.message);

    const [enriched] = await this.enrichWithRelations([updated]);
    return { success: true, message: 'City updated successfully.', data: enriched };
  }

  // ─── Delete (Soft) ───────────────────────────────────────────────────────────

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const { data: existing } = await this.supabase.db
      .from('cities')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('City not found.');

    const { error } = await this.supabase.db
      .from('cities')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true, message: 'City deleted successfully.' };
  }

  // ─── Gallery: Add Images ──────────────────────────────────────────────────────

  async addGalleryImages(
    id: string,
    files: Express.Multer.File[],
  ): Promise<{ success: boolean; message: string; data: { images: string[] } }> {
    const { data: existing } = await this.supabase.db
      .from('cities')
      .select('id, images')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('City not found.');
    if (!files?.length) throw new UnprocessableEntityException('No images provided.');

    const newUrls = await this.uploadMultiple(files, 'city-images', ALLOWED_MIME_TYPES);
    const current = this.parseImages(existing.images);
    const merged  = [...current, ...newUrls];

    const { error } = await this.supabase.db
      .from('cities')
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
      .from('cities')
      .select('id, images')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('City not found.');

    const images = this.parseImages(existing.images).filter(url => url !== imageUrl);

    const { error } = await this.supabase.db
      .from('cities')
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
      .from('cities')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q.maybeSingle();
    if (data) throw new ConflictException('A city with this slug already exists.');
  }

  private async assertUniqueName(name: string, country_id: string, excludeId?: string) {
    let q = this.supabase.db
      .from('cities')
      .select('id')
      .eq('name', name)
      .eq('country_id', country_id)
      .is('deleted_at', null);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q.maybeSingle();
    if (data) throw new ConflictException('A city with this name already exists in this country.');
  }

  private async validateRef(table: string, id: string, _labelField: string) {
    const { data } = await (this.supabase.db as any)
      .from(table)
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (!data) throw new NotFoundException(`${table.slice(0, -1)} not found.`);
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
    const moduleIds   = pick(records, 'module_id');
    const languageIds = pick(records, 'language_id');

    const [countriesRes, modulesRes, languagesRes] = await Promise.all([
      countryIds.length  ? this.supabase.db.from('countries').select('id, name, iso2').in('id', countryIds)           : { data: [] },
      moduleIds.length   ? this.supabase.db.from('modules').select('id, module_name').in('id', moduleIds)             : { data: [] },
      languageIds.length ? this.supabase.db.from('languages').select('id, name, code').in('id', languageIds)          : { data: [] },
    ]);

    const countryMap  = Object.fromEntries((countriesRes.data  ?? []).map((c: any) => [c.id, { id: c.id, name: c.name, iso2: c.iso2 }]));
    const moduleMap   = Object.fromEntries((modulesRes.data    ?? []).map((m: any) => [m.id, { id: m.id, name: m.module_name }]));
    const languageMap = Object.fromEntries((languagesRes.data  ?? []).map((l: any) => [l.id, { id: l.id, name: l.name, code: l.code }]));

    return records.map(r => ({
      ...r,
      images:   this.parseImages(r.images),
      country:  r.country_id  ? (countryMap[r.country_id]   ?? null) : null,
      module:   r.module_id   ? (moduleMap[r.module_id]     ?? null) : null,
      language: r.language_id ? (languageMap[r.language_id] ?? null) : null,
    }));
  }
}
