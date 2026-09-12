import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { ListOrganizationsDto } from './dto/list-organizations.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

type UploadedFiles = {
  logo?:      Express.Multer.File[];
  thumbnail?: Express.Multer.File[];
  banner?:    Express.Multer.File[];
  gallery?:   Express.Multer.File[];
};

const SETUP_SQL = `
  CREATE TABLE IF NOT EXISTS organizations (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id   UUID,
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(255) UNIQUE,
    email       VARCHAR(255) UNIQUE,
    phone       VARCHAR(50),
    website     VARCHAR(500),
    description TEXT,
    address     TEXT,
    country_id  UUID,
    city_id     UUID,
    language_id UUID,
    logo        VARCHAR(500),
    thumbnail   VARCHAR(500),
    banner      VARCHAR(500),
    gallery     TEXT,
    is_featured BOOLEAN      NOT NULL DEFAULT false,
    status      BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
  );
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS module_id   UUID;
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug        VARCHAR(255);
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS email       VARCHAR(255);
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS phone       VARCHAR(50);
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website     VARCHAR(500);
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS description TEXT;
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address     TEXT;
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS country_id  UUID;
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS city_id     UUID;
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS language_id UUID;
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo        VARCHAR(500);
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS thumbnail   VARCHAR(500);
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS banner      VARCHAR(500);
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS gallery     TEXT;
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_orgs_slug       ON organizations(slug)  WHERE deleted_at IS NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_orgs_email      ON organizations(email) WHERE deleted_at IS NULL;
  CREATE INDEX        IF NOT EXISTS idx_orgs_module_id  ON organizations(module_id);
  CREATE INDEX        IF NOT EXISTS idx_orgs_country_id ON organizations(country_id);
  CREATE INDEX        IF NOT EXISTS idx_orgs_city_id    ON organizations(city_id);
  CREATE INDEX        IF NOT EXISTS idx_orgs_status     ON organizations(status);
  CREATE INDEX        IF NOT EXISTS idx_orgs_featured   ON organizations(is_featured);
  CREATE INDEX        IF NOT EXISTS idx_orgs_deleted_at ON organizations(deleted_at);
  SELECT pg_notify('pgrst', 'reload schema');
`;

const ORG_LIST_FIELDS  = 'id, module_id, name, slug, email, phone, logo, thumbnail, country_id, city_id, language_id, is_featured, status, created_at';
const ORG_DETAIL_FIELDS = 'id, module_id, name, slug, email, phone, website, description, address, country_id, city_id, language_id, logo, thumbnail, banner, gallery, is_featured, status, created_at, updated_at';

@Injectable()
export class OrganizationsService {
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

    return { success: true, message: 'Organizations table migrated successfully.' };
  }

  // ─── Dropdown ────────────────────────────────────────────────────────────────

  async dropdown(): Promise<{ success: boolean; data: object[] }> {
    const { data, error } = await this.supabase.db
      .from('organizations')
      .select('id, name')
      .eq('status', true)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return { success: true, data: data ?? [] };
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(
    dto: CreateOrganizationDto,
    files: UploadedFiles,
  ): Promise<{ success: boolean; message: string; data: object }> {
    const slug = dto.slug ?? this.generateSlug(dto.name);
    await this.assertUniqueSlug(slug);
    if (dto.email) await this.assertUniqueEmail(dto.email);
    if (dto.module_id)   await this.validateRef('modules',   dto.module_id,   'module_name');
    if (dto.country_id)  await this.validateRef('countries', dto.country_id,  'name');
    if (dto.city_id)     await this.validateRef('cities',    dto.city_id,     'name');
    if (dto.language_id) await this.validateRef('languages', dto.language_id, 'name');

    const [logoUrl, thumbnailUrl, bannerUrl, galleryUrls] = await Promise.all([
      files?.logo?.[0]      ? this.uploadFile(files.logo[0],      'org-logos')      : Promise.resolve(null),
      files?.thumbnail?.[0] ? this.uploadFile(files.thumbnail[0], 'org-thumbnails') : Promise.resolve(null),
      files?.banner?.[0]    ? this.uploadFile(files.banner[0],    'org-banners')    : Promise.resolve(null),
      files?.gallery?.length ? this.uploadMultiple(files.gallery, 'org-gallery')    : Promise.resolve([]),
    ]);

    const { data, error } = await this.supabase.db
      .from('organizations')
      .insert({
        module_id:   dto.module_id   ?? null,
        name:        dto.name,
        slug,
        email:       dto.email       ?? null,
        phone:       dto.phone       ?? null,
        website:     dto.website     ?? null,
        description: dto.description ?? null,
        address:     dto.address     ?? null,
        country_id:  dto.country_id  ?? null,
        city_id:     dto.city_id     ?? null,
        language_id: dto.language_id ?? null,
        logo:        logoUrl,
        thumbnail:   thumbnailUrl,
        banner:      bannerUrl,
        gallery:     galleryUrls.length ? JSON.stringify(galleryUrls) : null,
        is_featured: dto.is_featured ?? false,
        status:      dto.status      ?? true,
      })
      .select(ORG_DETAIL_FIELDS)
      .single();

    if (error) throw new Error(error.message);

    const [enriched] = await this.enrichWithRelations([data]);
    return { success: true, message: 'Organization created successfully.', data: enriched };
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(query: ListOrganizationsDto) {
    const {
      page = 1, limit = 10, search,
      module_id, country_id, city_id, language_id,
      status, is_featured, sortBy = 'created_at', sortOrder = 'DESC',
    } = query;

    const from = (page - 1) * limit;

    let dbQuery = this.supabase.db
      .from('organizations')
      .select(ORG_LIST_FIELDS, { count: 'exact' })
      .is('deleted_at', null);

    if (search) {
      dbQuery = dbQuery.or(
        `name.ilike.%${search}%,slug.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,address.ilike.%${search}%`,
      );
    }
    if (module_id)               dbQuery = dbQuery.eq('module_id',   module_id);
    if (country_id)              dbQuery = dbQuery.eq('country_id',  country_id);
    if (city_id)                 dbQuery = dbQuery.eq('city_id',     city_id);
    if (language_id)             dbQuery = dbQuery.eq('language_id', language_id);
    if (status      !== undefined) dbQuery = dbQuery.eq('status',      status);
    if (is_featured !== undefined) dbQuery = dbQuery.eq('is_featured', is_featured);

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
      .from('organizations')
      .select(ORG_DETAIL_FIELDS)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) throw new NotFoundException('Organization not found.');

    const [enriched] = await this.enrichWithRelations([data]);
    return { success: true, data: enriched };
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateOrganizationDto,
    files: UploadedFiles,
  ): Promise<{ success: boolean; message: string; data: object }> {
    const { data: existing } = await this.supabase.db
      .from('organizations')
      .select('id, gallery')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Organization not found.');

    if (dto.slug)        await this.assertUniqueSlug(dto.slug, id);
    if (dto.email)       await this.assertUniqueEmail(dto.email, id);
    if (dto.module_id)   await this.validateRef('modules',   dto.module_id,   'module_name');
    if (dto.country_id)  await this.validateRef('countries', dto.country_id,  'name');
    if (dto.city_id)     await this.validateRef('cities',    dto.city_id,     'name');
    if (dto.language_id) await this.validateRef('languages', dto.language_id, 'name');

    const updates: Record<string, any> = { ...dto, updated_at: new Date().toISOString() };

    if (dto.name && !dto.slug) updates.slug = this.generateSlug(dto.name);

    const [logoUrl, thumbnailUrl, bannerUrl] = await Promise.all([
      files?.logo?.[0]      ? this.uploadFile(files.logo[0],      'org-logos')      : Promise.resolve(null),
      files?.thumbnail?.[0] ? this.uploadFile(files.thumbnail[0], 'org-thumbnails') : Promise.resolve(null),
      files?.banner?.[0]    ? this.uploadFile(files.banner[0],    'org-banners')    : Promise.resolve(null),
    ]);

    if (logoUrl)      updates.logo      = logoUrl;
    if (thumbnailUrl) updates.thumbnail = thumbnailUrl;
    if (bannerUrl)    updates.banner    = bannerUrl;

    if (files?.gallery?.length) {
      const newUrls   = await this.uploadMultiple(files.gallery, 'org-gallery');
      const existing_ = this.parseGallery(existing.gallery);
      updates.gallery = JSON.stringify([...existing_, ...newUrls]);
    }

    const { data: updated, error } = await this.supabase.db
      .from('organizations')
      .update(updates)
      .eq('id', id)
      .select(ORG_DETAIL_FIELDS)
      .single();

    if (error) throw new Error(error.message);

    const [enriched] = await this.enrichWithRelations([updated]);
    return { success: true, message: 'Organization updated successfully.', data: enriched };
  }

  // ─── Delete (Soft) ───────────────────────────────────────────────────────────

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const { data: existing } = await this.supabase.db
      .from('organizations')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Organization not found.');

    const { error } = await this.supabase.db
      .from('organizations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true, message: 'Organization deleted successfully.' };
  }

  // ─── Gallery: Add Images ──────────────────────────────────────────────────────

  async addGalleryImages(
    id: string,
    files: Express.Multer.File[],
  ): Promise<{ success: boolean; message: string; data: { gallery: string[] } }> {
    const { data: existing } = await this.supabase.db
      .from('organizations')
      .select('id, gallery')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Organization not found.');
    if (!files?.length) throw new UnprocessableEntityException('No images provided.');

    const newUrls      = await this.uploadMultiple(files, 'org-gallery');
    const currentGallery = this.parseGallery(existing.gallery);
    const merged       = [...currentGallery, ...newUrls];

    const { error } = await this.supabase.db
      .from('organizations')
      .update({ gallery: JSON.stringify(merged), updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true, message: 'Gallery images added successfully.', data: { gallery: merged } };
  }

  // ─── Gallery: Remove Image ────────────────────────────────────────────────────

  async removeGalleryImage(
    id: string,
    imageUrl: string,
  ): Promise<{ success: boolean; message: string; data: { gallery: string[] } }> {
    const { data: existing } = await this.supabase.db
      .from('organizations')
      .select('id, gallery')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Organization not found.');

    const gallery = this.parseGallery(existing.gallery).filter(url => url !== imageUrl);

    const { error } = await this.supabase.db
      .from('organizations')
      .update({ gallery: gallery.length ? JSON.stringify(gallery) : null, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true, message: 'Gallery image removed successfully.', data: { gallery } };
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

  private parseGallery(raw: string | null): string[] {
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  private async assertUniqueSlug(slug: string, excludeId?: string) {
    let q = this.supabase.db
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q.maybeSingle();
    if (data) throw new ConflictException('Organization with this slug already exists.');
  }

  private async assertUniqueEmail(email: string, excludeId?: string) {
    let q = this.supabase.db
      .from('organizations')
      .select('id')
      .eq('email', email)
      .is('deleted_at', null);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q.maybeSingle();
    if (data) throw new ConflictException('Organization with this email already exists.');
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
    const countryIds  = pick(records, 'country_id');
    const cityIds     = pick(records, 'city_id');
    const languageIds = pick(records, 'language_id');

    const [modulesRes, countriesRes, citiesRes, languagesRes] = await Promise.all([
      moduleIds.length   ? this.supabase.db.from('modules').select('id, module_name').in('id', moduleIds)     : { data: [] },
      countryIds.length  ? this.supabase.db.from('countries').select('id, name').in('id', countryIds)         : { data: [] },
      cityIds.length     ? this.supabase.db.from('cities').select('id, name').in('id', cityIds)               : { data: [] },
      languageIds.length ? this.supabase.db.from('languages').select('id, name, code').in('id', languageIds)  : { data: [] },
    ]);

    const moduleMap   = Object.fromEntries((modulesRes.data   ?? []).map((m: any) => [m.id, { id: m.id, name: m.module_name }]));
    const countryMap  = Object.fromEntries((countriesRes.data ?? []).map((c: any) => [c.id, c]));
    const cityMap     = Object.fromEntries((citiesRes.data    ?? []).map((c: any) => [c.id, c]));
    const languageMap = Object.fromEntries((languagesRes.data ?? []).map((l: any) => [l.id, { id: l.id, name: l.name, code: l.code }]));

    return records.map(r => ({
      ...r,
      gallery:  this.parseGallery(r.gallery),
      module:   r.module_id   ? (moduleMap[r.module_id]     ?? null) : null,
      country:  r.country_id  ? (countryMap[r.country_id]   ?? null) : null,
      city:     r.city_id     ? (cityMap[r.city_id]         ?? null) : null,
      language: r.language_id ? (languageMap[r.language_id] ?? null) : null,
    }));
  }
}
