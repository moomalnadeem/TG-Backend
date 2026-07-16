import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS seo (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    seo_title      VARCHAR(255) NOT NULL,
    seo_description TEXT,
    publish_status BOOLEAN      NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at     TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_seo_publish_status ON seo(publish_status);
  CREATE INDEX IF NOT EXISTS idx_seo_deleted_at     ON seo(deleted_at);
`;

@Injectable()
export class SeoService {
  constructor(private readonly supabase: SupabaseService) {}

  async setup(): Promise<{ success: boolean; message: string }> {
    const { error: checkError } = await this.supabase.db.from('seo').select('id').limit(1);

    if (!checkError) {
      return { success: true, message: 'SEO table already exists.' };
    }

    const isTableMissing =
      checkError.code === '42P01' ||
      checkError.code === 'PGRST200' ||
      (checkError.message ?? '').includes('schema cache');

    if (!isTableMissing) throw new Error(checkError.message);

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
      throw new Error(`Failed to create SEO table: ${body}`);
    }

    return { success: true, message: 'SEO table created successfully.' };
  }

  async dropdown(): Promise<{ success: boolean; data: object[] }> {
    const { data, error } = await this.supabase.db
      .from('seo')
      .select('id, seo_title')
      .eq('publish_status', true)
      .is('deleted_at', null)
      .order('seo_title', { ascending: true });

    if (error) throw new Error(error.message);

    return { success: true, data: data ?? [] };
  }
}
