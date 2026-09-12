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

const SEED_LANGUAGES = [
  { name: 'Afrikaans',           code: 'af',  native_name: 'Afrikaans',            locale: 'af-ZA',  direction: 'LTR' },
  { name: 'Albanian',            code: 'sq',  native_name: 'Shqip',                locale: 'sq-AL',  direction: 'LTR' },
  { name: 'Amharic',             code: 'am',  native_name: 'አማርኛ',                 locale: 'am-ET',  direction: 'LTR' },
  { name: 'Armenian',            code: 'hy',  native_name: 'Հայերեն',              locale: 'hy-AM',  direction: 'LTR' },
  { name: 'Azerbaijani',         code: 'az',  native_name: 'Azərbaycan dili',      locale: 'az-AZ',  direction: 'LTR' },
  { name: 'Basque',              code: 'eu',  native_name: 'Euskara',              locale: 'eu-ES',  direction: 'LTR' },
  { name: 'Belarusian',          code: 'be',  native_name: 'Беларуская',           locale: 'be-BY',  direction: 'LTR' },
  { name: 'Bengali',             code: 'bn',  native_name: 'বাংলা',               locale: 'bn-BD',  direction: 'LTR' },
  { name: 'Bislama',             code: 'bi',  native_name: 'Bislama',              locale: 'bi-VU',  direction: 'LTR' },
  { name: 'Bosnian',             code: 'bs',  native_name: 'Bosanski',             locale: 'bs-BA',  direction: 'LTR' },
  { name: 'Bulgarian',           code: 'bg',  native_name: 'Български',            locale: 'bg-BG',  direction: 'LTR' },
  { name: 'Burmese',             code: 'my',  native_name: 'မြန်မာဘာသာ',          locale: 'my-MM',  direction: 'LTR' },
  { name: 'Catalan',             code: 'ca',  native_name: 'Català',               locale: 'ca-ES',  direction: 'LTR' },
  { name: 'Chinese (Simplified)',  code: 'zh',  native_name: '中文(简体)',           locale: 'zh-CN',  direction: 'LTR' },
  { name: 'Chinese (Traditional)', code: 'zh-TW', native_name: '中文(繁體)',       locale: 'zh-TW',  direction: 'LTR' },
  { name: 'Croatian',            code: 'hr',  native_name: 'Hrvatski',             locale: 'hr-HR',  direction: 'LTR' },
  { name: 'Czech',               code: 'cs',  native_name: 'Čeština',             locale: 'cs-CZ',  direction: 'LTR' },
  { name: 'Danish',              code: 'da',  native_name: 'Dansk',                locale: 'da-DK',  direction: 'LTR' },
  { name: 'Dari',                code: 'prs', native_name: 'دری',                  locale: 'prs-AF', direction: 'RTL' },
  { name: 'Dhivehi',             code: 'dv',  native_name: 'ދިވެހި',              locale: 'dv-MV',  direction: 'RTL' },
  { name: 'Dutch',               code: 'nl',  native_name: 'Nederlands',           locale: 'nl-NL',  direction: 'LTR' },
  { name: 'Dzongkha',            code: 'dz',  native_name: 'རྫོང་ཁ',              locale: 'dz-BT',  direction: 'LTR' },
  { name: 'Estonian',            code: 'et',  native_name: 'Eesti',                locale: 'et-EE',  direction: 'LTR' },
  { name: 'Ewe',                 code: 'ee',  native_name: 'Eʋegbe',               locale: 'ee-GH',  direction: 'LTR' },
  { name: 'Fijian',              code: 'fj',  native_name: 'Vosa Vakaviti',        locale: 'fj-FJ',  direction: 'LTR' },
  { name: 'Filipino',            code: 'tl',  native_name: 'Filipino',             locale: 'tl-PH',  direction: 'LTR' },
  { name: 'Finnish',             code: 'fi',  native_name: 'Suomi',                locale: 'fi-FI',  direction: 'LTR' },
  { name: 'French',              code: 'fr',  native_name: 'Français',             locale: 'fr-FR',  direction: 'LTR' },
  { name: 'Galician',            code: 'gl',  native_name: 'Galego',               locale: 'gl-ES',  direction: 'LTR' },
  { name: 'Georgian',            code: 'ka',  native_name: 'ქართული',             locale: 'ka-GE',  direction: 'LTR' },
  { name: 'German',              code: 'de',  native_name: 'Deutsch',              locale: 'de-DE',  direction: 'LTR' },
  { name: 'Greek',               code: 'el',  native_name: 'Ελληνικά',            locale: 'el-GR',  direction: 'LTR' },
  { name: 'Guaraní',             code: 'gn',  native_name: "Avañe'ẽ",             locale: 'gn-PY',  direction: 'LTR' },
  { name: 'Gujarati',            code: 'gu',  native_name: 'ગુજરાતી',             locale: 'gu-IN',  direction: 'LTR' },
  { name: 'Haitian Creole',      code: 'ht',  native_name: 'Kreyòl ayisyen',       locale: 'ht-HT',  direction: 'LTR' },
  { name: 'Hausa',               code: 'ha',  native_name: 'Hausa',                locale: 'ha-NG',  direction: 'LTR' },
  { name: 'Hebrew',              code: 'he',  native_name: 'עברית',               locale: 'he-IL',  direction: 'RTL' },
  { name: 'Hindi',               code: 'hi',  native_name: 'हिन्दी',              locale: 'hi-IN',  direction: 'LTR' },
  { name: 'Hungarian',           code: 'hu',  native_name: 'Magyar',               locale: 'hu-HU',  direction: 'LTR' },
  { name: 'Icelandic',           code: 'is',  native_name: 'Íslenska',            locale: 'is-IS',  direction: 'LTR' },
  { name: 'Igbo',                code: 'ig',  native_name: 'Igbo',                 locale: 'ig-NG',  direction: 'LTR' },
  { name: 'Indonesian',          code: 'id',  native_name: 'Bahasa Indonesia',     locale: 'id-ID',  direction: 'LTR' },
  { name: 'Irish',               code: 'ga',  native_name: 'Gaeilge',             locale: 'ga-IE',  direction: 'LTR' },
  { name: 'Italian',             code: 'it',  native_name: 'Italiano',             locale: 'it-IT',  direction: 'LTR' },
  { name: 'Japanese',            code: 'ja',  native_name: '日本語',               locale: 'ja-JP',  direction: 'LTR' },
  { name: 'Kannada',             code: 'kn',  native_name: 'ಕನ್ನಡ',               locale: 'kn-IN',  direction: 'LTR' },
  { name: 'Kazakh',              code: 'kk',  native_name: 'Қазақ тілі',          locale: 'kk-KZ',  direction: 'LTR' },
  { name: 'Khmer',               code: 'km',  native_name: 'ភាសាខ្មែរ',           locale: 'km-KH',  direction: 'LTR' },
  { name: 'Kinyarwanda',         code: 'rw',  native_name: 'Ikinyarwanda',         locale: 'rw-RW',  direction: 'LTR' },
  { name: 'Kirundi',             code: 'rn',  native_name: 'Ikirundi',             locale: 'rn-BI',  direction: 'LTR' },
  { name: 'Korean',              code: 'ko',  native_name: '한국어',               locale: 'ko-KR',  direction: 'LTR' },
  { name: 'Kurdish',             code: 'ku',  native_name: 'Kurdî',               locale: 'ku-IQ',  direction: 'LTR' },
  { name: 'Kyrgyz',              code: 'ky',  native_name: 'Кыргыз тили',         locale: 'ky-KG',  direction: 'LTR' },
  { name: 'Lao',                 code: 'lo',  native_name: 'ພາສາລາວ',             locale: 'lo-LA',  direction: 'LTR' },
  { name: 'Latin',               code: 'la',  native_name: 'Latina',               locale: 'la-VA',  direction: 'LTR' },
  { name: 'Latvian',             code: 'lv',  native_name: 'Latviešu',            locale: 'lv-LV',  direction: 'LTR' },
  { name: 'Lingala',             code: 'ln',  native_name: 'Lingála',             locale: 'ln-CD',  direction: 'LTR' },
  { name: 'Lithuanian',          code: 'lt',  native_name: 'Lietuvių',            locale: 'lt-LT',  direction: 'LTR' },
  { name: 'Luxembourgish',       code: 'lb',  native_name: 'Lëtzebuergesch',      locale: 'lb-LU',  direction: 'LTR' },
  { name: 'Macedonian',          code: 'mk',  native_name: 'Македонски',           locale: 'mk-MK',  direction: 'LTR' },
  { name: 'Malagasy',            code: 'mg',  native_name: 'Malagasy',             locale: 'mg-MG',  direction: 'LTR' },
  { name: 'Malay',               code: 'ms',  native_name: 'Bahasa Melayu',        locale: 'ms-MY',  direction: 'LTR' },
  { name: 'Malayalam',           code: 'ml',  native_name: 'മലയാളം',              locale: 'ml-IN',  direction: 'LTR' },
  { name: 'Maltese',             code: 'mt',  native_name: 'Malti',                locale: 'mt-MT',  direction: 'LTR' },
  { name: 'Marathi',             code: 'mr',  native_name: 'मराठी',               locale: 'mr-IN',  direction: 'LTR' },
  { name: 'Marshallese',         code: 'mh',  native_name: 'Kajin M̧ajeļ',        locale: 'mh-MH',  direction: 'LTR' },
  { name: 'Mongolian',           code: 'mn',  native_name: 'Монгол хэл',          locale: 'mn-MN',  direction: 'LTR' },
  { name: 'Nauruan',             code: 'na',  native_name: 'Dorerin Naoero',       locale: 'na-NR',  direction: 'LTR' },
  { name: 'Nepali',              code: 'ne',  native_name: 'नेपाली',              locale: 'ne-NP',  direction: 'LTR' },
  { name: 'Norwegian',           code: 'no',  native_name: 'Norsk',                locale: 'no-NO',  direction: 'LTR' },
  { name: 'Pashto',              code: 'ps',  native_name: 'پښتو',                locale: 'ps-AF',  direction: 'RTL' },
  { name: 'Persian',             code: 'fa',  native_name: 'فارسی',               locale: 'fa-IR',  direction: 'RTL' },
  { name: 'Polish',              code: 'pl',  native_name: 'Polski',               locale: 'pl-PL',  direction: 'LTR' },
  { name: 'Portuguese',          code: 'pt',  native_name: 'Português',            locale: 'pt-BR',  direction: 'LTR' },
  { name: 'Punjabi',             code: 'pa',  native_name: 'ਪੰਜਾਬੀ',              locale: 'pa-IN',  direction: 'LTR' },
  { name: 'Romanian',            code: 'ro',  native_name: 'Română',              locale: 'ro-RO',  direction: 'LTR' },
  { name: 'Russian',             code: 'ru',  native_name: 'Русский',              locale: 'ru-RU',  direction: 'LTR' },
  { name: 'Samoan',              code: 'sm',  native_name: "Gagana fa'a Sāmoa",   locale: 'sm-WS',  direction: 'LTR' },
  { name: 'Serbian',             code: 'sr',  native_name: 'Српски',              locale: 'sr-RS',  direction: 'LTR' },
  { name: 'Shona',               code: 'sn',  native_name: 'ChiShona',             locale: 'sn-ZW',  direction: 'LTR' },
  { name: 'Sinhala',             code: 'si',  native_name: 'සිංහල',               locale: 'si-LK',  direction: 'LTR' },
  { name: 'Slovak',              code: 'sk',  native_name: 'Slovenčina',          locale: 'sk-SK',  direction: 'LTR' },
  { name: 'Slovenian',           code: 'sl',  native_name: 'Slovenščina',         locale: 'sl-SI',  direction: 'LTR' },
  { name: 'Somali',              code: 'so',  native_name: 'Soomaali',             locale: 'so-SO',  direction: 'LTR' },
  { name: 'Spanish',             code: 'es',  native_name: 'Español',             locale: 'es-ES',  direction: 'LTR' },
  { name: 'Swahili',             code: 'sw',  native_name: 'Kiswahili',            locale: 'sw-KE',  direction: 'LTR' },
  { name: 'Swedish',             code: 'sv',  native_name: 'Svenska',              locale: 'sv-SE',  direction: 'LTR' },
  { name: 'Tajik',               code: 'tg',  native_name: 'Тоҷикӣ',             locale: 'tg-TJ',  direction: 'LTR' },
  { name: 'Tamil',               code: 'ta',  native_name: 'தமிழ்',               locale: 'ta-IN',  direction: 'LTR' },
  { name: 'Telugu',              code: 'te',  native_name: 'తెలుగు',              locale: 'te-IN',  direction: 'LTR' },
  { name: 'Tetum',               code: 'tet', native_name: 'Tetum',                locale: 'tet-TL', direction: 'LTR' },
  { name: 'Thai',                code: 'th',  native_name: 'ภาษาไทย',             locale: 'th-TH',  direction: 'LTR' },
  { name: 'Tigrinya',            code: 'ti',  native_name: 'ትግርኛ',                locale: 'ti-ER',  direction: 'LTR' },
  { name: 'Tok Pisin',           code: 'tpi', native_name: 'Tok Pisin',            locale: 'tpi-PG', direction: 'LTR' },
  { name: 'Tongan',              code: 'to',  native_name: 'Lea fakatonga',        locale: 'to-TO',  direction: 'LTR' },
  { name: 'Turkish',             code: 'tr',  native_name: 'Türkçe',             locale: 'tr-TR',  direction: 'LTR' },
  { name: 'Turkmen',             code: 'tk',  native_name: 'Türkmençe',           locale: 'tk-TM',  direction: 'LTR' },
  { name: 'Ukrainian',           code: 'uk',  native_name: 'Українська',          locale: 'uk-UA',  direction: 'LTR' },
  { name: 'Urdu',                code: 'ur',  native_name: 'اردو',                locale: 'ur-PK',  direction: 'RTL' },
  { name: 'Uzbek',               code: 'uz',  native_name: "O'zbek tili",         locale: 'uz-UZ',  direction: 'LTR' },
  { name: 'Vietnamese',          code: 'vi',  native_name: 'Tiếng Việt',         locale: 'vi-VN',  direction: 'LTR' },
  { name: 'Welsh',               code: 'cy',  native_name: 'Cymraeg',              locale: 'cy-GB',  direction: 'LTR' },
  { name: 'Xhosa',               code: 'xh',  native_name: 'isiXhosa',             locale: 'xh-ZA',  direction: 'LTR' },
  { name: 'Yoruba',              code: 'yo',  native_name: 'Yorùbá',              locale: 'yo-NG',  direction: 'LTR' },
  { name: 'Zulu',                code: 'zu',  native_name: 'isiZulu',              locale: 'zu-ZA',  direction: 'LTR' },
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

  // ─── Seed ────────────────────────────────────────────────────────────────────

  async seed(): Promise<{ success: boolean; message: string; data: { inserted: number; skipped: number } }> {
    const { data: existing } = await this.supabase.db
      .from('languages')
      .select('code')
      .is('deleted_at', null);

    const existingCodes = new Set((existing ?? []).map((r: any) => r.code).filter(Boolean));
    const toInsert = SEED_LANGUAGES.filter(l => !existingCodes.has(l.code));

    if (toInsert.length) {
      const { error } = await this.supabase.db
        .from('languages')
        .insert(toInsert.map(l => ({ ...l, is_default: false, status: true })));
      if (error) throw new Error(`Seed failed: ${error.message}`);
    }

    return {
      success: true,
      message: toInsert.length
        ? `Seeded ${toInsert.length} languages successfully.`
        : 'All languages already exist. Nothing inserted.',
      data: { inserted: toInsert.length, skipped: existingCodes.size },
    };
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
