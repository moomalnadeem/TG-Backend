import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateLanguageDto } from './dto/create-language.dto';
import { ListLanguagesDto } from './dto/list-languages.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';

const DEFAULT_LANGUAGES = [
  { name: 'English', code: 'en', native_name: 'English',  locale: 'en-US', direction: 'LTR', is_default: true,  status: true },
  { name: 'Arabic',  code: 'ar', native_name: 'العربية', locale: 'ar-AE', direction: 'RTL', is_default: false, status: true },
];

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS languages (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id   UUID,
    name        VARCHAR(100) NOT NULL UNIQUE,
    code        VARCHAR(10)  NOT NULL UNIQUE,
    native_name VARCHAR(100) NOT NULL,
    locale      VARCHAR(20)  NOT NULL,
    direction   VARCHAR(3)   NOT NULL DEFAULT 'LTR',
    flag        VARCHAR(500),
    is_default  BOOLEAN      NOT NULL DEFAULT false,
    status      BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
  );
  ALTER TABLE languages ADD COLUMN IF NOT EXISTS module_id   UUID;
  ALTER TABLE languages ADD COLUMN IF NOT EXISTS native_name VARCHAR(100);
  ALTER TABLE languages ADD COLUMN IF NOT EXISTS locale      VARCHAR(20);
  ALTER TABLE languages ADD COLUMN IF NOT EXISTS direction   VARCHAR(3)   NOT NULL DEFAULT 'LTR';
  ALTER TABLE languages ADD COLUMN IF NOT EXISTS flag        VARCHAR(500);
  ALTER TABLE languages ADD COLUMN IF NOT EXISTS is_default  BOOLEAN      NOT NULL DEFAULT false;
  ALTER TABLE languages ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW();
  ALTER TABLE languages ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_languages_name       ON languages(name) WHERE deleted_at IS NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_languages_code       ON languages(code) WHERE deleted_at IS NULL;
  CREATE INDEX        IF NOT EXISTS idx_languages_module_id  ON languages(module_id);
  CREATE INDEX        IF NOT EXISTS idx_languages_status     ON languages(status);
  CREATE INDEX        IF NOT EXISTS idx_languages_direction  ON languages(direction);
  CREATE INDEX        IF NOT EXISTS idx_languages_deleted_at ON languages(deleted_at);
  SELECT pg_notify('pgrst', 'reload schema');
`;

@Injectable()
export class LanguagesService {
  constructor(private readonly supabase: SupabaseService) {}

  // ─── Setup ───────────────────────────────────────────────────────────────────

  async setup(): Promise<{
    success: boolean;
    message: string;
    data: { tableCreated: boolean; languagesSeeded: number; skippedLanguages: number };
  }> {
    const tableCreated = await this.ensureTableExists();
    const { languagesSeeded, skippedLanguages } = await this.seedDefaultLanguages();

    const alreadyInitialized = !tableCreated && languagesSeeded === 0;

    return {
      success: true,
      message: alreadyInitialized
        ? 'Language module already initialized.'
        : 'Language module initialized successfully.',
      data: { tableCreated, languagesSeeded, skippedLanguages },
    };
  }

  private async ensureTableExists(): Promise<boolean> {
    const { error } = await this.supabase.db.from('languages').select('id').limit(1);

    if (!error) return false;

    const isTableMissing =
      error.code === '42P01' ||
      error.code === 'PGRST200' ||
      (error.message ?? '').includes('schema cache');

    if (!isTableMissing) throw new Error(error.message);

    const res = await fetch(
      `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: CREATE_TABLE_SQL }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to create languages table: ${body}`);
    }

    return true;
  }

  private async seedDefaultLanguages(): Promise<{ languagesSeeded: number; skippedLanguages: number }> {
    let languagesSeeded = 0;
    let skippedLanguages = 0;

    for (const lang of DEFAULT_LANGUAGES) {
      const { data: existing } = await this.supabase.db
        .from('languages')
        .select('id')
        .eq('code', lang.code)
        .is('deleted_at', null)
        .single();

      if (existing) { skippedLanguages++; continue; }

      await this.supabase.db.from('languages').insert(lang);
      languagesSeeded++;
    }

    return { languagesSeeded, skippedLanguages };
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(dto: CreateLanguageDto): Promise<{ success: boolean; message: string }> {
    await this.validateModule(dto.module_id);
    await this.assertUnique(dto.name, dto.code);

    if (dto.is_default) await this.clearDefaultFlag();

    const { error } = await this.supabase.db.from('languages').insert({
      module_id:   dto.module_id,
      name:        dto.name,
      code:        dto.code,
      native_name: dto.native_name,
      locale:      dto.locale,
      direction:   dto.direction,
      flag:        dto.flag ?? null,
      is_default:  dto.is_default ?? false,
      status:      dto.status ?? true,
    });

    if (error) throw new Error(error.message);

    return { success: true, message: 'Language created successfully.' };
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(query: ListLanguagesDto) {
    const {
      page = 1, limit = 10, search, status, direction,
      is_default, module_id, sortBy = 'created_at', order = 'DESC',
    } = query;

    const from = (page - 1) * limit;

    let dbQuery = this.supabase.db
      .from('languages')
      .select(
        'id, module_id, name, code, native_name, locale, direction, flag, is_default, status, created_at',
        { count: 'exact' },
      )
      .is('deleted_at', null);

    if (search) {
      dbQuery = dbQuery.or(
        `name.ilike.%${search}%,code.ilike.%${search}%,native_name.ilike.%${search}%,locale.ilike.%${search}%`,
      );
    }
    if (status     !== undefined) dbQuery = dbQuery.eq('status', status);
    if (direction)                dbQuery = dbQuery.eq('direction', direction);
    if (is_default !== undefined) dbQuery = dbQuery.eq('is_default', is_default);
    if (module_id)                dbQuery = dbQuery.eq('module_id', module_id);

    const { data, error, count } = await dbQuery
      .order(sortBy, { ascending: order === 'ASC' })
      .range(from, from + limit - 1);

    if (error) throw new Error(error.message);

    const enriched = await this.enrichWithModule(data ?? []);

    return {
      success: true,
      data: enriched,
      pagination: { page, limit, total: count ?? 0 },
    };
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const { data, error } = await this.supabase.db
      .from('languages')
      .select('id, module_id, name, code, native_name, locale, direction, flag, is_default, status, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) throw new NotFoundException('Language not found.');

    const [enriched] = await this.enrichWithModule([data]);
    return { success: true, data: enriched };
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateLanguageDto): Promise<{ success: boolean; message: string }> {
    const { data: existing } = await this.supabase.db
      .from('languages')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Language not found.');

    if (dto.module_id) await this.validateModule(dto.module_id);

    if (dto.name || dto.code) {
      await this.assertUnique(dto.name, dto.code, id);
    }

    if (dto.is_default) await this.clearDefaultFlag(id);

    const { error } = await this.supabase.db
      .from('languages')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);

    return { success: true, message: 'Language updated successfully.' };
  }

  // ─── Delete (Soft) ───────────────────────────────────────────────────────────

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const { data: existing } = await this.supabase.db
      .from('languages')
      .select('id, is_default')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Language not found.');

    if (existing.is_default) {
      throw new ConflictException('Default language cannot be deleted.');
    }

    // Uncomment when translations table exists:
    // const { data: assigned } = await this.supabase.db
    //   .from('translations')
    //   .select('id')
    //   .eq('language_id', id)
    //   .limit(1);
    // if (assigned?.length) {
    //   throw new ConflictException('Language cannot be deleted because it is assigned to one or more translations.');
    // }

    const { error } = await this.supabase.db
      .from('languages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);

    return { success: true, message: 'Language deleted successfully.' };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async clearDefaultFlag(excludeId?: string) {
    let q = this.supabase.db
      .from('languages')
      .update({ is_default: false })
      .eq('is_default', true)
      .is('deleted_at', null);

    if (excludeId) q = q.neq('id', excludeId);
    await q;
  }

  private async assertUnique(name?: string, code?: string, excludeId?: string) {
    const conditions: string[] = [];
    if (name) conditions.push(`name.eq.${name}`);
    if (code) conditions.push(`code.eq.${code}`);
    if (!conditions.length) return;

    let q = this.supabase.db
      .from('languages')
      .select('id')
      .or(conditions.join(','))
      .is('deleted_at', null);

    if (excludeId) q = q.neq('id', excludeId);

    const { data } = await q.maybeSingle();
    if (data) throw new ConflictException('Language already exists.');
  }

  private async validateModule(moduleId: string) {
    const { data } = await this.supabase.db
      .from('modules')
      .select('id')
      .eq('id', moduleId)
      .is('deleted_at', null)
      .single();
    if (!data) throw new NotFoundException('Module not found.');
  }

  private async enrichWithModule(records: any[]) {
    if (!records.length) return records;

    const moduleIds = [...new Set(records.filter(r => r.module_id).map(r => r.module_id))];
    if (!moduleIds.length) return records.map(r => ({ ...r, module: null }));

    const { data: modules } = await this.supabase.db
      .from('modules')
      .select('id, module_name')
      .in('id', moduleIds);

    const moduleMap = Object.fromEntries(
      (modules ?? []).map(m => [m.id, { id: m.id, name: m.module_name }]),
    );

    return records.map(r => ({
      ...r,
      module: r.module_id ? (moduleMap[r.module_id] ?? null) : null,
    }));
  }
}
