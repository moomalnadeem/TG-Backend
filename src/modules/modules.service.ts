import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { ListModulesDto } from './dto/list-modules.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

const DEFAULT_MODULES: { module_name: string; alias: string }[] = [
  { module_name: 'Dashboard',  alias: 'dashboard'  },
  { module_name: 'Modules',    alias: 'modules'    },
  { module_name: 'Roles',      alias: 'roles'      },
  { module_name: 'Users',      alias: 'users'      },
  { module_name: 'Countries',  alias: 'countries'  },
  { module_name: 'Cities',     alias: 'cities'     },
  { module_name: 'Categories', alias: 'categories' },
  { module_name: 'Products',   alias: 'products'   },
  { module_name: 'Orders',     alias: 'orders'     },
  { module_name: 'Customers',  alias: 'customers'  },
  { module_name: 'Reports',    alias: 'reports'    },
  { module_name: 'Settings',   alias: 'settings'   },
];

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS modules (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    module_name    VARCHAR(255) NOT NULL UNIQUE,
    alias          VARCHAR(100) UNIQUE,
    publish_status BOOLEAN      NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at     TIMESTAMPTZ
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_modules_module_name ON modules(module_name);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_modules_alias       ON modules(alias) WHERE alias IS NOT NULL;
  CREATE INDEX        IF NOT EXISTS idx_modules_publish_status ON modules(publish_status);
  CREATE INDEX        IF NOT EXISTS idx_modules_deleted_at     ON modules(deleted_at);
`;

@Injectable()
export class ModulesService {
  constructor(private readonly supabase: SupabaseService) {}

  // ─── Setup ───────────────────────────────────────────────────────────────────

  async setup(): Promise<{
    success: boolean;
    message: string;
    data: { tableCreated: boolean; modulesSeeded: number; skippedModules: number };
  }> {
    const tableCreated = await this.ensureTableExists();
    const { modulesSeeded, skippedModules } = await this.seedDefaultModules();
    const alreadyInitialized = !tableCreated && modulesSeeded === 0;

    return {
      success: true,
      message: alreadyInitialized
        ? 'Module module already initialized.'
        : 'Module module initialized successfully.',
      data: { tableCreated, modulesSeeded, skippedModules },
    };
  }

  private async ensureTableExists(): Promise<boolean> {
    const { error } = await this.supabase.db.from('modules').select('id').limit(1);
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
      throw new Error(`Failed to create modules table: ${body}`);
    }

    return true;
  }

  private async seedDefaultModules(): Promise<{ modulesSeeded: number; skippedModules: number }> {
    let modulesSeeded = 0;
    let skippedModules = 0;

    for (const { module_name, alias } of DEFAULT_MODULES) {
      const { data: existing } = await this.supabase.db
        .from('modules')
        .select('id')
        .eq('module_name', module_name)
        .is('deleted_at', null)
        .single();

      if (existing) { skippedModules++; continue; }

      await this.supabase.db.from('modules').insert({ module_name, alias, publish_status: true });
      modulesSeeded++;
    }

    return { modulesSeeded, skippedModules };
  }

  // ─── Dropdown ────────────────────────────────────────────────────────────────

  async dropdown(): Promise<{ success: boolean; data: object[] }> {
    const { data, error } = await this.supabase.db
      .from('modules')
      .select('id, module_name')
      .eq('publish_status', true)
      .is('deleted_at', null)
      .order('module_name', { ascending: true });

    if (error) throw new Error(error.message);

    return { success: true, data: data ?? [] };
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(dto: CreateModuleDto): Promise<{ success: boolean; message: string; data: object }> {
    const { data: existingName } = await this.supabase.db
      .from('modules').select('id').eq('module_name', dto.module_name).is('deleted_at', null).single();
    if (existingName) throw new ConflictException('Module name already exists.');

    if (dto.alias) {
      const { data: existingAlias } = await this.supabase.db
        .from('modules').select('id').eq('alias', dto.alias).is('deleted_at', null).single();
      if (existingAlias) throw new ConflictException('Alias already exists.');
    }

    const { data, error } = await this.supabase.db
      .from('modules')
      .insert({ module_name: dto.module_name, alias: dto.alias ?? null, publish_status: dto.publish_status })
      .select('id, module_name, alias, publish_status')
      .single();

    if (error) throw new Error(error.message);
    return { success: true, message: 'Module created successfully.', data };
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(query: ListModulesDto) {
    const { page = 1, limit = 10, search, publish_status, sortBy = 'created_at', sortOrder = 'DESC' } = query;
    const from = (page - 1) * limit;

    let dbQuery = this.supabase.db
      .from('modules')
      .select('id, module_name, alias, publish_status, created_at, updated_at', { count: 'exact' })
      .is('deleted_at', null);

    if (search) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search);
      const orFilter = isUuid
        ? `id.eq.${search},module_name.ilike.%${search}%,alias.ilike.%${search}%`
        : `module_name.ilike.%${search}%,alias.ilike.%${search}%`;
      dbQuery = dbQuery.or(orFilter);
    }

    if (publish_status !== undefined) dbQuery = dbQuery.eq('publish_status', publish_status);

    const { data, error, count } = await dbQuery
      .order(sortBy, { ascending: sortOrder === 'ASC' })
      .range(from, from + limit - 1);

    if (error) throw new Error(error.message);
    return { success: true, data, pagination: { page, limit, total: count ?? 0 } };
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  async findOne(identifier: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const orFilter = isUuid
      ? `id.eq.${identifier},alias.eq.${identifier},module_name.eq.${identifier}`
      : `alias.eq.${identifier},module_name.eq.${identifier}`;

    const { data, error } = await this.supabase.db
      .from('modules')
      .select('id, module_name, alias, publish_status, created_at, updated_at')
      .or(orFilter)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (error || !data) throw new NotFoundException('Module not found.');
    return { success: true, data };
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateModuleDto): Promise<{ success: boolean; message: string }> {
    const { data: module } = await this.supabase.db
      .from('modules').select('id').eq('id', id).is('deleted_at', null).single();
    if (!module) throw new NotFoundException('Module not found.');

    if (dto.module_name) {
      const { data: conflict } = await this.supabase.db
        .from('modules').select('id').eq('module_name', dto.module_name).is('deleted_at', null).neq('id', id).single();
      if (conflict) throw new ConflictException('Module name already exists.');
    }

    if (dto.alias) {
      const { data: conflict } = await this.supabase.db
        .from('modules').select('id').eq('alias', dto.alias).is('deleted_at', null).neq('id', id).single();
      if (conflict) throw new ConflictException('Alias already exists.');
    }

    const { error } = await this.supabase.db
      .from('modules').update({ ...dto, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);

    return { success: true, message: 'Module updated successfully.' };
  }

  // ─── Delete (Soft) ───────────────────────────────────────────────────────────

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const { data: module } = await this.supabase.db
      .from('modules').select('id').eq('id', id).is('deleted_at', null).single();
    if (!module) throw new NotFoundException('Module not found.');

    const { error } = await this.supabase.db
      .from('modules').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);

    return { success: true, message: 'Module deleted successfully.' };
  }
}
