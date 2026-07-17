import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const SETUP_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    username       VARCHAR(100) UNIQUE,
    name           VARCHAR(255),
    email          VARCHAR(255) NOT NULL UNIQUE,
    password       VARCHAR(255),
    phone_number   VARCHAR(20)  UNIQUE,
    role_id        UUID,
    module_type_id UUID,
    image          VARCHAR(500),
    banner         VARCHAR(500),
    description    TEXT,
    refresh_token  TEXT,
    last_login     TIMESTAMPTZ,
    publish_status BOOLEAN      NOT NULL DEFAULT true,
    is_active      BOOLEAN      NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at     TIMESTAMPTZ
  );

  ALTER TABLE users ADD COLUMN IF NOT EXISTS username       VARCHAR(100);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS name           VARCHAR(255);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS password       VARCHAR(255);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number   VARCHAR(20);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id        UUID;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS module_type_id UUID;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token  TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login     TIMESTAMPTZ;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS image          VARCHAR(500);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS banner         VARCHAR(500);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS description    TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS publish_status BOOLEAN NOT NULL DEFAULT true;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active      BOOLEAN NOT NULL DEFAULT true;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at     TIMESTAMPTZ;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username        ON users(username) WHERE username IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email           ON users(email);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_number      ON users(phone_number) WHERE phone_number IS NOT NULL;
  CREATE INDEX        IF NOT EXISTS idx_users_role_id          ON users(role_id);
  CREATE INDEX        IF NOT EXISTS idx_users_module_type_id   ON users(module_type_id);
  CREATE INDEX        IF NOT EXISTS idx_users_publish_status   ON users(publish_status);
  CREATE INDEX        IF NOT EXISTS idx_users_deleted_at       ON users(deleted_at);
`;

type UploadedFiles = {
  image?: Express.Multer.File[];
  banner?: Express.Multer.File[];
};

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  // ─── Setup ───────────────────────────────────────────────────────────────────

  async setup(): Promise<{ success: boolean; message: string; data: object }> {
    // Ensure storage bucket exists
    await this.supabase.db.storage.createBucket(process.env.STORAGE_BUCKET!, { public: true }).catch(() => {});

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

    return {
      success: true,
      message: 'Users table migrated successfully.',
      data: { bucket: process.env.STORAGE_BUCKET },
    };
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(dto: CreateUserDto, files: UploadedFiles): Promise<{ success: boolean; message: string; data: object }> {
    await this.assertUniqueUsername(dto.username);
    await this.assertUniqueEmail(dto.email);
    await this.validateRelations(dto.role_id, dto.module_type_id);

    const imageUrl = files?.image?.[0] ? await this.uploadFile(files.image[0], 'images') : null;
    const bannerUrl = files?.banner?.[0] ? await this.uploadFile(files.banner[0], 'banners') : null;

    const placeholderPassword = await bcrypt.hash(randomUUID(), 10);

    const { data, error } = await this.supabase.db
      .from('users')
      .insert({
        username: dto.username,
        name: dto.name,
        email: dto.email,
        password: placeholderPassword,
        role_id: dto.role_id,
        module_type_id: dto.module_type_id,
        image: imageUrl,
        banner: bannerUrl,
        description: dto.description ?? null,
        publish_status: dto.publish_status,
        is_active: true,
      })
      .select('id, username, name, email, role_id, module_type_id, image, banner, publish_status')
      .single();

    if (error) throw new Error(error.message);

    return { success: true, message: 'User created successfully.', data };
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(query: ListUsersDto) {
    const {
      page = 1,
      limit = 10,
      search,
      role_id,
      module_type_id,
      publish_status,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = query;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let dbQuery = this.supabase.db
      .from('users')
      .select(
        'id, username, name, email, image, publish_status, role_id, module_type_id, created_at',
        { count: 'exact' },
      )
      .is('deleted_at', null);

    if (search) {
      const orParts = await this.buildSearchFilter(search);
      if (orParts.length) dbQuery = dbQuery.or(orParts.join(','));
    }

    if (role_id) dbQuery = dbQuery.eq('role_id', role_id);
    if (module_type_id) dbQuery = dbQuery.eq('module_type_id', module_type_id);
    if (publish_status !== undefined) dbQuery = dbQuery.eq('publish_status', publish_status);

    const { data: users, error, count } = await dbQuery
      .order(sortBy, { ascending: sortOrder === 'ASC' })
      .range(from, to);

    if (error) throw new Error(error.message);

    const enriched = await this.enrichWithRelations(users ?? []);

    return {
      success: true,
      data: enriched,
      pagination: { page, limit, total: count ?? 0 },
    };
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const { data, error } = await this.supabase.db
      .from('users')
      .select(
        'id, username, name, email, image, banner, description, publish_status, role_id, module_type_id, created_at, updated_at',
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) throw new NotFoundException('User not found.');

    const [enriched] = await this.enrichWithRelations([data]);
    return { success: true, data: enriched };
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateUserDto, files: UploadedFiles): Promise<{ success: boolean; message: string }> {
    const { data: existing } = await this.supabase.db
      .from('users')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('User not found.');

    if (dto.username) await this.assertUniqueUsername(dto.username, id);
    if (dto.email) await this.assertUniqueEmail(dto.email, id);
    if (dto.role_id || dto.module_type_id) {
      await this.validateRelations(dto.role_id, dto.module_type_id);
    }

    const updates: Record<string, any> = { ...dto, updated_at: new Date().toISOString() };

    if (files?.image?.[0]) updates.image = await this.uploadFile(files.image[0], 'images');
    if (files?.banner?.[0]) updates.banner = await this.uploadFile(files.banner[0], 'banners');

    const { error } = await this.supabase.db
      .from('users')
      .update(updates)
      .eq('id', id);

    if (error) throw new Error(error.message);

    return { success: true, message: 'User updated successfully.' };
  }

  // ─── Delete (Soft) ───────────────────────────────────────────────────────────

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const { data: existing } = await this.supabase.db
      .from('users')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('User not found.');

    const { error } = await this.supabase.db
      .from('users')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);

    return { success: true, message: 'User deleted successfully.' };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new UnprocessableEntityException(
        `Invalid file type "${file.mimetype}". Allowed: jpg, jpeg, png, webp.`,
      );
    }

    const ext = file.originalname.split('.').pop() ?? 'jpg';
    const path = `${folder}/${Date.now()}-${randomUUID()}.${ext}`;

    const bucket = process.env.STORAGE_BUCKET!;

    const { data, error } = await this.supabase.db.storage
      .from(bucket)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

    if (error) throw new Error(`File upload failed: ${error.message}`);

    const { data: { publicUrl } } = this.supabase.db.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  }

  private async enrichWithRelations(users: any[]) {
    if (!users.length) return users;

    const roleIds = [...new Set(users.filter(u => u.role_id).map(u => u.role_id))];
    const moduleIds = [...new Set(users.filter(u => u.module_type_id).map(u => u.module_type_id))];

    const [rolesRes, modulesRes] = await Promise.all([
      roleIds.length
        ? this.supabase.db.from('roles').select('id, name').in('id', roleIds)
        : { data: [] },
      moduleIds.length
        ? this.supabase.db.from('modules').select('id, module_name').in('id', moduleIds)
        : { data: [] },
    ]);

    const roleMap = Object.fromEntries((rolesRes.data ?? []).map(r => [r.id, r]));
    const moduleMap = Object.fromEntries((modulesRes.data ?? []).map(m => [m.id, m]));

    return users.map(u => ({
      ...u,
      role: u.role_id ? (roleMap[u.role_id] ?? null) : null,
      module_type: u.module_type_id ? (moduleMap[u.module_type_id] ?? null) : null,
    }));
  }

  private async buildSearchFilter(search: string): Promise<string[]> {
    const parts: string[] = [
      `username.ilike.%${search}%`,
      `name.ilike.%${search}%`,
      `email.ilike.%${search}%`,
    ];

    const [{ data: roles }, { data: modules }] = await Promise.all([
      this.supabase.db.from('roles').select('id').ilike('name', `%${search}%`).is('deleted_at', null),
      this.supabase.db.from('modules').select('id').ilike('module_name', `%${search}%`).is('deleted_at', null),
    ]);

    (roles ?? []).forEach(r => parts.push(`role_id.eq.${r.id}`));
    (modules ?? []).forEach(m => parts.push(`module_type_id.eq.${m.id}`));

    return parts;
  }

  private async assertUniqueUsername(username: string, excludeId?: string) {
    let q = this.supabase.db
      .from('users')
      .select('id')
      .eq('username', username)
      .is('deleted_at', null);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q.single();
    if (data) throw new ConflictException('Username already exists.');
  }

  private async assertUniqueEmail(email: string, excludeId?: string) {
    let q = this.supabase.db
      .from('users')
      .select('id')
      .eq('email', email)
      .is('deleted_at', null);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q.single();
    if (data) throw new ConflictException('Email already exists.');
  }

  private async validateRelations(roleId?: string, moduleTypeId?: string) {
    if (roleId) {
      const { data } = await this.supabase.db
        .from('roles')
        .select('id')
        .eq('id', roleId)
        .is('deleted_at', null)
        .single();
      if (!data) throw new NotFoundException('Role not found.');
    }

    if (moduleTypeId) {
      const { data } = await this.supabase.db
        .from('modules')
        .select('id')
        .eq('id', moduleTypeId)
        .is('deleted_at', null)
        .single();
      if (!data) throw new NotFoundException('Module type not found.');
    }
  }
}
