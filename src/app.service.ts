import { Injectable } from '@nestjs/common';
import { SupabaseService } from './supabase/supabase.service';

@Injectable()
export class AppService {
  constructor(private readonly supabase: SupabaseService) {}

  getHello(): string {
    return 'Hello Moomal Nadeem';
  }

  async checkDbConnection(): Promise<{
    connected: boolean;
    status: string;
    message: string;
    timestamp: string;
  }> {
    try {
      const { error } = await this.supabase.db
        .from('users')
        .select('id')
        .limit(1);

      if (error) {
        return {
          connected: false,
          status: 'error',
          message: error.message,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        connected: true,
        status: 'ok',
        message: 'Database connection is healthy',
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        connected: false,
        status: 'error',
        message: err?.message ?? 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
