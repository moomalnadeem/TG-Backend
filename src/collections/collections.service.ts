import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { AddItemsDto } from './dto/add-items.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { ListCollectionsDto } from './dto/list-collections.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { UpdateItemOrderDto } from './dto/update-item-order.dto';

const ALLOWED_MIME_TYPES      = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_ICON_MIME_TYPES = [...ALLOWED_MIME_TYPES, 'image/svg+xml'];

type UploadedFiles = {
  thumbnail?: Express.Multer.File[];
  banner?:    Express.Multer.File[];
  images?:    Express.Multer.File[];
  icon?:      Express.Multer.File[];
};

const SETUP_SQL = `
  CREATE TABLE IF NOT EXISTS collections (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(255) NOT NULL,
    slug              VARCHAR(255) NOT NULL,
    short_description TEXT,
    description       TEXT,
    thumbnail         VARCHAR(500),
    banner            VARCHAR(500),
    images            TEXT,
    icon              VARCHAR(500),
    color             VARCHAR(20),
    featured          BOOLEAN      NOT NULL DEFAULT false,
    sort_order        INTEGER      NOT NULL DEFAULT 0,
    publish_status    BOOLEAN      NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
  );
  ALTER TABLE collections ADD COLUMN IF NOT EXISTS short_description TEXT;
  ALTER TABLE collections ADD COLUMN IF NOT EXISTS description       TEXT;
  ALTER TABLE collections ADD COLUMN IF NOT EXISTS thumbnail         VARCHAR(500);
  ALTER TABLE collections ADD COLUMN IF NOT EXISTS banner            VARCHAR(500);
  ALTER TABLE collections ADD COLUMN IF NOT EXISTS images            TEXT;
  ALTER TABLE collections ADD COLUMN IF NOT EXISTS icon              VARCHAR(500);
  ALTER TABLE collections ADD COLUMN IF NOT EXISTS color             VARCHAR(20);
  ALTER TABLE collections ADD COLUMN IF NOT EXISTS featured          BOOLEAN NOT NULL DEFAULT false;
  ALTER TABLE collections ADD COLUMN IF NOT EXISTS sort_order        INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE collections ADD COLUMN IF NOT EXISTS publish_status    BOOLEAN NOT NULL DEFAULT true;
  ALTER TABLE collections ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE collections ADD COLUMN IF NOT EXISTS deleted_at        TIMESTAMPTZ;

  CREATE TABLE IF NOT EXISTS collection_items (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID        NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    item_type     TEXT        NOT NULL CHECK (item_type IN ('destination','attraction','tour','hotel','restaurant','event','package')),
    item_id       UUID        NOT NULL,
    sort_order    INTEGER     NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_coll_slug          ON collections(slug)                        WHERE deleted_at IS NULL;
  CREATE INDEX        IF NOT EXISTS idx_coll_featured      ON collections(featured)                    WHERE deleted_at IS NULL;
  CREATE INDEX        IF NOT EXISTS idx_coll_publish       ON collections(publish_status)              WHERE deleted_at IS NULL;
  CREATE INDEX        IF NOT EXISTS idx_coll_sort_order    ON collections(sort_order);
  CREATE INDEX        IF NOT EXISTS idx_coll_deleted_at    ON collections(deleted_at);
  CREATE INDEX        IF NOT EXISTS idx_coll_items_coll    ON collection_items(collection_id);
  CREATE INDEX        IF NOT EXISTS idx_coll_items_type    ON collection_items(item_type);
  CREATE INDEX        IF NOT EXISTS idx_coll_items_order   ON collection_items(sort_order);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_coll_items_unique  ON collection_items(collection_id, item_type, item_id);

  SELECT pg_notify('pgrst', 'reload schema');
`;

const COLL_LIST_FIELDS = [
  'id', 'name', 'slug', 'short_description', 'thumbnail', 'icon', 'color',
  'featured', 'sort_order', 'publish_status', 'created_at',
].join(', ');

const COLL_DETAIL_FIELDS = [
  'id', 'name', 'slug', 'short_description', 'description',
  'thumbnail', 'banner', 'images', 'icon', 'color',
  'featured', 'sort_order', 'publish_status', 'created_at', 'updated_at',
].join(', ');

@Injectable()
export class CollectionsService {
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

    return { success: true, message: 'Collections tables migrated successfully.' };
  }

  // ─── Dropdown ────────────────────────────────────────────────────────────────

  async dropdown(): Promise<{ success: boolean; data: object[] }> {
    const { data, error } = await this.supabase.db
      .from('collections')
      .select('id, name, slug, thumbnail, icon, color')
      .eq('publish_status', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message);
    return { success: true, data: data ?? [] };
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(
    dto: CreateCollectionDto,
    files: UploadedFiles,
  ): Promise<{ success: boolean; message: string; data: object }> {
    const slug = dto.slug ?? this.generateSlug(dto.name);
    await this.assertUniqueSlug(slug);

    const [thumbnailUrl, bannerUrl, iconUrl, imageUrls] = await Promise.all([
      files?.thumbnail?.[0] ? this.uploadFile(files.thumbnail[0], 'collection-thumbnails', ALLOWED_MIME_TYPES)      : Promise.resolve(null),
      files?.banner?.[0]    ? this.uploadFile(files.banner[0],    'collection-banners',    ALLOWED_MIME_TYPES)      : Promise.resolve(null),
      files?.icon?.[0]      ? this.uploadFile(files.icon[0],      'collection-icons',      ALLOWED_ICON_MIME_TYPES) : Promise.resolve(null),
      files?.images?.length ? this.uploadMultiple(files.images,   'collection-images',     ALLOWED_MIME_TYPES)      : Promise.resolve([]),
    ]);

    const { data: rawData, error } = await this.supabase.db
      .from('collections')
      .insert({
        name:              dto.name,
        slug,
        short_description: dto.short_description ?? null,
        description:       dto.description       ?? null,
        thumbnail:         thumbnailUrl,
        banner:            bannerUrl,
        images:            imageUrls.length ? JSON.stringify(imageUrls) : null,
        icon:              iconUrl,
        color:             dto.color            ?? null,
        featured:          dto.featured,
        sort_order:        dto.sort_order        ?? 0,
        publish_status:    dto.publish_status,
      })
      .select(COLL_DETAIL_FIELDS)
      .single();

    if (error) throw new Error(error.message);
    const data = rawData as Record<string, any>;

    return {
      success: true,
      message: 'Collection created successfully.',
      data: { ...data, images: this.parseImages(data.images), total_items: 0, items: [] },
    };
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(query: ListCollectionsDto) {
    const {
      page = 1, limit = 10, search,
      featured, publish_status,
      sortBy = 'sort_order', sortOrder = 'ASC',
    } = query;

    const from = (page - 1) * limit;

    let dbQuery = this.supabase.db
      .from('collections')
      .select(COLL_LIST_FIELDS, { count: 'exact' })
      .is('deleted_at', null);

    if (search) {
      dbQuery = dbQuery.or(
        `name.ilike.%${search}%,slug.ilike.%${search}%,short_description.ilike.%${search}%`,
      );
    }
    if (featured       !== undefined) dbQuery = dbQuery.eq('featured',       featured);
    if (publish_status !== undefined) dbQuery = dbQuery.eq('publish_status', publish_status);

    const { data, error, count } = await dbQuery
      .order(sortBy, { ascending: sortOrder === 'ASC' })
      .range(from, from + limit - 1);

    if (error) throw new Error(error.message);

    const enriched = await this.attachItemCounts(data ?? []);
    return { success: true, data: enriched, pagination: { page, limit, total: count ?? 0 } };
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const { data: rawData, error } = await this.supabase.db
      .from('collections')
      .select(COLL_DETAIL_FIELDS)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !rawData) throw new NotFoundException('Collection not found.');
    const data = rawData as Record<string, any>;

    const items = await this.fetchItems(id);

    return {
      success: true,
      data: { ...data, images: this.parseImages(data.images), total_items: items.length, items },
    };
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateCollectionDto,
    files: UploadedFiles,
  ): Promise<{ success: boolean; message: string; data: object }> {
    const { data: existing } = await this.supabase.db
      .from('collections')
      .select('id, images')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Collection not found.');

    const updates: Record<string, any> = { ...dto, updated_at: new Date().toISOString() };

    if (dto.slug) {
      await this.assertUniqueSlug(dto.slug, id);
    } else if (dto.name) {
      updates.slug = this.generateSlug(dto.name);
    }

    const [thumbnailUrl, bannerUrl, iconUrl] = await Promise.all([
      files?.thumbnail?.[0] ? this.uploadFile(files.thumbnail[0], 'collection-thumbnails', ALLOWED_MIME_TYPES)      : Promise.resolve(null),
      files?.banner?.[0]    ? this.uploadFile(files.banner[0],    'collection-banners',    ALLOWED_MIME_TYPES)      : Promise.resolve(null),
      files?.icon?.[0]      ? this.uploadFile(files.icon[0],      'collection-icons',      ALLOWED_ICON_MIME_TYPES) : Promise.resolve(null),
    ]);

    if (thumbnailUrl) updates.thumbnail = thumbnailUrl;
    if (bannerUrl)    updates.banner    = bannerUrl;
    if (iconUrl)      updates.icon      = iconUrl;

    if (files?.images?.length) {
      const newUrls  = await this.uploadMultiple(files.images, 'collection-images', ALLOWED_MIME_TYPES);
      const current  = this.parseImages(existing.images);
      updates.images = JSON.stringify([...current, ...newUrls]);
    }

    const { data: rawUpdated, error } = await this.supabase.db
      .from('collections')
      .update(updates)
      .eq('id', id)
      .select(COLL_DETAIL_FIELDS)
      .single();

    if (error) throw new Error(error.message);
    const updated = rawUpdated as Record<string, any>;

    const items = await this.fetchItems(id);

    return {
      success: true,
      message: 'Collection updated successfully.',
      data: { ...updated, images: this.parseImages(updated.images), total_items: items.length, items },
    };
  }

  // ─── Delete (Soft) ───────────────────────────────────────────────────────────

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const { data: existing } = await this.supabase.db
      .from('collections')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Collection not found.');

    const { error } = await this.supabase.db
      .from('collections')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true, message: 'Collection deleted successfully.' };
  }

  // ─── Gallery: Add Images ──────────────────────────────────────────────────────

  async addGalleryImages(
    id: string,
    files: Express.Multer.File[],
  ): Promise<{ success: boolean; message: string; data: { images: string[] } }> {
    const { data: existing } = await this.supabase.db
      .from('collections')
      .select('id, images')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Collection not found.');
    if (!files?.length) throw new UnprocessableEntityException('No images provided.');

    const newUrls = await this.uploadMultiple(files, 'collection-images', ALLOWED_MIME_TYPES);
    const current = this.parseImages(existing.images);
    const merged  = [...current, ...newUrls];

    const { error } = await this.supabase.db
      .from('collections')
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
      .from('collections')
      .select('id, images')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Collection not found.');

    const images = this.parseImages(existing.images).filter(url => url !== imageUrl);

    const { error } = await this.supabase.db
      .from('collections')
      .update({
        images: images.length ? JSON.stringify(images) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true, message: 'Gallery image removed successfully.', data: { images } };
  }

  // ─── Items: Add / Upsert ─────────────────────────────────────────────────────

  async addItems(
    id: string,
    dto: AddItemsDto,
  ): Promise<{ success: boolean; message: string; data: { inserted: number; items: object[] } }> {
    await this.assertCollectionExists(id);

    const rows = dto.items.map(item => ({
      collection_id: id,
      item_type:     item.item_type,
      item_id:       item.item_id,
      sort_order:    item.sort_order ?? 0,
    }));

    const { data, error } = await this.supabase.db
      .from('collection_items')
      .upsert(rows, { onConflict: 'collection_id,item_type,item_id', ignoreDuplicates: false })
      .select('id, collection_id, item_type, item_id, sort_order, created_at');

    if (error) throw new Error(error.message);

    const items = await this.fetchItems(id);

    return {
      success: true,
      message: `${data?.length ?? 0} item(s) added/updated in collection.`,
      data: { inserted: data?.length ?? 0, items },
    };
  }

  // ─── Items: Remove ───────────────────────────────────────────────────────────

  async removeItem(
    collectionId: string,
    itemId: string,
  ): Promise<{ success: boolean; message: string; data: { items: object[] } }> {
    await this.assertCollectionExists(collectionId);

    const { data: existing } = await this.supabase.db
      .from('collection_items')
      .select('id')
      .eq('id', itemId)
      .eq('collection_id', collectionId)
      .maybeSingle();

    if (!existing) throw new NotFoundException('Collection item not found.');

    const { error } = await this.supabase.db
      .from('collection_items')
      .delete()
      .eq('id', itemId);

    if (error) throw new Error(error.message);

    const items = await this.fetchItems(collectionId);
    return { success: true, message: 'Item removed from collection.', data: { items } };
  }

  // ─── Items: Update Order ─────────────────────────────────────────────────────

  async updateItemOrder(
    collectionId: string,
    dto: UpdateItemOrderDto,
  ): Promise<{ success: boolean; message: string; data: { items: object[] } }> {
    await this.assertCollectionExists(collectionId);

    await Promise.all(
      dto.items.map(item =>
        this.supabase.db
          .from('collection_items')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id)
          .eq('collection_id', collectionId),
      ),
    );

    const items = await this.fetchItems(collectionId);
    return { success: true, message: 'Item order updated.', data: { items } };
  }

  // ─── Items: List ─────────────────────────────────────────────────────────────

  async getItems(collectionId: string): Promise<{ success: boolean; data: object[] }> {
    await this.assertCollectionExists(collectionId);
    const items = await this.fetchItems(collectionId);
    return { success: true, data: items };
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

  private async assertCollectionExists(id: string) {
    const { data } = await this.supabase.db
      .from('collections')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!data) throw new NotFoundException('Collection not found.');
  }

  private async assertUniqueSlug(slug: string, excludeId?: string) {
    let q = this.supabase.db
      .from('collections')
      .select('id')
      .eq('slug', slug)
      .is('deleted_at', null);
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q.maybeSingle();
    if (data) throw new ConflictException('A collection with this slug already exists.');
  }

  private async fetchItems(collectionId: string): Promise<object[]> {
    const { data } = await this.supabase.db
      .from('collection_items')
      .select('id, collection_id, item_type, item_id, sort_order, created_at')
      .eq('collection_id', collectionId)
      .order('sort_order', { ascending: true });
    return data ?? [];
  }

  private async attachItemCounts(collections: any[]): Promise<any[]> {
    if (!collections.length) return collections;

    const ids = collections.map(c => c.id);
    const { data: itemRows } = await this.supabase.db
      .from('collection_items')
      .select('collection_id')
      .in('collection_id', ids);

    const countMap: Record<string, number> = {};
    for (const row of itemRows ?? []) {
      countMap[row.collection_id] = (countMap[row.collection_id] ?? 0) + 1;
    }

    return collections.map(c => ({ ...c, total_items: countMap[c.id] ?? 0 }));
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
}
