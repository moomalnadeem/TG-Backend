import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCountryDto } from './dto/create-country.dto';
import { ListCountriesDto } from './dto/list-countries.dto';
import { UpdateCountryDto } from './dto/update-country.dto';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

type UploadedFiles = {
  flag_image?: Express.Multer.File[];
  thumbnail?:  Express.Multer.File[];
  banner?:     Express.Multer.File[];
  images?:     Express.Multer.File[];
};

const SETUP_SQL = `
  CREATE TABLE IF NOT EXISTS countries (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id      UUID,
    language_id    UUID,
    seo_id         UUID,
    name           VARCHAR(255) NOT NULL,
    iso2           VARCHAR(2),
    iso3           VARCHAR(3),
    phone_code     VARCHAR(10),
    currency       VARCHAR(50),
    currency_code  VARCHAR(10),
    capital        VARCHAR(100),
    continent      VARCHAR(100),
    nationality    VARCHAR(100),
    timezone       VARCHAR(100),
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
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS module_id      UUID;
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS language_id    UUID;
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS seo_id         UUID;
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS iso2           VARCHAR(2);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS iso3           VARCHAR(3);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS phone_code     VARCHAR(10);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS currency       VARCHAR(50);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS currency_code  VARCHAR(10);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS capital        VARCHAR(100);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS continent      VARCHAR(100);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS nationality    VARCHAR(100);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS timezone       VARCHAR(100);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS flag_image     VARCHAR(500);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS thumbnail      VARCHAR(500);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS banner         VARCHAR(500);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS images         TEXT;
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS description    TEXT;
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS publish_status BOOLEAN NOT NULL DEFAULT true;
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS deleted_at     TIMESTAMPTZ;
  CREATE INDEX IF NOT EXISTS idx_countries_module_id   ON countries(module_id);
  CREATE INDEX IF NOT EXISTS idx_countries_language_id ON countries(language_id);
  CREATE INDEX IF NOT EXISTS idx_countries_continent   ON countries(continent);
  CREATE INDEX IF NOT EXISTS idx_countries_iso2        ON countries(iso2);
  CREATE INDEX IF NOT EXISTS idx_countries_publish     ON countries(publish_status);
  CREATE INDEX IF NOT EXISTS idx_countries_deleted_at  ON countries(deleted_at);
  SELECT pg_notify('pgrst', 'reload schema');
`;

const COUNTRY_LIST_FIELDS   = 'id, module_id, language_id, name, iso2, iso3, phone_code, currency_code, capital, continent, flag_image, thumbnail, publish_status, created_at';
const COUNTRY_DETAIL_FIELDS = 'id, module_id, language_id, seo_id, name, iso2, iso3, phone_code, currency, currency_code, capital, continent, nationality, timezone, flag_image, thumbnail, banner, images, description, publish_status, created_at, updated_at';

@Injectable()
export class CountriesService {
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

    return { success: true, message: 'Countries table migrated successfully.' };
  }

  // ─── Dropdown ────────────────────────────────────────────────────────────────

  async dropdown(): Promise<{ success: boolean; data: object[] }> {
    const { data, error } = await this.supabase.db
      .from('countries')
      .select('id, name, iso2, flag_image')
      .eq('publish_status', true)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return { success: true, data: data ?? [] };
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(
    dto: CreateCountryDto,
    files: UploadedFiles,
  ): Promise<{ success: boolean; message: string; data: object }> {
    if (dto.module_id)   await this.validateRef('modules',   dto.module_id,   'module_name');
    if (dto.language_id) await this.validateRef('languages', dto.language_id, 'name');

    const [flagUrl, thumbnailUrl, bannerUrl, imageUrls] = await Promise.all([
      files?.flag_image?.[0] ? this.uploadFile(files.flag_image[0], 'country-flags')      : Promise.resolve(null),
      files?.thumbnail?.[0]  ? this.uploadFile(files.thumbnail[0],  'country-thumbnails')  : Promise.resolve(null),
      files?.banner?.[0]     ? this.uploadFile(files.banner[0],     'country-banners')     : Promise.resolve(null),
      files?.images?.length  ? this.uploadMultiple(files.images,    'country-images')      : Promise.resolve([]),
    ]);

    const { data, error } = await this.supabase.db
      .from('countries')
      .insert({
        module_id:      dto.module_id      ?? null,
        language_id:    dto.language_id    ?? null,
        seo_id:         dto.seo_id         ?? null,
        name:           dto.name,
        iso2:           dto.iso2           ?? null,
        iso3:           dto.iso3           ?? null,
        phone_code:     dto.phone_code     ?? null,
        currency:       dto.currency       ?? null,
        currency_code:  dto.currency_code  ?? null,
        capital:        dto.capital        ?? null,
        continent:      dto.continent      ?? null,
        nationality:    dto.nationality    ?? null,
        timezone:       dto.timezone       ?? null,
        flag_image:     flagUrl,
        thumbnail:      thumbnailUrl,
        banner:         bannerUrl,
        images:         imageUrls.length ? JSON.stringify(imageUrls) : null,
        description:    dto.description    ?? null,
        publish_status: dto.publish_status ?? true,
      })
      .select(COUNTRY_DETAIL_FIELDS)
      .single();

    if (error) throw new Error(error.message);

    const [enriched] = await this.enrichWithRelations([data]);
    return { success: true, message: 'Country created successfully.', data: enriched };
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(query: ListCountriesDto) {
    const {
      page = 1, limit = 10, search,
      module_id, language_id, continent, publish_status,
      sortBy = 'created_at', sortOrder = 'DESC',
    } = query;

    const from = (page - 1) * limit;

    let dbQuery = this.supabase.db
      .from('countries')
      .select(COUNTRY_LIST_FIELDS, { count: 'exact' })
      .is('deleted_at', null);

    if (search) {
      dbQuery = dbQuery.or(
        `name.ilike.%${search}%,iso2.ilike.%${search}%,iso3.ilike.%${search}%,capital.ilike.%${search}%,nationality.ilike.%${search}%`,
      );
    }
    if (module_id)                   dbQuery = dbQuery.eq('module_id',      module_id);
    if (language_id)                 dbQuery = dbQuery.eq('language_id',    language_id);
    if (continent)                   dbQuery = dbQuery.ilike('continent',   `%${continent}%`);
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
      .from('countries')
      .select(COUNTRY_DETAIL_FIELDS)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) throw new NotFoundException('Country not found.');

    const [enriched] = await this.enrichWithRelations([data]);
    return { success: true, data: enriched };
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateCountryDto,
    files: UploadedFiles,
  ): Promise<{ success: boolean; message: string; data: object }> {
    const { data: existing } = await this.supabase.db
      .from('countries')
      .select('id, images')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Country not found.');

    if (dto.module_id)   await this.validateRef('modules',   dto.module_id,   'module_name');
    if (dto.language_id) await this.validateRef('languages', dto.language_id, 'name');

    const updates: Record<string, any> = { ...dto, updated_at: new Date().toISOString() };

    const [flagUrl, thumbnailUrl, bannerUrl] = await Promise.all([
      files?.flag_image?.[0] ? this.uploadFile(files.flag_image[0], 'country-flags')     : Promise.resolve(null),
      files?.thumbnail?.[0]  ? this.uploadFile(files.thumbnail[0],  'country-thumbnails') : Promise.resolve(null),
      files?.banner?.[0]     ? this.uploadFile(files.banner[0],     'country-banners')    : Promise.resolve(null),
    ]);

    if (flagUrl)      updates.flag_image = flagUrl;
    if (thumbnailUrl) updates.thumbnail  = thumbnailUrl;
    if (bannerUrl)    updates.banner     = bannerUrl;

    if (files?.images?.length) {
      const newUrls  = await this.uploadMultiple(files.images, 'country-images');
      const current  = this.parseImages(existing.images);
      updates.images = JSON.stringify([...current, ...newUrls]);
    }

    const { data: updated, error } = await this.supabase.db
      .from('countries')
      .update(updates)
      .eq('id', id)
      .select(COUNTRY_DETAIL_FIELDS)
      .single();

    if (error) throw new Error(error.message);

    const [enriched] = await this.enrichWithRelations([updated]);
    return { success: true, message: 'Country updated successfully.', data: enriched };
  }

  // ─── Delete (Soft) ───────────────────────────────────────────────────────────

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const { data: existing } = await this.supabase.db
      .from('countries')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Country not found.');

    const { error } = await this.supabase.db
      .from('countries')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true, message: 'Country deleted successfully.' };
  }

  // ─── Gallery: Add Images ──────────────────────────────────────────────────────

  async addGalleryImages(
    id: string,
    files: Express.Multer.File[],
  ): Promise<{ success: boolean; message: string; data: { images: string[] } }> {
    const { data: existing } = await this.supabase.db
      .from('countries')
      .select('id, images')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Country not found.');
    if (!files?.length) throw new UnprocessableEntityException('No images provided.');

    const newUrls  = await this.uploadMultiple(files, 'country-images');
    const current  = this.parseImages(existing.images);
    const merged   = [...current, ...newUrls];

    const { error } = await this.supabase.db
      .from('countries')
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
      .from('countries')
      .select('id, images')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Country not found.');

    const images = this.parseImages(existing.images).filter(url => url !== imageUrl);

    const { error } = await this.supabase.db
      .from('countries')
      .update({ images: images.length ? JSON.stringify(images) : null, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true, message: 'Gallery image removed successfully.', data: { images } };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private parseImages(raw: string | null): string[] {
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  private async validateRef(table: string, id: string, _labelField: string) {
    const { data } = await (this.supabase.db as any)
      .from(table)
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (!data) throw new NotFoundException(`${table.slice(0, -1)} not found.`);
  }

  private async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new UnprocessableEntityException(
        `Invalid file type "${file.mimetype}". Allowed: jpg, jpeg, png, webp.`,
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

  private async uploadMultiple(files: Express.Multer.File[], folder: string): Promise<string[]> {
    return Promise.all(files.map(f => this.uploadFile(f, folder)));
  }

  private async enrichWithRelations(records: any[]) {
    if (!records.length) return records;

    const pick = (arr: any[], key: string) => [...new Set(arr.filter(r => r[key]).map(r => r[key]))];

    const moduleIds   = pick(records, 'module_id');
    const languageIds = pick(records, 'language_id');

    const [modulesRes, languagesRes] = await Promise.all([
      moduleIds.length   ? this.supabase.db.from('modules').select('id, module_name').in('id', moduleIds)    : { data: [] },
      languageIds.length ? this.supabase.db.from('languages').select('id, name, code').in('id', languageIds) : { data: [] },
    ]);

    const moduleMap   = Object.fromEntries((modulesRes.data   ?? []).map((m: any) => [m.id, { id: m.id, name: m.module_name }]));
    const languageMap = Object.fromEntries((languagesRes.data ?? []).map((l: any) => [l.id, { id: l.id, name: l.name, code: l.code }]));

    return records.map(r => ({
      ...r,
      images:   this.parseImages(r.images),
      module:   r.module_id   ? (moduleMap[r.module_id]     ?? null) : null,
      language: r.language_id ? (languageMap[r.language_id] ?? null) : null,
    }));
  }
}
