import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { ListRolesDto } from './dto/list-roles.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const DEFAULT_ROLES = [
  { name: 'Admin', slug: 'admin', description: 'System Administrator', status: true },
  { name: 'Manager', slug: 'manager', description: 'Manager', status: true },
  { name: 'Tourist', slug: 'tourist', description: 'Tourist', status: true },
  { name: 'Tour Guide', slug: 'tour-guide', description: 'Tour Guide', status: true },
  { name: 'SEO', slug: 'seo', description: 'SEO Specialist', status: true },
  { name: 'Marketing', slug: 'marketing', description: 'Marketing Team', status: true },
  { name: 'Customer Support', slug: 'customer-support', description: 'Customer Support', status: true },
  { name: 'Finance', slug: 'finance', description: 'Finance Team', status: true },
  { name: 'Sales', slug: 'sales', description: 'Sales Team', status: true },
];

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS roles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR     NOT NULL UNIQUE,
    slug        VARCHAR     NOT NULL UNIQUE,
    description TEXT,
    module_id   UUID,
    status      BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_roles_slug      ON roles(slug);
  CREATE INDEX IF NOT EXISTS idx_roles_status    ON roles(status);
  CREATE INDEX IF NOT EXISTS idx_roles_module_id ON roles(module_id);
`;

const MIGRATE_SQL = `
  ALTER TABLE roles ADD COLUMN IF NOT EXISTS module_id UUID;
  CREATE INDEX IF NOT EXISTS idx_roles_module_id ON roles(module_id);
`;

@Injectable()
export class RolesService {
  constructor(private readonly supabase: SupabaseService) {}

  // ─── Setup ───────────────────────────────────────────────────────────────────

  async setup(): Promise<{
    success: boolean;
    message: string;
    data: { tableCreated: boolean; rolesSeeded: number; skippedRoles: number };
  }> {
    const tableCreated = await this.ensureTableExists();
    await this.runMigrations();
    const { rolesSeeded, skippedRoles } = await this.seedDefaultRoles();

    const alreadyInitialized = !tableCreated && rolesSeeded === 0;

    return {
      success: true,
      message: alreadyInitialized
        ? 'Role module already initialized.'
        : 'Role module initialized successfully.',
      data: { tableCreated, rolesSeeded, skippedRoles },
    };
  }

  private async runMigrations(): Promise<void> {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: MIGRATE_SQL }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Roles migration failed: ${body}`);
    }
  }

  private async ensureTableExists(): Promise<boolean> {
    const { error } = await this.supabase.db.from('roles').select('id').limit(1);

    // Table already exists
    if (!error) return false;

    // PostgREST returns PGRST200 when table is missing from schema cache
    const isTableMissing =
      error.code === '42P01' ||
      error.code === 'PGRST200' ||
      (error.message ?? '').includes('schema cache');

    if (!isTableMissing) throw new Error(error.message);

    // Create table via Supabase Management API
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
      throw new Error(`Failed to create roles table: ${body}`);
    }

    return true;
  }

  private async seedDefaultRoles(): Promise<{ rolesSeeded: number; skippedRoles: number }> {
    let rolesSeeded = 0;
    let skippedRoles = 0;

    for (const role of DEFAULT_ROLES) {
      const { data: existing } = await this.supabase.db
        .from('roles')
        .select('id')
        .eq('slug', role.slug)
        .is('deleted_at', null)
        .single();

      if (existing) {
        skippedRoles++;
        continue;
      }

      await this.supabase.db.from('roles').insert(role);
      rolesSeeded++;
    }

    return { rolesSeeded, skippedRoles };
  }

  // ─── Dropdown ────────────────────────────────────────────────────────────────

  async dropdown(): Promise<{ success: boolean; data: object[] }> {
    const { data, error } = await this.supabase.db
      .from('roles')
      .select('id, name')
      .eq('status', true)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);

    return { success: true, data: data ?? [] };
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(dto: CreateRoleDto): Promise<{ success: boolean; message: string }> {
    const { data: existing } = await this.supabase.db
      .from('roles')
      .select('id')
      .or(`name.eq.${dto.name},slug.eq.${dto.slug}`)
      .is('deleted_at', null)
      .single();

    if (existing) {
      throw new ConflictException('Role already exists.');
    }

    if (dto.module_id) await this.validateModule(dto.module_id);

    const { error } = await this.supabase.db.from('roles').insert({
      name:        dto.name,
      slug:        dto.slug,
      description: dto.description ?? null,
      module_id:   dto.module_id ?? null,
      status:      dto.status ?? true,
    });

    if (error) throw new Error(error.message);

    return { success: true, message: 'Role created successfully' };
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(query: ListRolesDto) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      module_id,
      sortBy = 'created_at',
      order = 'DESC',
    } = query;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let dbQuery = this.supabase.db
      .from('roles')
      .select('id, name, slug, description, module_id, status, created_at', { count: 'exact' })
      .is('deleted_at', null);

    if (search)    dbQuery = dbQuery.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
    if (status !== undefined) dbQuery = dbQuery.eq('status', status);
    if (module_id) dbQuery = dbQuery.eq('module_id', module_id);

    const { data, error, count } = await dbQuery
      .order(sortBy, { ascending: order === 'ASC' })
      .range(from, to);

    if (error) throw new Error(error.message);

    return {
      success: true,
      data,
      pagination: { page, limit, total: count ?? 0 },
    };
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const { data, error } = await this.supabase.db
      .from('roles')
      .select('id, name, slug, description, module_id, status, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) throw new NotFoundException('Role not found');

    return { success: true, data };
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateRoleDto): Promise<{ success: boolean; message: string }> {
    const { data: role } = await this.supabase.db
      .from('roles')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!role) throw new NotFoundException('Role not found');

    if (dto.module_id) await this.validateModule(dto.module_id);

    // Check uniqueness conflict only if name/slug is being changed
    if (dto.name || dto.slug) {
      const conditions: string[] = [];
      if (dto.name) conditions.push(`name.eq.${dto.name}`);
      if (dto.slug) conditions.push(`slug.eq.${dto.slug}`);

      const { data: conflict } = await this.supabase.db
        .from('roles')
        .select('id')
        .or(conditions.join(','))
        .is('deleted_at', null)
        .neq('id', id)
        .single();

      if (conflict) throw new ConflictException('Role already exists.');
    }

    const { error } = await this.supabase.db
      .from('roles')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);

    return { success: true, message: 'Role updated successfully' };
  }

  // ─── Delete (Soft) ───────────────────────────────────────────────────────────

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const { data: role } = await this.supabase.db
      .from('roles')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!role) throw new NotFoundException('Role not found');

    // Uncomment when users table has a role_id column:
    // const { data: assigned } = await this.supabase.db
    //   .from('users')
    //   .select('id')
    //   .eq('role_id', id)
    //   .limit(1);
    // if (assigned?.length) {
    //   throw new ConflictException('Role cannot be deleted because it is assigned to one or more users.');
    // }

    const { error } = await this.supabase.db
      .from('roles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);

    return { success: true, message: 'Role deleted successfully' };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async validateModule(moduleId: string) {
    const { data } = await this.supabase.db
      .from('modules')
      .select('id')
      .eq('id', moduleId)
      .is('deleted_at', null)
      .single();
    if (!data) throw new NotFoundException('Module not found.');
  }
}
