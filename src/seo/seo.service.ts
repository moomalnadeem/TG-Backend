import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateSeoDto } from './dto/create-seo.dto';
import { ListSeoDto } from './dto/list-seo.dto';
import { UpdateSeoDto } from './dto/update-seo.dto';
import { UpsertSeoDto } from './dto/upsert-seo.dto';

// Maps module alias → { table, labelField }
// Add new modules here as the project grows
const MODULE_TABLE_MAP: Record<string, { table: string; labelField: string }> = {
  users:        { table: 'users',    labelField: 'name' },
  roles:        { table: 'roles',    labelField: 'name' },
  modules:      { table: 'modules',  labelField: 'module_name' },
  tours:        { table: 'tours',    labelField: 'name' },
  blogs:        { table: 'blogs',    labelField: 'title' },
  categories:   { table: 'categories', labelField: 'name' },
  destinations: { table: 'destinations', labelField: 'name' },
  countries:    { table: 'countries', labelField: 'name' },
  cities:       { table: 'cities',   labelField: 'name' },
  products:     { table: 'products', labelField: 'name' },
};

const SETUP_SQL = `
  CREATE TABLE IF NOT EXISTS seo (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title             VARCHAR(255) NOT NULL,
    description       TEXT         NOT NULL,
    keywords          TEXT,
    canonical_url     VARCHAR(500),
    sitemap_priority  DECIMAL(2,1) DEFAULT 0.5,
    sitemap_frequency VARCHAR(20)  NOT NULL DEFAULT 'weekly',
    module_id         UUID         NOT NULL,
    item_id           UUID         NOT NULL,
    disable_for_bots  BOOLEAN      NOT NULL DEFAULT false,
    publish_status    BOOLEAN      NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
  );

  ALTER TABLE seo ADD COLUMN IF NOT EXISTS keywords          TEXT;
  ALTER TABLE seo ADD COLUMN IF NOT EXISTS canonical_url     VARCHAR(500);
  ALTER TABLE seo ADD COLUMN IF NOT EXISTS sitemap_priority  DECIMAL(2,1) DEFAULT 0.5;
  ALTER TABLE seo ADD COLUMN IF NOT EXISTS sitemap_frequency VARCHAR(20)  NOT NULL DEFAULT 'weekly';
  ALTER TABLE seo ADD COLUMN IF NOT EXISTS module_id         UUID;
  ALTER TABLE seo ADD COLUMN IF NOT EXISTS item_id           UUID;
  ALTER TABLE seo ADD COLUMN IF NOT EXISTS disable_for_bots  BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE seo ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE seo ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_module_item     ON seo(module_id, item_id) WHERE deleted_at IS NULL;
  CREATE INDEX        IF NOT EXISTS idx_seo_title           ON seo(title);
  CREATE INDEX        IF NOT EXISTS idx_seo_module_id       ON seo(module_id);
  CREATE INDEX        IF NOT EXISTS idx_seo_item_id         ON seo(item_id);
  CREATE INDEX        IF NOT EXISTS idx_seo_publish_status  ON seo(publish_status);
  CREATE INDEX        IF NOT EXISTS idx_seo_deleted_at      ON seo(deleted_at);
`;

@Injectable()
export class SeoService {
  constructor(private readonly supabase: SupabaseService) {}

  // ─── Setup ───────────────────────────────────────────────────────────────────

  async setup(): Promise<{ success: boolean; message: string }> {
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
      throw new Error(`SEO table migration failed: ${body}`);
    }

    return { success: true, message: 'SEO table migrated successfully.' };
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(dto: CreateSeoDto): Promise<{ success: boolean; message: string; data: object }> {
    await this.validateModule(dto.module_id);
    await this.validateItem(dto.module_id, dto.item_id);

    const SEO_FIELDS = 'id, title, description, keywords, canonical_url, sitemap_priority, sitemap_frequency, module_id, item_id, disable_for_bots, publish_status, created_at, updated_at';

    // Upsert: if a record already exists for this item_id, update it instead
    const { data: existing } = await this.supabase.db
      .from('seo')
      .select('id')
      .eq('item_id', dto.item_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await this.supabase.db
        .from('seo')
        .update({
          title:             dto.title,
          description:       dto.description,
          keywords:          dto.keywords ?? null,
          canonical_url:     dto.canonical_url ?? null,
          sitemap_priority:  dto.sitemap_priority ?? 0.5,
          sitemap_frequency: dto.sitemap_frequency,
          module_id:         dto.module_id,
          disable_for_bots:  dto.disable_for_bots ?? false,
          publish_status:    dto.publish_status,
          updated_at:        new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select(SEO_FIELDS)
        .single();

      if (error) throw new Error(error.message);

      const [enriched] = await this.enrichWithRelations([updated]);
      return { success: true, message: 'SEO record updated successfully.', data: enriched };
    }

    const { data, error } = await this.supabase.db
      .from('seo')
      .insert({
        title:             dto.title,
        description:       dto.description,
        keywords:          dto.keywords ?? null,
        canonical_url:     dto.canonical_url ?? null,
        sitemap_priority:  dto.sitemap_priority ?? 0.5,
        sitemap_frequency: dto.sitemap_frequency,
        module_id:         dto.module_id,
        item_id:           dto.item_id,
        disable_for_bots:  dto.disable_for_bots ?? false,
        publish_status:    dto.publish_status,
      })
      .select(SEO_FIELDS)
      .single();

    if (error) throw new Error(error.message);

    const [enriched] = await this.enrichWithRelations([data]);
    return { success: true, message: 'SEO record created successfully.', data: enriched };
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(query: ListSeoDto) {
    const {
      page = 1, limit = 10, search, module_id, publish_status,
      sortBy = 'created_at', sortOrder = 'DESC',
    } = query;

    const from = (page - 1) * limit;

    let dbQuery = this.supabase.db
      .from('seo')
      .select(
        'id, title, description, keywords, canonical_url, sitemap_priority, sitemap_frequency, module_id, item_id, disable_for_bots, publish_status, created_at, updated_at',
        { count: 'exact' },
      )
      .is('deleted_at', null);

    if (search) {
      dbQuery = dbQuery.or(
        `title.ilike.%${search}%,description.ilike.%${search}%,keywords.ilike.%${search}%`,
      );
    }
    if (module_id) dbQuery = dbQuery.eq('module_id', module_id);
    if (publish_status !== undefined) dbQuery = dbQuery.eq('publish_status', publish_status);

    const { data: records, error, count } = await dbQuery
      .order(sortBy, { ascending: sortOrder === 'ASC' })
      .range(from, from + limit - 1);

    if (error) throw new Error(error.message);

    const enriched = await this.enrichWithRelations(records ?? []);

    return {
      success: true,
      data: enriched,
      pagination: { page, limit, total: count ?? 0 },
    };
  }

  // ─── Get One (by seo_id OR item_id) ─────────────────────────────────────────

  async findOne(id: string) {
    const SEO_FIELDS = 'id, title, description, keywords, canonical_url, sitemap_priority, sitemap_frequency, module_id, item_id, disable_for_bots, publish_status, created_at, updated_at';

    // Try by seo_id first
    const { data: bySeoId } = await this.supabase.db
      .from('seo')
      .select(SEO_FIELDS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (bySeoId) {
      const [enriched] = await this.enrichWithRelations([bySeoId]);
      return { success: true, data: enriched };
    }

    // Fall back to item_id
    const { data: byItemId } = await this.supabase.db
      .from('seo')
      .select(SEO_FIELDS)
      .eq('item_id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (byItemId) {
      const [enriched] = await this.enrichWithRelations([byItemId]);
      return { success: true, data: enriched };
    }

    throw new NotFoundException('SEO record not found by seo_id or item_id.');
  }

  // ─── Get by Item ─────────────────────────────────────────────────────────────

  async findByItem(itemId: string, moduleId?: string) {
    let q = this.supabase.db
      .from('seo')
      .select('id, title, description, keywords, canonical_url, sitemap_priority, sitemap_frequency, module_id, item_id, disable_for_bots, publish_status, created_at, updated_at')
      .eq('item_id', itemId)
      .is('deleted_at', null);

    if (moduleId) q = q.eq('module_id', moduleId);

    const { data, error } = await q.maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('No SEO record found for this item.');

    const [enriched] = await this.enrichWithRelations([data]);
    return { success: true, data: enriched };
  }

  // ─── Upsert by Item ──────────────────────────────────────────────────────────

  async upsertByItem(
    itemId: string,
    dto: UpsertSeoDto,
  ): Promise<{ success: boolean; message: string; data: object }> {
    const SEO_FIELDS = 'id, title, description, keywords, canonical_url, sitemap_priority, sitemap_frequency, module_id, item_id, disable_for_bots, publish_status, created_at, updated_at';

    const { data: existing } = await this.supabase.db
      .from('seo')
      .select('id')
      .eq('item_id', itemId)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await this.supabase.db
        .from('seo')
        .update({
          title:             dto.title,
          description:       dto.description,
          keywords:          dto.keywords ?? null,
          canonical_url:     dto.canonical_url ?? null,
          sitemap_priority:  dto.sitemap_priority ?? 0.5,
          sitemap_frequency: dto.sitemap_frequency,
          module_id:         dto.module_id,
          disable_for_bots:  dto.disable_for_bots ?? false,
          publish_status:    dto.publish_status,
          updated_at:        new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select(SEO_FIELDS)
        .single();

      if (error) throw new Error(error.message);
      const [enriched] = await this.enrichWithRelations([updated]);
      return { success: true, message: 'SEO record updated successfully.', data: enriched };
    }

    await this.validateModule(dto.module_id);
    await this.validateItem(dto.module_id, itemId);

    const { data, error } = await this.supabase.db
      .from('seo')
      .insert({
        title:             dto.title,
        description:       dto.description,
        keywords:          dto.keywords ?? null,
        canonical_url:     dto.canonical_url ?? null,
        sitemap_priority:  dto.sitemap_priority ?? 0.5,
        sitemap_frequency: dto.sitemap_frequency,
        module_id:         dto.module_id,
        item_id:           itemId,
        disable_for_bots:  dto.disable_for_bots ?? false,
        publish_status:    dto.publish_status,
      })
      .select(SEO_FIELDS)
      .single();

    if (error) throw new Error(error.message);
    const [enriched] = await this.enrichWithRelations([data]);
    return { success: true, message: 'SEO record created successfully.', data: enriched };
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateSeoDto): Promise<{ success: boolean; message: string; data: object }> {
    const { data: existing } = await this.supabase.db
      .from('seo')
      .select('id, module_id, item_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('SEO record not found.');

    const effectiveModuleId = dto.module_id ?? existing.module_id;
    const effectiveItemId   = dto.item_id   ?? existing.item_id;

    if (dto.module_id || dto.item_id) {
      if (dto.module_id) await this.validateModule(dto.module_id);
      await this.validateItem(effectiveModuleId, effectiveItemId);

      const moduleOrItemChanged =
        effectiveModuleId !== existing.module_id || effectiveItemId !== existing.item_id;
      if (moduleOrItemChanged) {
        await this.assertUniqueModuleItem(effectiveModuleId, effectiveItemId, id);
      }
    }

    const { data: updated, error } = await this.supabase.db
      .from('seo')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, title, description, keywords, canonical_url, sitemap_priority, sitemap_frequency, module_id, item_id, disable_for_bots, publish_status, updated_at')
      .single();

    if (error) throw new Error(error.message);

    const [enriched] = await this.enrichWithRelations([updated]);
    return { success: true, message: 'SEO record updated successfully.', data: enriched };
  }

  // ─── Delete (Soft) ───────────────────────────────────────────────────────────

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const { data: existing } = await this.supabase.db
      .from('seo')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('SEO record not found or already deleted.');

    const { error } = await this.supabase.db
      .from('seo')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);

    return { success: true, message: 'SEO record deleted successfully.' };
  }

  // ─── Items Dropdown ──────────────────────────────────────────────────────────

  async itemsDropdown(moduleId: string): Promise<{ success: boolean; data: object[]; message?: string }> {
    const { data: module } = await this.supabase.db
      .from('modules')
      .select('id, module_name, alias')
      .eq('id', moduleId)
      .is('deleted_at', null)
      .single();

    if (!module) throw new NotFoundException('Module not found.');

    const tableConfig = MODULE_TABLE_MAP[module.alias ?? ''];
    if (!tableConfig) {
      return {
        success: true,
        data: [],
        message: `No item table is mapped for module "${module.module_name}". Add it to MODULE_TABLE_MAP.`,
      };
    }

    const { data: items, error } = await (this.supabase.db as any)
      .from(tableConfig.table)
      .select(`id, ${tableConfig.labelField}`)
      .order(tableConfig.labelField, { ascending: true });

    if (error) {
      return { success: true, data: [], message: `Could not load items: ${error.message}` };
    }

    return {
      success: true,
      data: ((items ?? []) as any[]).map((item: any) => ({
        id:   item.id,
        name: item[tableConfig.labelField],
      })),
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async validateModule(moduleId: string) {
    const { data } = await this.supabase.db
      .from('modules')
      .select('id')
      .eq('id', moduleId)
      .eq('publish_status', true)
      .is('deleted_at', null)
      .single();
    if (!data) throw new NotFoundException('Module not found or is not published.');
  }

  private async validateItem(moduleId: string, itemId: string) {
    const { data: module } = await this.supabase.db
      .from('modules')
      .select('alias')
      .eq('id', moduleId)
      .single();

    if (!module) return;

    const tableConfig = MODULE_TABLE_MAP[module.alias ?? ''];
    if (!tableConfig) return;

    const { data: item } = await this.supabase.db
      .from(tableConfig.table)
      .select('id')
      .eq('id', itemId)
      .maybeSingle();

    if (!item) throw new NotFoundException(`Item not found in the selected module's records.`);
  }

  private async assertUniqueModuleItem(moduleId: string, itemId: string, excludeId?: string) {
    let q = this.supabase.db
      .from('seo')
      .select('id')
      .eq('module_id', moduleId)
      .eq('item_id', itemId)
      .is('deleted_at', null);

    if (excludeId) q = q.neq('id', excludeId);

    const { data } = await q.maybeSingle();
    if (data) throw new ConflictException('An SEO record already exists for this module and item.');
  }

  private async enrichWithRelations(records: any[]) {
    if (!records.length) return records;

    const moduleIds = [...new Set(records.filter(r => r.module_id).map(r => r.module_id))];

    const { data: modules } = await this.supabase.db
      .from('modules')
      .select('id, module_name, alias')
      .in('id', moduleIds);

    const moduleMap = Object.fromEntries((modules ?? []).map(m => [m.id, m]));

    // Group item_ids by module alias for batch fetching
    const aliasBuckets: Record<string, string[]> = {};
    for (const r of records) {
      const mod = moduleMap[r.module_id];
      if (mod?.alias && MODULE_TABLE_MAP[mod.alias]) {
        (aliasBuckets[mod.alias] ??= []).push(r.item_id);
      }
    }

    // Batch fetch items per module table
    const itemDataByAlias: Record<string, Record<string, any>> = {};
    await Promise.all(
      Object.entries(aliasBuckets).map(async ([alias, itemIds]) => {
        const cfg = MODULE_TABLE_MAP[alias];
        const { data: items } = await (this.supabase.db as any)
          .from(cfg.table)
          .select(`id, ${cfg.labelField}`)
          .in('id', [...new Set(itemIds)]);

        itemDataByAlias[alias] = Object.fromEntries(
          ((items ?? []) as any[]).map((item: any) => [item.id, { id: item.id, name: item[cfg.labelField] }]),
        );
      }),
    );

    return records.map(r => {
      const mod   = moduleMap[r.module_id] ?? null;
      const alias = mod?.alias;
      const item  = alias ? (itemDataByAlias[alias]?.[r.item_id] ?? null) : null;
      return {
        ...r,
        module: mod ? { id: mod.id, name: mod.module_name } : null,
        item,
      };
    });
  }
}
