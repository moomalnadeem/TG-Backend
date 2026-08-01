import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CitiesModule } from './cities/cities.module';
import { CollectionsModule } from './collections/collections.module';
import { DestinationsModule } from './destinations/destinations.module';
import { CountriesModule } from './countries/countries.module';
import { LanguagesModule } from './languages/languages.module';
import { AppModulesModule } from './modules/modules.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { RolesModule } from './roles/roles.module';
import { SeoModule } from './seo/seo.module';
import { SupabaseModule } from './supabase/supabase.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AuthModule,
    UsersModule,
    RolesModule,
    AppModulesModule,
    SeoModule,
    LanguagesModule,
    OrganizationsModule,
    CountriesModule,
    CitiesModule,
    DestinationsModule,
    CollectionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
