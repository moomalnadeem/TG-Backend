import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCountryDto } from './dto/create-country.dto';
import { ListCountriesDto } from './dto/list-countries.dto';
import { UpdateCountryDto } from './dto/update-country.dto';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const SEED_COUNTRIES = [
  { name: 'Afghanistan',                        iso2: 'AF', iso3: 'AFG', phone_code: '+93',    currency: 'Afghan Afghani',                   currency_code: 'AFN', capital: 'Kabul',                     continent: 'Asia',          nationality: 'Afghan',            timezone: 'Asia/Kabul' },
  { name: 'Albania',                            iso2: 'AL', iso3: 'ALB', phone_code: '+355',   currency: 'Albanian Lek',                     currency_code: 'ALL', capital: 'Tirana',                    continent: 'Europe',        nationality: 'Albanian',          timezone: 'Europe/Tirane' },
  { name: 'Algeria',                            iso2: 'DZ', iso3: 'DZA', phone_code: '+213',   currency: 'Algerian Dinar',                   currency_code: 'DZD', capital: 'Algiers',                   continent: 'Africa',        nationality: 'Algerian',          timezone: 'Africa/Algiers' },
  { name: 'Andorra',                            iso2: 'AD', iso3: 'AND', phone_code: '+376',   currency: 'Euro',                             currency_code: 'EUR', capital: 'Andorra la Vella',          continent: 'Europe',        nationality: 'Andorran',          timezone: 'Europe/Andorra' },
  { name: 'Angola',                             iso2: 'AO', iso3: 'AGO', phone_code: '+244',   currency: 'Angolan Kwanza',                   currency_code: 'AOA', capital: 'Luanda',                    continent: 'Africa',        nationality: 'Angolan',           timezone: 'Africa/Luanda' },
  { name: 'Antigua and Barbuda',                iso2: 'AG', iso3: 'ATG', phone_code: '+1-268', currency: 'East Caribbean Dollar',            currency_code: 'XCD', capital: "Saint John's",              continent: 'North America', nationality: 'Antiguan',          timezone: 'America/Antigua' },
  { name: 'Argentina',                          iso2: 'AR', iso3: 'ARG', phone_code: '+54',    currency: 'Argentine Peso',                   currency_code: 'ARS', capital: 'Buenos Aires',               continent: 'South America', nationality: 'Argentine',         timezone: 'America/Argentina/Buenos_Aires' },
  { name: 'Armenia',                            iso2: 'AM', iso3: 'ARM', phone_code: '+374',   currency: 'Armenian Dram',                    currency_code: 'AMD', capital: 'Yerevan',                   continent: 'Asia',          nationality: 'Armenian',          timezone: 'Asia/Yerevan' },
  { name: 'Australia',                          iso2: 'AU', iso3: 'AUS', phone_code: '+61',    currency: 'Australian Dollar',                currency_code: 'AUD', capital: 'Canberra',                  continent: 'Oceania',       nationality: 'Australian',        timezone: 'Australia/Sydney' },
  { name: 'Austria',                            iso2: 'AT', iso3: 'AUT', phone_code: '+43',    currency: 'Euro',                             currency_code: 'EUR', capital: 'Vienna',                    continent: 'Europe',        nationality: 'Austrian',          timezone: 'Europe/Vienna' },
  { name: 'Azerbaijan',                         iso2: 'AZ', iso3: 'AZE', phone_code: '+994',   currency: 'Azerbaijani Manat',                currency_code: 'AZN', capital: 'Baku',                      continent: 'Asia',          nationality: 'Azerbaijani',       timezone: 'Asia/Baku' },
  { name: 'Bahamas',                            iso2: 'BS', iso3: 'BHS', phone_code: '+1-242', currency: 'Bahamian Dollar',                  currency_code: 'BSD', capital: 'Nassau',                    continent: 'North America', nationality: 'Bahamian',          timezone: 'America/Nassau' },
  { name: 'Bahrain',                            iso2: 'BH', iso3: 'BHR', phone_code: '+973',   currency: 'Bahraini Dinar',                   currency_code: 'BHD', capital: 'Manama',                    continent: 'Asia',          nationality: 'Bahraini',          timezone: 'Asia/Bahrain' },
  { name: 'Bangladesh',                         iso2: 'BD', iso3: 'BGD', phone_code: '+880',   currency: 'Bangladeshi Taka',                 currency_code: 'BDT', capital: 'Dhaka',                     continent: 'Asia',          nationality: 'Bangladeshi',       timezone: 'Asia/Dhaka' },
  { name: 'Barbados',                           iso2: 'BB', iso3: 'BRB', phone_code: '+1-246', currency: 'Barbadian Dollar',                 currency_code: 'BBD', capital: 'Bridgetown',                continent: 'North America', nationality: 'Barbadian',         timezone: 'America/Barbados' },
  { name: 'Belarus',                            iso2: 'BY', iso3: 'BLR', phone_code: '+375',   currency: 'Belarusian Ruble',                 currency_code: 'BYN', capital: 'Minsk',                     continent: 'Europe',        nationality: 'Belarusian',        timezone: 'Europe/Minsk' },
  { name: 'Belgium',                            iso2: 'BE', iso3: 'BEL', phone_code: '+32',    currency: 'Euro',                             currency_code: 'EUR', capital: 'Brussels',                  continent: 'Europe',        nationality: 'Belgian',           timezone: 'Europe/Brussels' },
  { name: 'Belize',                             iso2: 'BZ', iso3: 'BLZ', phone_code: '+501',   currency: 'Belize Dollar',                    currency_code: 'BZD', capital: 'Belmopan',                  continent: 'North America', nationality: 'Belizean',          timezone: 'America/Belize' },
  { name: 'Benin',                              iso2: 'BJ', iso3: 'BEN', phone_code: '+229',   currency: 'West African CFA Franc',           currency_code: 'XOF', capital: 'Porto-Novo',                continent: 'Africa',        nationality: 'Beninese',          timezone: 'Africa/Porto-Novo' },
  { name: 'Bhutan',                             iso2: 'BT', iso3: 'BTN', phone_code: '+975',   currency: 'Bhutanese Ngultrum',               currency_code: 'BTN', capital: 'Thimphu',                   continent: 'Asia',          nationality: 'Bhutanese',         timezone: 'Asia/Thimphu' },
  { name: 'Bolivia',                            iso2: 'BO', iso3: 'BOL', phone_code: '+591',   currency: 'Bolivian Boliviano',               currency_code: 'BOB', capital: 'Sucre',                     continent: 'South America', nationality: 'Bolivian',          timezone: 'America/La_Paz' },
  { name: 'Bosnia and Herzegovina',             iso2: 'BA', iso3: 'BIH', phone_code: '+387',   currency: 'Convertible Mark',                 currency_code: 'BAM', capital: 'Sarajevo',                  continent: 'Europe',        nationality: 'Bosnian',           timezone: 'Europe/Sarajevo' },
  { name: 'Botswana',                           iso2: 'BW', iso3: 'BWA', phone_code: '+267',   currency: 'Botswana Pula',                    currency_code: 'BWP', capital: 'Gaborone',                  continent: 'Africa',        nationality: 'Motswana',          timezone: 'Africa/Gaborone' },
  { name: 'Brazil',                             iso2: 'BR', iso3: 'BRA', phone_code: '+55',    currency: 'Brazilian Real',                   currency_code: 'BRL', capital: 'Brasilia',                  continent: 'South America', nationality: 'Brazilian',         timezone: 'America/Sao_Paulo' },
  { name: 'Brunei',                             iso2: 'BN', iso3: 'BRN', phone_code: '+673',   currency: 'Brunei Dollar',                    currency_code: 'BND', capital: 'Bandar Seri Begawan',       continent: 'Asia',          nationality: 'Bruneian',          timezone: 'Asia/Brunei' },
  { name: 'Bulgaria',                           iso2: 'BG', iso3: 'BGR', phone_code: '+359',   currency: 'Bulgarian Lev',                    currency_code: 'BGN', capital: 'Sofia',                     continent: 'Europe',        nationality: 'Bulgarian',         timezone: 'Europe/Sofia' },
  { name: 'Burkina Faso',                       iso2: 'BF', iso3: 'BFA', phone_code: '+226',   currency: 'West African CFA Franc',           currency_code: 'XOF', capital: 'Ouagadougou',               continent: 'Africa',        nationality: 'Burkinabe',         timezone: 'Africa/Ouagadougou' },
  { name: 'Burundi',                            iso2: 'BI', iso3: 'BDI', phone_code: '+257',   currency: 'Burundian Franc',                  currency_code: 'BIF', capital: 'Gitega',                    continent: 'Africa',        nationality: 'Burundian',         timezone: 'Africa/Bujumbura' },
  { name: 'Cabo Verde',                         iso2: 'CV', iso3: 'CPV', phone_code: '+238',   currency: 'Cape Verdean Escudo',              currency_code: 'CVE', capital: 'Praia',                     continent: 'Africa',        nationality: 'Cape Verdean',      timezone: 'Atlantic/Cape_Verde' },
  { name: 'Cambodia',                           iso2: 'KH', iso3: 'KHM', phone_code: '+855',   currency: 'Cambodian Riel',                   currency_code: 'KHR', capital: 'Phnom Penh',                continent: 'Asia',          nationality: 'Cambodian',         timezone: 'Asia/Phnom_Penh' },
  { name: 'Cameroon',                           iso2: 'CM', iso3: 'CMR', phone_code: '+237',   currency: 'Central African CFA Franc',        currency_code: 'XAF', capital: 'Yaounde',                   continent: 'Africa',        nationality: 'Cameroonian',       timezone: 'Africa/Douala' },
  { name: 'Canada',                             iso2: 'CA', iso3: 'CAN', phone_code: '+1',     currency: 'Canadian Dollar',                  currency_code: 'CAD', capital: 'Ottawa',                    continent: 'North America', nationality: 'Canadian',          timezone: 'America/Toronto' },
  { name: 'Central African Republic',           iso2: 'CF', iso3: 'CAF', phone_code: '+236',   currency: 'Central African CFA Franc',        currency_code: 'XAF', capital: 'Bangui',                    continent: 'Africa',        nationality: 'Central African',   timezone: 'Africa/Bangui' },
  { name: 'Chad',                               iso2: 'TD', iso3: 'TCD', phone_code: '+235',   currency: 'Central African CFA Franc',        currency_code: 'XAF', capital: "N'Djamena",                 continent: 'Africa',        nationality: 'Chadian',           timezone: 'Africa/Ndjamena' },
  { name: 'Chile',                              iso2: 'CL', iso3: 'CHL', phone_code: '+56',    currency: 'Chilean Peso',                     currency_code: 'CLP', capital: 'Santiago',                  continent: 'South America', nationality: 'Chilean',           timezone: 'America/Santiago' },
  { name: 'China',                              iso2: 'CN', iso3: 'CHN', phone_code: '+86',    currency: 'Chinese Yuan',                     currency_code: 'CNY', capital: 'Beijing',                   continent: 'Asia',          nationality: 'Chinese',           timezone: 'Asia/Shanghai' },
  { name: 'Colombia',                           iso2: 'CO', iso3: 'COL', phone_code: '+57',    currency: 'Colombian Peso',                   currency_code: 'COP', capital: 'Bogota',                    continent: 'South America', nationality: 'Colombian',         timezone: 'America/Bogota' },
  { name: 'Comoros',                            iso2: 'KM', iso3: 'COM', phone_code: '+269',   currency: 'Comorian Franc',                   currency_code: 'KMF', capital: 'Moroni',                    continent: 'Africa',        nationality: 'Comorian',          timezone: 'Indian/Comoro' },
  { name: 'Congo (Brazzaville)',                iso2: 'CG', iso3: 'COG', phone_code: '+242',   currency: 'Central African CFA Franc',        currency_code: 'XAF', capital: 'Brazzaville',               continent: 'Africa',        nationality: 'Congolese',         timezone: 'Africa/Brazzaville' },
  { name: 'Congo (DRC)',                        iso2: 'CD', iso3: 'COD', phone_code: '+243',   currency: 'Congolese Franc',                  currency_code: 'CDF', capital: 'Kinshasa',                  continent: 'Africa',        nationality: 'Congolese',         timezone: 'Africa/Kinshasa' },
  { name: 'Costa Rica',                         iso2: 'CR', iso3: 'CRI', phone_code: '+506',   currency: 'Costa Rican Colon',                currency_code: 'CRC', capital: 'San Jose',                  continent: 'North America', nationality: 'Costa Rican',       timezone: 'America/Costa_Rica' },
  { name: 'Croatia',                            iso2: 'HR', iso3: 'HRV', phone_code: '+385',   currency: 'Euro',                             currency_code: 'EUR', capital: 'Zagreb',                    continent: 'Europe',        nationality: 'Croatian',          timezone: 'Europe/Zagreb' },
  { name: 'Cuba',                               iso2: 'CU', iso3: 'CUB', phone_code: '+53',    currency: 'Cuban Peso',                       currency_code: 'CUP', capital: 'Havana',                    continent: 'North America', nationality: 'Cuban',             timezone: 'America/Havana' },
  { name: 'Cyprus',                             iso2: 'CY', iso3: 'CYP', phone_code: '+357',   currency: 'Euro',                             currency_code: 'EUR', capital: 'Nicosia',                   continent: 'Asia',          nationality: 'Cypriot',           timezone: 'Asia/Nicosia' },
  { name: 'Czech Republic',                     iso2: 'CZ', iso3: 'CZE', phone_code: '+420',   currency: 'Czech Koruna',                     currency_code: 'CZK', capital: 'Prague',                    continent: 'Europe',        nationality: 'Czech',             timezone: 'Europe/Prague' },
  { name: 'Denmark',                            iso2: 'DK', iso3: 'DNK', phone_code: '+45',    currency: 'Danish Krone',                     currency_code: 'DKK', capital: 'Copenhagen',                continent: 'Europe',        nationality: 'Danish',            timezone: 'Europe/Copenhagen' },
  { name: 'Djibouti',                           iso2: 'DJ', iso3: 'DJI', phone_code: '+253',   currency: 'Djiboutian Franc',                 currency_code: 'DJF', capital: 'Djibouti',                  continent: 'Africa',        nationality: 'Djiboutian',        timezone: 'Africa/Djibouti' },
  { name: 'Dominica',                           iso2: 'DM', iso3: 'DMA', phone_code: '+1-767', currency: 'East Caribbean Dollar',            currency_code: 'XCD', capital: 'Roseau',                    continent: 'North America', nationality: 'Dominican',         timezone: 'America/Dominica' },
  { name: 'Dominican Republic',                 iso2: 'DO', iso3: 'DOM', phone_code: '+1-809', currency: 'Dominican Peso',                   currency_code: 'DOP', capital: 'Santo Domingo',             continent: 'North America', nationality: 'Dominican',         timezone: 'America/Santo_Domingo' },
  { name: 'Ecuador',                            iso2: 'EC', iso3: 'ECU', phone_code: '+593',   currency: 'United States Dollar',             currency_code: 'USD', capital: 'Quito',                     continent: 'South America', nationality: 'Ecuadorian',        timezone: 'America/Guayaquil' },
  { name: 'Egypt',                              iso2: 'EG', iso3: 'EGY', phone_code: '+20',    currency: 'Egyptian Pound',                   currency_code: 'EGP', capital: 'Cairo',                     continent: 'Africa',        nationality: 'Egyptian',          timezone: 'Africa/Cairo' },
  { name: 'El Salvador',                        iso2: 'SV', iso3: 'SLV', phone_code: '+503',   currency: 'United States Dollar',             currency_code: 'USD', capital: 'San Salvador',              continent: 'North America', nationality: 'Salvadoran',        timezone: 'America/El_Salvador' },
  { name: 'Equatorial Guinea',                  iso2: 'GQ', iso3: 'GNQ', phone_code: '+240',   currency: 'Central African CFA Franc',        currency_code: 'XAF', capital: 'Malabo',                    continent: 'Africa',        nationality: 'Equatoguinean',     timezone: 'Africa/Malabo' },
  { name: 'Eritrea',                            iso2: 'ER', iso3: 'ERI', phone_code: '+291',   currency: 'Eritrean Nakfa',                   currency_code: 'ERN', capital: 'Asmara',                    continent: 'Africa',        nationality: 'Eritrean',          timezone: 'Africa/Asmara' },
  { name: 'Estonia',                            iso2: 'EE', iso3: 'EST', phone_code: '+372',   currency: 'Euro',                             currency_code: 'EUR', capital: 'Tallinn',                   continent: 'Europe',        nationality: 'Estonian',          timezone: 'Europe/Tallinn' },
  { name: 'Eswatini',                           iso2: 'SZ', iso3: 'SWZ', phone_code: '+268',   currency: 'Swazi Lilangeni',                  currency_code: 'SZL', capital: 'Mbabane',                   continent: 'Africa',        nationality: 'Swazi',             timezone: 'Africa/Mbabane' },
  { name: 'Ethiopia',                           iso2: 'ET', iso3: 'ETH', phone_code: '+251',   currency: 'Ethiopian Birr',                   currency_code: 'ETB', capital: 'Addis Ababa',               continent: 'Africa',        nationality: 'Ethiopian',         timezone: 'Africa/Addis_Ababa' },
  { name: 'Fiji',                               iso2: 'FJ', iso3: 'FJI', phone_code: '+679',   currency: 'Fijian Dollar',                    currency_code: 'FJD', capital: 'Suva',                      continent: 'Oceania',       nationality: 'Fijian',            timezone: 'Pacific/Fiji' },
  { name: 'Finland',                            iso2: 'FI', iso3: 'FIN', phone_code: '+358',   currency: 'Euro',                             currency_code: 'EUR', capital: 'Helsinki',                  continent: 'Europe',        nationality: 'Finnish',           timezone: 'Europe/Helsinki' },
  { name: 'France',                             iso2: 'FR', iso3: 'FRA', phone_code: '+33',    currency: 'Euro',                             currency_code: 'EUR', capital: 'Paris',                     continent: 'Europe',        nationality: 'French',            timezone: 'Europe/Paris' },
  { name: 'Gabon',                              iso2: 'GA', iso3: 'GAB', phone_code: '+241',   currency: 'Central African CFA Franc',        currency_code: 'XAF', capital: 'Libreville',                continent: 'Africa',        nationality: 'Gabonese',          timezone: 'Africa/Libreville' },
  { name: 'Gambia',                             iso2: 'GM', iso3: 'GMB', phone_code: '+220',   currency: 'Gambian Dalasi',                   currency_code: 'GMD', capital: 'Banjul',                    continent: 'Africa',        nationality: 'Gambian',           timezone: 'Africa/Banjul' },
  { name: 'Georgia',                            iso2: 'GE', iso3: 'GEO', phone_code: '+995',   currency: 'Georgian Lari',                    currency_code: 'GEL', capital: 'Tbilisi',                   continent: 'Asia',          nationality: 'Georgian',          timezone: 'Asia/Tbilisi' },
  { name: 'Germany',                            iso2: 'DE', iso3: 'DEU', phone_code: '+49',    currency: 'Euro',                             currency_code: 'EUR', capital: 'Berlin',                    continent: 'Europe',        nationality: 'German',            timezone: 'Europe/Berlin' },
  { name: 'Ghana',                              iso2: 'GH', iso3: 'GHA', phone_code: '+233',   currency: 'Ghanaian Cedi',                    currency_code: 'GHS', capital: 'Accra',                     continent: 'Africa',        nationality: 'Ghanaian',          timezone: 'Africa/Accra' },
  { name: 'Greece',                             iso2: 'GR', iso3: 'GRC', phone_code: '+30',    currency: 'Euro',                             currency_code: 'EUR', capital: 'Athens',                    continent: 'Europe',        nationality: 'Greek',             timezone: 'Europe/Athens' },
  { name: 'Grenada',                            iso2: 'GD', iso3: 'GRD', phone_code: '+1-473', currency: 'East Caribbean Dollar',            currency_code: 'XCD', capital: "Saint George's",            continent: 'North America', nationality: 'Grenadian',         timezone: 'America/Grenada' },
  { name: 'Guatemala',                          iso2: 'GT', iso3: 'GTM', phone_code: '+502',   currency: 'Guatemalan Quetzal',               currency_code: 'GTQ', capital: 'Guatemala City',            continent: 'North America', nationality: 'Guatemalan',        timezone: 'America/Guatemala' },
  { name: 'Guinea',                             iso2: 'GN', iso3: 'GIN', phone_code: '+224',   currency: 'Guinean Franc',                    currency_code: 'GNF', capital: 'Conakry',                   continent: 'Africa',        nationality: 'Guinean',           timezone: 'Africa/Conakry' },
  { name: 'Guinea-Bissau',                      iso2: 'GW', iso3: 'GNB', phone_code: '+245',   currency: 'West African CFA Franc',           currency_code: 'XOF', capital: 'Bissau',                    continent: 'Africa',        nationality: 'Guinean',           timezone: 'Africa/Bissau' },
  { name: 'Guyana',                             iso2: 'GY', iso3: 'GUY', phone_code: '+592',   currency: 'Guyanese Dollar',                  currency_code: 'GYD', capital: 'Georgetown',                continent: 'South America', nationality: 'Guyanese',          timezone: 'America/Guyana' },
  { name: 'Haiti',                              iso2: 'HT', iso3: 'HTI', phone_code: '+509',   currency: 'Haitian Gourde',                   currency_code: 'HTG', capital: 'Port-au-Prince',            continent: 'North America', nationality: 'Haitian',           timezone: 'America/Port-au-Prince' },
  { name: 'Honduras',                           iso2: 'HN', iso3: 'HND', phone_code: '+504',   currency: 'Honduran Lempira',                 currency_code: 'HNL', capital: 'Tegucigalpa',               continent: 'North America', nationality: 'Honduran',          timezone: 'America/Tegucigalpa' },
  { name: 'Hungary',                            iso2: 'HU', iso3: 'HUN', phone_code: '+36',    currency: 'Hungarian Forint',                 currency_code: 'HUF', capital: 'Budapest',                  continent: 'Europe',        nationality: 'Hungarian',         timezone: 'Europe/Budapest' },
  { name: 'Iceland',                            iso2: 'IS', iso3: 'ISL', phone_code: '+354',   currency: 'Icelandic Krona',                  currency_code: 'ISK', capital: 'Reykjavik',                 continent: 'Europe',        nationality: 'Icelandic',         timezone: 'Atlantic/Reykjavik' },
  { name: 'India',                              iso2: 'IN', iso3: 'IND', phone_code: '+91',    currency: 'Indian Rupee',                     currency_code: 'INR', capital: 'New Delhi',                 continent: 'Asia',          nationality: 'Indian',            timezone: 'Asia/Kolkata' },
  { name: 'Indonesia',                          iso2: 'ID', iso3: 'IDN', phone_code: '+62',    currency: 'Indonesian Rupiah',                currency_code: 'IDR', capital: 'Jakarta',                   continent: 'Asia',          nationality: 'Indonesian',        timezone: 'Asia/Jakarta' },
  { name: 'Iran',                               iso2: 'IR', iso3: 'IRN', phone_code: '+98',    currency: 'Iranian Rial',                     currency_code: 'IRR', capital: 'Tehran',                    continent: 'Asia',          nationality: 'Iranian',           timezone: 'Asia/Tehran' },
  { name: 'Iraq',                               iso2: 'IQ', iso3: 'IRQ', phone_code: '+964',   currency: 'Iraqi Dinar',                      currency_code: 'IQD', capital: 'Baghdad',                   continent: 'Asia',          nationality: 'Iraqi',             timezone: 'Asia/Baghdad' },
  { name: 'Ireland',                            iso2: 'IE', iso3: 'IRL', phone_code: '+353',   currency: 'Euro',                             currency_code: 'EUR', capital: 'Dublin',                    continent: 'Europe',        nationality: 'Irish',             timezone: 'Europe/Dublin' },
  { name: 'Israel',                             iso2: 'IL', iso3: 'ISR', phone_code: '+972',   currency: 'Israeli New Shekel',               currency_code: 'ILS', capital: 'Jerusalem',                 continent: 'Asia',          nationality: 'Israeli',           timezone: 'Asia/Jerusalem' },
  { name: 'Italy',                              iso2: 'IT', iso3: 'ITA', phone_code: '+39',    currency: 'Euro',                             currency_code: 'EUR', capital: 'Rome',                      continent: 'Europe',        nationality: 'Italian',           timezone: 'Europe/Rome' },
  { name: 'Jamaica',                            iso2: 'JM', iso3: 'JAM', phone_code: '+1-876', currency: 'Jamaican Dollar',                  currency_code: 'JMD', capital: 'Kingston',                  continent: 'North America', nationality: 'Jamaican',          timezone: 'America/Jamaica' },
  { name: 'Japan',                              iso2: 'JP', iso3: 'JPN', phone_code: '+81',    currency: 'Japanese Yen',                     currency_code: 'JPY', capital: 'Tokyo',                     continent: 'Asia',          nationality: 'Japanese',          timezone: 'Asia/Tokyo' },
  { name: 'Jordan',                             iso2: 'JO', iso3: 'JOR', phone_code: '+962',   currency: 'Jordanian Dinar',                  currency_code: 'JOD', capital: 'Amman',                     continent: 'Asia',          nationality: 'Jordanian',         timezone: 'Asia/Amman' },
  { name: 'Kazakhstan',                         iso2: 'KZ', iso3: 'KAZ', phone_code: '+7',     currency: 'Kazakhstani Tenge',                currency_code: 'KZT', capital: 'Astana',                    continent: 'Asia',          nationality: 'Kazakhstani',       timezone: 'Asia/Almaty' },
  { name: 'Kenya',                              iso2: 'KE', iso3: 'KEN', phone_code: '+254',   currency: 'Kenyan Shilling',                  currency_code: 'KES', capital: 'Nairobi',                   continent: 'Africa',        nationality: 'Kenyan',            timezone: 'Africa/Nairobi' },
  { name: 'Kiribati',                           iso2: 'KI', iso3: 'KIR', phone_code: '+686',   currency: 'Australian Dollar',                currency_code: 'AUD', capital: 'South Tarawa',              continent: 'Oceania',       nationality: 'I-Kiribati',        timezone: 'Pacific/Tarawa' },
  { name: 'Kosovo',                             iso2: 'XK', iso3: 'XKX', phone_code: '+383',   currency: 'Euro',                             currency_code: 'EUR', capital: 'Pristina',                  continent: 'Europe',        nationality: 'Kosovar',           timezone: 'Europe/Belgrade' },
  { name: 'Kuwait',                             iso2: 'KW', iso3: 'KWT', phone_code: '+965',   currency: 'Kuwaiti Dinar',                    currency_code: 'KWD', capital: 'Kuwait City',               continent: 'Asia',          nationality: 'Kuwaiti',           timezone: 'Asia/Kuwait' },
  { name: 'Kyrgyzstan',                         iso2: 'KG', iso3: 'KGZ', phone_code: '+996',   currency: 'Kyrgyzstani Som',                  currency_code: 'KGS', capital: 'Bishkek',                   continent: 'Asia',          nationality: 'Kyrgyz',            timezone: 'Asia/Bishkek' },
  { name: 'Laos',                               iso2: 'LA', iso3: 'LAO', phone_code: '+856',   currency: 'Lao Kip',                          currency_code: 'LAK', capital: 'Vientiane',                 continent: 'Asia',          nationality: 'Laotian',           timezone: 'Asia/Vientiane' },
  { name: 'Latvia',                             iso2: 'LV', iso3: 'LVA', phone_code: '+371',   currency: 'Euro',                             currency_code: 'EUR', capital: 'Riga',                      continent: 'Europe',        nationality: 'Latvian',           timezone: 'Europe/Riga' },
  { name: 'Lebanon',                            iso2: 'LB', iso3: 'LBN', phone_code: '+961',   currency: 'Lebanese Pound',                   currency_code: 'LBP', capital: 'Beirut',                    continent: 'Asia',          nationality: 'Lebanese',          timezone: 'Asia/Beirut' },
  { name: 'Lesotho',                            iso2: 'LS', iso3: 'LSO', phone_code: '+266',   currency: 'Lesotho Loti',                     currency_code: 'LSL', capital: 'Maseru',                    continent: 'Africa',        nationality: 'Basotho',           timezone: 'Africa/Maseru' },
  { name: 'Liberia',                            iso2: 'LR', iso3: 'LBR', phone_code: '+231',   currency: 'Liberian Dollar',                  currency_code: 'LRD', capital: 'Monrovia',                  continent: 'Africa',        nationality: 'Liberian',          timezone: 'Africa/Monrovia' },
  { name: 'Libya',                              iso2: 'LY', iso3: 'LBY', phone_code: '+218',   currency: 'Libyan Dinar',                     currency_code: 'LYD', capital: 'Tripoli',                   continent: 'Africa',        nationality: 'Libyan',            timezone: 'Africa/Tripoli' },
  { name: 'Liechtenstein',                      iso2: 'LI', iso3: 'LIE', phone_code: '+423',   currency: 'Swiss Franc',                      currency_code: 'CHF', capital: 'Vaduz',                     continent: 'Europe',        nationality: 'Liechtensteinisch', timezone: 'Europe/Vaduz' },
  { name: 'Lithuania',                          iso2: 'LT', iso3: 'LTU', phone_code: '+370',   currency: 'Euro',                             currency_code: 'EUR', capital: 'Vilnius',                   continent: 'Europe',        nationality: 'Lithuanian',        timezone: 'Europe/Vilnius' },
  { name: 'Luxembourg',                         iso2: 'LU', iso3: 'LUX', phone_code: '+352',   currency: 'Euro',                             currency_code: 'EUR', capital: 'Luxembourg City',           continent: 'Europe',        nationality: 'Luxembourgish',     timezone: 'Europe/Luxembourg' },
  { name: 'Madagascar',                         iso2: 'MG', iso3: 'MDG', phone_code: '+261',   currency: 'Malagasy Ariary',                  currency_code: 'MGA', capital: 'Antananarivo',              continent: 'Africa',        nationality: 'Malagasy',          timezone: 'Indian/Antananarivo' },
  { name: 'Malawi',                             iso2: 'MW', iso3: 'MWI', phone_code: '+265',   currency: 'Malawian Kwacha',                  currency_code: 'MWK', capital: 'Lilongwe',                  continent: 'Africa',        nationality: 'Malawian',          timezone: 'Africa/Blantyre' },
  { name: 'Malaysia',                           iso2: 'MY', iso3: 'MYS', phone_code: '+60',    currency: 'Malaysian Ringgit',                currency_code: 'MYR', capital: 'Kuala Lumpur',              continent: 'Asia',          nationality: 'Malaysian',         timezone: 'Asia/Kuala_Lumpur' },
  { name: 'Maldives',                           iso2: 'MV', iso3: 'MDV', phone_code: '+960',   currency: 'Maldivian Rufiyaa',                currency_code: 'MVR', capital: 'Male',                      continent: 'Asia',          nationality: 'Maldivian',         timezone: 'Indian/Maldives' },
  { name: 'Mali',                               iso2: 'ML', iso3: 'MLI', phone_code: '+223',   currency: 'West African CFA Franc',           currency_code: 'XOF', capital: 'Bamako',                    continent: 'Africa',        nationality: 'Malian',            timezone: 'Africa/Bamako' },
  { name: 'Malta',                              iso2: 'MT', iso3: 'MLT', phone_code: '+356',   currency: 'Euro',                             currency_code: 'EUR', capital: 'Valletta',                  continent: 'Europe',        nationality: 'Maltese',           timezone: 'Europe/Malta' },
  { name: 'Marshall Islands',                   iso2: 'MH', iso3: 'MHL', phone_code: '+692',   currency: 'United States Dollar',             currency_code: 'USD', capital: 'Majuro',                    continent: 'Oceania',       nationality: 'Marshallese',       timezone: 'Pacific/Majuro' },
  { name: 'Mauritania',                         iso2: 'MR', iso3: 'MRT', phone_code: '+222',   currency: 'Mauritanian Ouguiya',              currency_code: 'MRU', capital: 'Nouakchott',                continent: 'Africa',        nationality: 'Mauritanian',       timezone: 'Africa/Nouakchott' },
  { name: 'Mauritius',                          iso2: 'MU', iso3: 'MUS', phone_code: '+230',   currency: 'Mauritian Rupee',                  currency_code: 'MUR', capital: 'Port Louis',                continent: 'Africa',        nationality: 'Mauritian',         timezone: 'Indian/Mauritius' },
  { name: 'Mexico',                             iso2: 'MX', iso3: 'MEX', phone_code: '+52',    currency: 'Mexican Peso',                     currency_code: 'MXN', capital: 'Mexico City',               continent: 'North America', nationality: 'Mexican',           timezone: 'America/Mexico_City' },
  { name: 'Micronesia',                         iso2: 'FM', iso3: 'FSM', phone_code: '+691',   currency: 'United States Dollar',             currency_code: 'USD', capital: 'Palikir',                   continent: 'Oceania',       nationality: 'Micronesian',       timezone: 'Pacific/Pohnpei' },
  { name: 'Moldova',                            iso2: 'MD', iso3: 'MDA', phone_code: '+373',   currency: 'Moldovan Leu',                     currency_code: 'MDL', capital: 'Chisinau',                  continent: 'Europe',        nationality: 'Moldovan',          timezone: 'Europe/Chisinau' },
  { name: 'Monaco',                             iso2: 'MC', iso3: 'MCO', phone_code: '+377',   currency: 'Euro',                             currency_code: 'EUR', capital: 'Monaco',                    continent: 'Europe',        nationality: 'Monegasque',        timezone: 'Europe/Monaco' },
  { name: 'Mongolia',                           iso2: 'MN', iso3: 'MNG', phone_code: '+976',   currency: 'Mongolian Togrog',                 currency_code: 'MNT', capital: 'Ulaanbaatar',               continent: 'Asia',          nationality: 'Mongolian',         timezone: 'Asia/Ulaanbaatar' },
  { name: 'Montenegro',                         iso2: 'ME', iso3: 'MNE', phone_code: '+382',   currency: 'Euro',                             currency_code: 'EUR', capital: 'Podgorica',                 continent: 'Europe',        nationality: 'Montenegrin',       timezone: 'Europe/Podgorica' },
  { name: 'Morocco',                            iso2: 'MA', iso3: 'MAR', phone_code: '+212',   currency: 'Moroccan Dirham',                  currency_code: 'MAD', capital: 'Rabat',                     continent: 'Africa',        nationality: 'Moroccan',          timezone: 'Africa/Casablanca' },
  { name: 'Mozambique',                         iso2: 'MZ', iso3: 'MOZ', phone_code: '+258',   currency: 'Mozambican Metical',               currency_code: 'MZN', capital: 'Maputo',                    continent: 'Africa',        nationality: 'Mozambican',        timezone: 'Africa/Maputo' },
  { name: 'Myanmar',                            iso2: 'MM', iso3: 'MMR', phone_code: '+95',    currency: 'Myanmar Kyat',                     currency_code: 'MMK', capital: 'Naypyidaw',                 continent: 'Asia',          nationality: 'Burmese',           timezone: 'Asia/Rangoon' },
  { name: 'Namibia',                            iso2: 'NA', iso3: 'NAM', phone_code: '+264',   currency: 'Namibian Dollar',                  currency_code: 'NAD', capital: 'Windhoek',                  continent: 'Africa',        nationality: 'Namibian',          timezone: 'Africa/Windhoek' },
  { name: 'Nauru',                              iso2: 'NR', iso3: 'NRU', phone_code: '+674',   currency: 'Australian Dollar',                currency_code: 'AUD', capital: 'Yaren',                     continent: 'Oceania',       nationality: 'Nauruan',           timezone: 'Pacific/Nauru' },
  { name: 'Nepal',                              iso2: 'NP', iso3: 'NPL', phone_code: '+977',   currency: 'Nepalese Rupee',                   currency_code: 'NPR', capital: 'Kathmandu',                 continent: 'Asia',          nationality: 'Nepali',            timezone: 'Asia/Kathmandu' },
  { name: 'Netherlands',                        iso2: 'NL', iso3: 'NLD', phone_code: '+31',    currency: 'Euro',                             currency_code: 'EUR', capital: 'Amsterdam',                 continent: 'Europe',        nationality: 'Dutch',             timezone: 'Europe/Amsterdam' },
  { name: 'New Zealand',                        iso2: 'NZ', iso3: 'NZL', phone_code: '+64',    currency: 'New Zealand Dollar',               currency_code: 'NZD', capital: 'Wellington',                continent: 'Oceania',       nationality: 'New Zealander',     timezone: 'Pacific/Auckland' },
  { name: 'Nicaragua',                          iso2: 'NI', iso3: 'NIC', phone_code: '+505',   currency: 'Nicaraguan Cordoba',               currency_code: 'NIO', capital: 'Managua',                   continent: 'North America', nationality: 'Nicaraguan',        timezone: 'America/Managua' },
  { name: 'Niger',                              iso2: 'NE', iso3: 'NER', phone_code: '+227',   currency: 'West African CFA Franc',           currency_code: 'XOF', capital: 'Niamey',                    continent: 'Africa',        nationality: 'Nigerien',          timezone: 'Africa/Niamey' },
  { name: 'Nigeria',                            iso2: 'NG', iso3: 'NGA', phone_code: '+234',   currency: 'Nigerian Naira',                   currency_code: 'NGN', capital: 'Abuja',                     continent: 'Africa',        nationality: 'Nigerian',          timezone: 'Africa/Lagos' },
  { name: 'North Korea',                        iso2: 'KP', iso3: 'PRK', phone_code: '+850',   currency: 'North Korean Won',                 currency_code: 'KPW', capital: 'Pyongyang',                 continent: 'Asia',          nationality: 'North Korean',      timezone: 'Asia/Pyongyang' },
  { name: 'North Macedonia',                    iso2: 'MK', iso3: 'MKD', phone_code: '+389',   currency: 'Macedonian Denar',                 currency_code: 'MKD', capital: 'Skopje',                    continent: 'Europe',        nationality: 'Macedonian',        timezone: 'Europe/Skopje' },
  { name: 'Norway',                             iso2: 'NO', iso3: 'NOR', phone_code: '+47',    currency: 'Norwegian Krone',                  currency_code: 'NOK', capital: 'Oslo',                      continent: 'Europe',        nationality: 'Norwegian',         timezone: 'Europe/Oslo' },
  { name: 'Oman',                               iso2: 'OM', iso3: 'OMN', phone_code: '+968',   currency: 'Omani Rial',                       currency_code: 'OMR', capital: 'Muscat',                    continent: 'Asia',          nationality: 'Omani',             timezone: 'Asia/Muscat' },
  { name: 'Pakistan',                           iso2: 'PK', iso3: 'PAK', phone_code: '+92',    currency: 'Pakistani Rupee',                  currency_code: 'PKR', capital: 'Islamabad',                 continent: 'Asia',          nationality: 'Pakistani',         timezone: 'Asia/Karachi' },
  { name: 'Palau',                              iso2: 'PW', iso3: 'PLW', phone_code: '+680',   currency: 'United States Dollar',             currency_code: 'USD', capital: 'Ngerulmud',                 continent: 'Oceania',       nationality: 'Palauan',           timezone: 'Pacific/Palau' },
  { name: 'Palestine',                          iso2: 'PS', iso3: 'PSE', phone_code: '+970',   currency: 'Israeli New Shekel',               currency_code: 'ILS', capital: 'Ramallah',                  continent: 'Asia',          nationality: 'Palestinian',       timezone: 'Asia/Gaza' },
  { name: 'Panama',                             iso2: 'PA', iso3: 'PAN', phone_code: '+507',   currency: 'Panamanian Balboa',                currency_code: 'PAB', capital: 'Panama City',               continent: 'North America', nationality: 'Panamanian',        timezone: 'America/Panama' },
  { name: 'Papua New Guinea',                   iso2: 'PG', iso3: 'PNG', phone_code: '+675',   currency: 'Papua New Guinean Kina',           currency_code: 'PGK', capital: 'Port Moresby',              continent: 'Oceania',       nationality: 'Papua New Guinean', timezone: 'Pacific/Port_Moresby' },
  { name: 'Paraguay',                           iso2: 'PY', iso3: 'PRY', phone_code: '+595',   currency: 'Paraguayan Guarani',               currency_code: 'PYG', capital: 'Asuncion',                  continent: 'South America', nationality: 'Paraguayan',        timezone: 'America/Asuncion' },
  { name: 'Peru',                               iso2: 'PE', iso3: 'PER', phone_code: '+51',    currency: 'Peruvian Sol',                     currency_code: 'PEN', capital: 'Lima',                      continent: 'South America', nationality: 'Peruvian',          timezone: 'America/Lima' },
  { name: 'Philippines',                        iso2: 'PH', iso3: 'PHL', phone_code: '+63',    currency: 'Philippine Peso',                  currency_code: 'PHP', capital: 'Manila',                    continent: 'Asia',          nationality: 'Filipino',          timezone: 'Asia/Manila' },
  { name: 'Poland',                             iso2: 'PL', iso3: 'POL', phone_code: '+48',    currency: 'Polish Zloty',                     currency_code: 'PLN', capital: 'Warsaw',                    continent: 'Europe',        nationality: 'Polish',            timezone: 'Europe/Warsaw' },
  { name: 'Portugal',                           iso2: 'PT', iso3: 'PRT', phone_code: '+351',   currency: 'Euro',                             currency_code: 'EUR', capital: 'Lisbon',                    continent: 'Europe',        nationality: 'Portuguese',        timezone: 'Europe/Lisbon' },
  { name: 'Qatar',                              iso2: 'QA', iso3: 'QAT', phone_code: '+974',   currency: 'Qatari Riyal',                     currency_code: 'QAR', capital: 'Doha',                      continent: 'Asia',          nationality: 'Qatari',            timezone: 'Asia/Qatar' },
  { name: 'Romania',                            iso2: 'RO', iso3: 'ROU', phone_code: '+40',    currency: 'Romanian Leu',                     currency_code: 'RON', capital: 'Bucharest',                 continent: 'Europe',        nationality: 'Romanian',          timezone: 'Europe/Bucharest' },
  { name: 'Russia',                             iso2: 'RU', iso3: 'RUS', phone_code: '+7',     currency: 'Russian Ruble',                    currency_code: 'RUB', capital: 'Moscow',                    continent: 'Europe',        nationality: 'Russian',           timezone: 'Europe/Moscow' },
  { name: 'Rwanda',                             iso2: 'RW', iso3: 'RWA', phone_code: '+250',   currency: 'Rwandan Franc',                    currency_code: 'RWF', capital: 'Kigali',                    continent: 'Africa',        nationality: 'Rwandan',           timezone: 'Africa/Kigali' },
  { name: 'Saint Kitts and Nevis',              iso2: 'KN', iso3: 'KNA', phone_code: '+1-869', currency: 'East Caribbean Dollar',            currency_code: 'XCD', capital: 'Basseterre',                continent: 'North America', nationality: 'Kittitian',         timezone: 'America/St_Kitts' },
  { name: 'Saint Lucia',                        iso2: 'LC', iso3: 'LCA', phone_code: '+1-758', currency: 'East Caribbean Dollar',            currency_code: 'XCD', capital: 'Castries',                  continent: 'North America', nationality: 'Saint Lucian',      timezone: 'America/St_Lucia' },
  { name: 'Saint Vincent and the Grenadines',   iso2: 'VC', iso3: 'VCT', phone_code: '+1-784', currency: 'East Caribbean Dollar',            currency_code: 'XCD', capital: 'Kingstown',                 continent: 'North America', nationality: 'Vincentian',        timezone: 'America/St_Vincent' },
  { name: 'Samoa',                              iso2: 'WS', iso3: 'WSM', phone_code: '+685',   currency: 'Samoan Tala',                      currency_code: 'WST', capital: 'Apia',                      continent: 'Oceania',       nationality: 'Samoan',            timezone: 'Pacific/Apia' },
  { name: 'San Marino',                         iso2: 'SM', iso3: 'SMR', phone_code: '+378',   currency: 'Euro',                             currency_code: 'EUR', capital: 'San Marino',                continent: 'Europe',        nationality: 'Sammarinese',       timezone: 'Europe/San_Marino' },
  { name: 'Sao Tome and Principe',              iso2: 'ST', iso3: 'STP', phone_code: '+239',   currency: 'Sao Tome and Principe Dobra',      currency_code: 'STN', capital: 'Sao Tome',                  continent: 'Africa',        nationality: 'Sao Tomean',        timezone: 'Africa/Sao_Tome' },
  { name: 'Saudi Arabia',                       iso2: 'SA', iso3: 'SAU', phone_code: '+966',   currency: 'Saudi Riyal',                      currency_code: 'SAR', capital: 'Riyadh',                    continent: 'Asia',          nationality: 'Saudi Arabian',     timezone: 'Asia/Riyadh' },
  { name: 'Senegal',                            iso2: 'SN', iso3: 'SEN', phone_code: '+221',   currency: 'West African CFA Franc',           currency_code: 'XOF', capital: 'Dakar',                     continent: 'Africa',        nationality: 'Senegalese',        timezone: 'Africa/Dakar' },
  { name: 'Serbia',                             iso2: 'RS', iso3: 'SRB', phone_code: '+381',   currency: 'Serbian Dinar',                    currency_code: 'RSD', capital: 'Belgrade',                  continent: 'Europe',        nationality: 'Serbian',           timezone: 'Europe/Belgrade' },
  { name: 'Seychelles',                         iso2: 'SC', iso3: 'SYC', phone_code: '+248',   currency: 'Seychellois Rupee',                currency_code: 'SCR', capital: 'Victoria',                  continent: 'Africa',        nationality: 'Seychellois',       timezone: 'Indian/Mahe' },
  { name: 'Sierra Leone',                       iso2: 'SL', iso3: 'SLE', phone_code: '+232',   currency: 'Sierra Leonean Leone',             currency_code: 'SLL', capital: 'Freetown',                  continent: 'Africa',        nationality: 'Sierra Leonean',    timezone: 'Africa/Freetown' },
  { name: 'Singapore',                          iso2: 'SG', iso3: 'SGP', phone_code: '+65',    currency: 'Singapore Dollar',                 currency_code: 'SGD', capital: 'Singapore',                 continent: 'Asia',          nationality: 'Singaporean',       timezone: 'Asia/Singapore' },
  { name: 'Slovakia',                           iso2: 'SK', iso3: 'SVK', phone_code: '+421',   currency: 'Euro',                             currency_code: 'EUR', capital: 'Bratislava',                continent: 'Europe',        nationality: 'Slovak',            timezone: 'Europe/Bratislava' },
  { name: 'Slovenia',                           iso2: 'SI', iso3: 'SVN', phone_code: '+386',   currency: 'Euro',                             currency_code: 'EUR', capital: 'Ljubljana',                 continent: 'Europe',        nationality: 'Slovenian',         timezone: 'Europe/Ljubljana' },
  { name: 'Solomon Islands',                    iso2: 'SB', iso3: 'SLB', phone_code: '+677',   currency: 'Solomon Islands Dollar',           currency_code: 'SBD', capital: 'Honiara',                   continent: 'Oceania',       nationality: 'Solomon Islander',  timezone: 'Pacific/Guadalcanal' },
  { name: 'Somalia',                            iso2: 'SO', iso3: 'SOM', phone_code: '+252',   currency: 'Somali Shilling',                  currency_code: 'SOS', capital: 'Mogadishu',                 continent: 'Africa',        nationality: 'Somali',            timezone: 'Africa/Mogadishu' },
  { name: 'South Africa',                       iso2: 'ZA', iso3: 'ZAF', phone_code: '+27',    currency: 'South African Rand',               currency_code: 'ZAR', capital: 'Pretoria',                  continent: 'Africa',        nationality: 'South African',     timezone: 'Africa/Johannesburg' },
  { name: 'South Korea',                        iso2: 'KR', iso3: 'KOR', phone_code: '+82',    currency: 'South Korean Won',                 currency_code: 'KRW', capital: 'Seoul',                     continent: 'Asia',          nationality: 'South Korean',      timezone: 'Asia/Seoul' },
  { name: 'South Sudan',                        iso2: 'SS', iso3: 'SSD', phone_code: '+211',   currency: 'South Sudanese Pound',             currency_code: 'SSP', capital: 'Juba',                      continent: 'Africa',        nationality: 'South Sudanese',    timezone: 'Africa/Juba' },
  { name: 'Spain',                              iso2: 'ES', iso3: 'ESP', phone_code: '+34',    currency: 'Euro',                             currency_code: 'EUR', capital: 'Madrid',                    continent: 'Europe',        nationality: 'Spanish',           timezone: 'Europe/Madrid' },
  { name: 'Sri Lanka',                          iso2: 'LK', iso3: 'LKA', phone_code: '+94',    currency: 'Sri Lankan Rupee',                 currency_code: 'LKR', capital: 'Sri Jayawardenepura Kotte', continent: 'Asia',          nationality: 'Sri Lankan',        timezone: 'Asia/Colombo' },
  { name: 'Sudan',                              iso2: 'SD', iso3: 'SDN', phone_code: '+249',   currency: 'Sudanese Pound',                   currency_code: 'SDG', capital: 'Khartoum',                  continent: 'Africa',        nationality: 'Sudanese',          timezone: 'Africa/Khartoum' },
  { name: 'Suriname',                           iso2: 'SR', iso3: 'SUR', phone_code: '+597',   currency: 'Surinamese Dollar',                currency_code: 'SRD', capital: 'Paramaribo',                continent: 'South America', nationality: 'Surinamese',        timezone: 'America/Paramaribo' },
  { name: 'Sweden',                             iso2: 'SE', iso3: 'SWE', phone_code: '+46',    currency: 'Swedish Krona',                    currency_code: 'SEK', capital: 'Stockholm',                 continent: 'Europe',        nationality: 'Swedish',           timezone: 'Europe/Stockholm' },
  { name: 'Switzerland',                        iso2: 'CH', iso3: 'CHE', phone_code: '+41',    currency: 'Swiss Franc',                      currency_code: 'CHF', capital: 'Bern',                      continent: 'Europe',        nationality: 'Swiss',             timezone: 'Europe/Zurich' },
  { name: 'Syria',                              iso2: 'SY', iso3: 'SYR', phone_code: '+963',   currency: 'Syrian Pound',                     currency_code: 'SYP', capital: 'Damascus',                  continent: 'Asia',          nationality: 'Syrian',            timezone: 'Asia/Damascus' },
  { name: 'Taiwan',                             iso2: 'TW', iso3: 'TWN', phone_code: '+886',   currency: 'New Taiwan Dollar',                currency_code: 'TWD', capital: 'Taipei',                    continent: 'Asia',          nationality: 'Taiwanese',         timezone: 'Asia/Taipei' },
  { name: 'Tajikistan',                         iso2: 'TJ', iso3: 'TJK', phone_code: '+992',   currency: 'Tajikistani Somoni',               currency_code: 'TJS', capital: 'Dushanbe',                  continent: 'Asia',          nationality: 'Tajik',             timezone: 'Asia/Dushanbe' },
  { name: 'Tanzania',                           iso2: 'TZ', iso3: 'TZA', phone_code: '+255',   currency: 'Tanzanian Shilling',               currency_code: 'TZS', capital: 'Dodoma',                    continent: 'Africa',        nationality: 'Tanzanian',         timezone: 'Africa/Dar_es_Salaam' },
  { name: 'Thailand',                           iso2: 'TH', iso3: 'THA', phone_code: '+66',    currency: 'Thai Baht',                        currency_code: 'THB', capital: 'Bangkok',                   continent: 'Asia',          nationality: 'Thai',              timezone: 'Asia/Bangkok' },
  { name: 'Timor-Leste',                        iso2: 'TL', iso3: 'TLS', phone_code: '+670',   currency: 'United States Dollar',             currency_code: 'USD', capital: 'Dili',                      continent: 'Asia',          nationality: 'Timorese',          timezone: 'Asia/Dili' },
  { name: 'Togo',                               iso2: 'TG', iso3: 'TGO', phone_code: '+228',   currency: 'West African CFA Franc',           currency_code: 'XOF', capital: 'Lome',                      continent: 'Africa',        nationality: 'Togolese',          timezone: 'Africa/Lome' },
  { name: 'Tonga',                              iso2: 'TO', iso3: 'TON', phone_code: '+676',   currency: "Tongan Pa'anga",                   currency_code: 'TOP', capital: "Nuku'alofa",                continent: 'Oceania',       nationality: 'Tongan',            timezone: 'Pacific/Tongatapu' },
  { name: 'Trinidad and Tobago',                iso2: 'TT', iso3: 'TTO', phone_code: '+1-868', currency: 'Trinidad and Tobago Dollar',       currency_code: 'TTD', capital: 'Port of Spain',             continent: 'North America', nationality: 'Trinidadian',       timezone: 'America/Port_of_Spain' },
  { name: 'Tunisia',                            iso2: 'TN', iso3: 'TUN', phone_code: '+216',   currency: 'Tunisian Dinar',                   currency_code: 'TND', capital: 'Tunis',                     continent: 'Africa',        nationality: 'Tunisian',          timezone: 'Africa/Tunis' },
  { name: 'Turkey',                             iso2: 'TR', iso3: 'TUR', phone_code: '+90',    currency: 'Turkish Lira',                     currency_code: 'TRY', capital: 'Ankara',                    continent: 'Asia',          nationality: 'Turkish',           timezone: 'Europe/Istanbul' },
  { name: 'Turkmenistan',                       iso2: 'TM', iso3: 'TKM', phone_code: '+993',   currency: 'Turkmenistani Manat',              currency_code: 'TMT', capital: 'Ashgabat',                  continent: 'Asia',          nationality: 'Turkmen',           timezone: 'Asia/Ashgabat' },
  { name: 'Tuvalu',                             iso2: 'TV', iso3: 'TUV', phone_code: '+688',   currency: 'Australian Dollar',                currency_code: 'AUD', capital: 'Funafuti',                  continent: 'Oceania',       nationality: 'Tuvaluan',          timezone: 'Pacific/Funafuti' },
  { name: 'Uganda',                             iso2: 'UG', iso3: 'UGA', phone_code: '+256',   currency: 'Ugandan Shilling',                 currency_code: 'UGX', capital: 'Kampala',                   continent: 'Africa',        nationality: 'Ugandan',           timezone: 'Africa/Kampala' },
  { name: 'Ukraine',                            iso2: 'UA', iso3: 'UKR', phone_code: '+380',   currency: 'Ukrainian Hryvnia',                currency_code: 'UAH', capital: 'Kyiv',                      continent: 'Europe',        nationality: 'Ukrainian',         timezone: 'Europe/Kiev' },
  { name: 'United Arab Emirates',               iso2: 'AE', iso3: 'ARE', phone_code: '+971',   currency: 'UAE Dirham',                       currency_code: 'AED', capital: 'Abu Dhabi',                 continent: 'Asia',          nationality: 'Emirati',           timezone: 'Asia/Dubai' },
  { name: 'United Kingdom',                     iso2: 'GB', iso3: 'GBR', phone_code: '+44',    currency: 'British Pound Sterling',           currency_code: 'GBP', capital: 'London',                    continent: 'Europe',        nationality: 'British',           timezone: 'Europe/London' },
  { name: 'United States',                      iso2: 'US', iso3: 'USA', phone_code: '+1',     currency: 'United States Dollar',             currency_code: 'USD', capital: 'Washington D.C.',           continent: 'North America', nationality: 'American',          timezone: 'America/New_York' },
  { name: 'Uruguay',                            iso2: 'UY', iso3: 'URY', phone_code: '+598',   currency: 'Uruguayan Peso',                   currency_code: 'UYU', capital: 'Montevideo',                continent: 'South America', nationality: 'Uruguayan',         timezone: 'America/Montevideo' },
  { name: 'Uzbekistan',                         iso2: 'UZ', iso3: 'UZB', phone_code: '+998',   currency: 'Uzbekistani Som',                  currency_code: 'UZS', capital: 'Tashkent',                  continent: 'Asia',          nationality: 'Uzbek',             timezone: 'Asia/Tashkent' },
  { name: 'Vanuatu',                            iso2: 'VU', iso3: 'VUT', phone_code: '+678',   currency: 'Vanuatu Vatu',                     currency_code: 'VUV', capital: 'Port Vila',                 continent: 'Oceania',       nationality: 'Ni-Vanuatu',        timezone: 'Pacific/Efate' },
  { name: 'Venezuela',                          iso2: 'VE', iso3: 'VEN', phone_code: '+58',    currency: 'Venezuelan Bolivar',               currency_code: 'VES', capital: 'Caracas',                   continent: 'South America', nationality: 'Venezuelan',        timezone: 'America/Caracas' },
  { name: 'Vietnam',                            iso2: 'VN', iso3: 'VNM', phone_code: '+84',    currency: 'Vietnamese Dong',                  currency_code: 'VND', capital: 'Hanoi',                     continent: 'Asia',          nationality: 'Vietnamese',        timezone: 'Asia/Ho_Chi_Minh' },
  { name: 'Yemen',                              iso2: 'YE', iso3: 'YEM', phone_code: '+967',   currency: 'Yemeni Rial',                      currency_code: 'YER', capital: "Sana'a",                    continent: 'Asia',          nationality: 'Yemeni',            timezone: 'Asia/Aden' },
  { name: 'Zambia',                             iso2: 'ZM', iso3: 'ZMB', phone_code: '+260',   currency: 'Zambian Kwacha',                   currency_code: 'ZMW', capital: 'Lusaka',                    continent: 'Africa',        nationality: 'Zambian',           timezone: 'Africa/Lusaka' },
  { name: 'Zimbabwe',                           iso2: 'ZW', iso3: 'ZWE', phone_code: '+263',   currency: 'United States Dollar',             currency_code: 'USD', capital: 'Harare',                    continent: 'Africa',        nationality: 'Zimbabwean',        timezone: 'Africa/Harare' },
];

type UploadedFiles = {
  flag_image?: Express.Multer.File[];
  thumbnail?:  Express.Multer.File[];
  banner?:     Express.Multer.File[];
  images?:     Express.Multer.File[];
};

const SETUP_SQL = `
  CREATE TABLE IF NOT EXISTS countries (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id      UUID,
    language_id    UUID,
    seo_id         UUID,
    name           VARCHAR(255) NOT NULL,
    iso2           VARCHAR(2),
    iso3           VARCHAR(3),
    phone_code     VARCHAR(10),
    currency       VARCHAR(50),
    currency_code  VARCHAR(10),
    capital        VARCHAR(100),
    continent      VARCHAR(100),
    nationality    VARCHAR(100),
    timezone       VARCHAR(100),
    flag_image     VARCHAR(500),
    thumbnail      VARCHAR(500),
    banner         VARCHAR(500),
    images         TEXT,
    description    TEXT,
    publish_status BOOLEAN      NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at     TIMESTAMPTZ
  );
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS module_id      UUID;
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS language_id    UUID;
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS seo_id         UUID;
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS iso2           VARCHAR(2);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS iso3           VARCHAR(3);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS phone_code     VARCHAR(10);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS currency       VARCHAR(50);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS currency_code  VARCHAR(10);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS capital        VARCHAR(100);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS continent      VARCHAR(100);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS nationality    VARCHAR(100);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS timezone       VARCHAR(100);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS flag_image     VARCHAR(500);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS thumbnail      VARCHAR(500);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS banner         VARCHAR(500);
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS images         TEXT;
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS description    TEXT;
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS publish_status BOOLEAN NOT NULL DEFAULT true;
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();
  ALTER TABLE countries ADD COLUMN IF NOT EXISTS deleted_at     TIMESTAMPTZ;
  CREATE INDEX IF NOT EXISTS idx_countries_module_id   ON countries(module_id);
  CREATE INDEX IF NOT EXISTS idx_countries_language_id ON countries(language_id);
  CREATE INDEX IF NOT EXISTS idx_countries_continent   ON countries(continent);
  CREATE INDEX IF NOT EXISTS idx_countries_iso2        ON countries(iso2);
  CREATE INDEX IF NOT EXISTS idx_countries_publish     ON countries(publish_status);
  CREATE INDEX IF NOT EXISTS idx_countries_deleted_at  ON countries(deleted_at);
  SELECT pg_notify('pgrst', 'reload schema');
`;

const COUNTRY_LIST_FIELDS   = 'id, module_id, language_id, name, iso2, iso3, phone_code, currency_code, capital, continent, flag_image, thumbnail, publish_status, created_at';
const COUNTRY_DETAIL_FIELDS = 'id, module_id, language_id, seo_id, name, iso2, iso3, phone_code, currency, currency_code, capital, continent, nationality, timezone, flag_image, thumbnail, banner, images, description, publish_status, created_at, updated_at';

@Injectable()
export class CountriesService {
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

    return { success: true, message: 'Countries table migrated successfully.' };
  }

  // ─── Dropdown ────────────────────────────────────────────────────────────────

  async dropdown(): Promise<{ success: boolean; data: object[] }> {
    const { data, error } = await this.supabase.db
      .from('countries')
      .select('id, name, iso2, flag_image')
      .eq('publish_status', true)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return { success: true, data: data ?? [] };
  }

  // ─── Seed ────────────────────────────────────────────────────────────────────

  async seed(): Promise<{ success: boolean; message: string; data: { inserted: number; skipped: number } }> {
    const { data: existing } = await this.supabase.db
      .from('countries')
      .select('iso2')
      .is('deleted_at', null);

    const existingIso2s = new Set((existing ?? []).map((r: any) => r.iso2).filter(Boolean));
    const toInsert = SEED_COUNTRIES.filter(c => !existingIso2s.has(c.iso2));

    if (toInsert.length) {
      const { error } = await this.supabase.db
        .from('countries')
        .insert(toInsert.map(c => ({ ...c, publish_status: true })));
      if (error) throw new Error(`Seed failed: ${error.message}`);
    }

    return {
      success: true,
      message: toInsert.length
        ? `Seeded ${toInsert.length} countries successfully.`
        : 'All countries already exist. Nothing inserted.',
      data: { inserted: toInsert.length, skipped: existingIso2s.size },
    };
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(
    dto: CreateCountryDto,
    files: UploadedFiles,
  ): Promise<{ success: boolean; message: string; data: object }> {
    if (dto.module_id)   await this.validateRef('modules',   dto.module_id,   'module_name');
    if (dto.language_id) await this.validateRef('languages', dto.language_id, 'name');

    const [flagUrl, thumbnailUrl, bannerUrl, imageUrls] = await Promise.all([
      files?.flag_image?.[0] ? this.uploadFile(files.flag_image[0], 'country-flags')      : Promise.resolve(null),
      files?.thumbnail?.[0]  ? this.uploadFile(files.thumbnail[0],  'country-thumbnails')  : Promise.resolve(null),
      files?.banner?.[0]     ? this.uploadFile(files.banner[0],     'country-banners')     : Promise.resolve(null),
      files?.images?.length  ? this.uploadMultiple(files.images,    'country-images')      : Promise.resolve([]),
    ]);

    const { data, error } = await this.supabase.db
      .from('countries')
      .insert({
        module_id:      dto.module_id      ?? null,
        language_id:    dto.language_id    ?? null,
        seo_id:         dto.seo_id         ?? null,
        name:           dto.name,
        iso2:           dto.iso2           ?? null,
        iso3:           dto.iso3           ?? null,
        phone_code:     dto.phone_code     ?? null,
        currency:       dto.currency       ?? null,
        currency_code:  dto.currency_code  ?? null,
        capital:        dto.capital        ?? null,
        continent:      dto.continent      ?? null,
        nationality:    dto.nationality    ?? null,
        timezone:       dto.timezone       ?? null,
        flag_image:     flagUrl,
        thumbnail:      thumbnailUrl,
        banner:         bannerUrl,
        images:         imageUrls.length ? JSON.stringify(imageUrls) : null,
        description:    dto.description    ?? null,
        publish_status: dto.publish_status ?? true,
      })
      .select(COUNTRY_DETAIL_FIELDS)
      .single();

    if (error) throw new Error(error.message);

    const [enriched] = await this.enrichWithRelations([data]);
    return { success: true, message: 'Country created successfully.', data: enriched };
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  async findAll(query: ListCountriesDto) {
    const {
      page = 1, limit = 10, search,
      module_id, language_id, continent, publish_status,
      sortBy = 'created_at', sortOrder = 'DESC',
    } = query;

    const from = (page - 1) * limit;

    let dbQuery = this.supabase.db
      .from('countries')
      .select(COUNTRY_LIST_FIELDS, { count: 'exact' })
      .is('deleted_at', null);

    if (search) {
      dbQuery = dbQuery.or(
        `name.ilike.%${search}%,iso2.ilike.%${search}%,iso3.ilike.%${search}%,capital.ilike.%${search}%,nationality.ilike.%${search}%`,
      );
    }
    if (module_id)                   dbQuery = dbQuery.eq('module_id',      module_id);
    if (language_id)                 dbQuery = dbQuery.eq('language_id',    language_id);
    if (continent)                   dbQuery = dbQuery.ilike('continent',   `%${continent}%`);
    if (publish_status !== undefined) dbQuery = dbQuery.eq('publish_status', publish_status);

    const { data, error, count } = await dbQuery
      .order(sortBy, { ascending: sortOrder === 'ASC' })
      .range(from, from + limit - 1);

    if (error) throw new Error(error.message);

    const enriched = await this.enrichWithRelations(data ?? []);
    return { success: true, data: enriched, pagination: { page, limit, total: count ?? 0 } };
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const { data, error } = await this.supabase.db
      .from('countries')
      .select(COUNTRY_DETAIL_FIELDS)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) throw new NotFoundException('Country not found.');

    const [enriched] = await this.enrichWithRelations([data]);
    return { success: true, data: enriched };
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateCountryDto,
    files: UploadedFiles,
  ): Promise<{ success: boolean; message: string; data: object }> {
    const { data: existing } = await this.supabase.db
      .from('countries')
      .select('id, images')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Country not found.');

    if (dto.module_id)   await this.validateRef('modules',   dto.module_id,   'module_name');
    if (dto.language_id) await this.validateRef('languages', dto.language_id, 'name');

    const updates: Record<string, any> = { ...dto, updated_at: new Date().toISOString() };

    const [flagUrl, thumbnailUrl, bannerUrl] = await Promise.all([
      files?.flag_image?.[0] ? this.uploadFile(files.flag_image[0], 'country-flags')     : Promise.resolve(null),
      files?.thumbnail?.[0]  ? this.uploadFile(files.thumbnail[0],  'country-thumbnails') : Promise.resolve(null),
      files?.banner?.[0]     ? this.uploadFile(files.banner[0],     'country-banners')    : Promise.resolve(null),
    ]);

    if (flagUrl)      updates.flag_image = flagUrl;
    if (thumbnailUrl) updates.thumbnail  = thumbnailUrl;
    if (bannerUrl)    updates.banner     = bannerUrl;

    if (files?.images?.length) {
      const newUrls  = await this.uploadMultiple(files.images, 'country-images');
      const current  = this.parseImages(existing.images);
      updates.images = JSON.stringify([...current, ...newUrls]);
    }

    const { data: updated, error } = await this.supabase.db
      .from('countries')
      .update(updates)
      .eq('id', id)
      .select(COUNTRY_DETAIL_FIELDS)
      .single();

    if (error) throw new Error(error.message);

    const [enriched] = await this.enrichWithRelations([updated]);
    return { success: true, message: 'Country updated successfully.', data: enriched };
  }

  // ─── Delete (Soft) ───────────────────────────────────────────────────────────

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const { data: existing } = await this.supabase.db
      .from('countries')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Country not found.');

    const { error } = await this.supabase.db
      .from('countries')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true, message: 'Country deleted successfully.' };
  }

  // ─── Gallery: Add Images ──────────────────────────────────────────────────────

  async addGalleryImages(
    id: string,
    files: Express.Multer.File[],
  ): Promise<{ success: boolean; message: string; data: { images: string[] } }> {
    const { data: existing } = await this.supabase.db
      .from('countries')
      .select('id, images')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Country not found.');
    if (!files?.length) throw new UnprocessableEntityException('No images provided.');

    const newUrls  = await this.uploadMultiple(files, 'country-images');
    const current  = this.parseImages(existing.images);
    const merged   = [...current, ...newUrls];

    const { error } = await this.supabase.db
      .from('countries')
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
      .from('countries')
      .select('id, images')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new NotFoundException('Country not found.');

    const images = this.parseImages(existing.images).filter(url => url !== imageUrl);

    const { error } = await this.supabase.db
      .from('countries')
      .update({ images: images.length ? JSON.stringify(images) : null, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true, message: 'Gallery image removed successfully.', data: { images } };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private parseImages(raw: string | null): string[] {
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  private async validateRef(table: string, id: string, _labelField: string) {
    const { data } = await (this.supabase.db as any)
      .from(table)
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (!data) throw new NotFoundException(`${table.slice(0, -1)} not found.`);
  }

  private async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new UnprocessableEntityException(
        `Invalid file type "${file.mimetype}". Allowed: jpg, jpeg, png, webp.`,
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

  private async uploadMultiple(files: Express.Multer.File[], folder: string): Promise<string[]> {
    return Promise.all(files.map(f => this.uploadFile(f, folder)));
  }

  private async enrichWithRelations(records: any[]) {
    if (!records.length) return records;

    const pick = (arr: any[], key: string) => [...new Set(arr.filter(r => r[key]).map(r => r[key]))];

    const moduleIds   = pick(records, 'module_id');
    const languageIds = pick(records, 'language_id');

    const [modulesRes, languagesRes] = await Promise.all([
      moduleIds.length   ? this.supabase.db.from('modules').select('id, module_name').in('id', moduleIds)    : { data: [] },
      languageIds.length ? this.supabase.db.from('languages').select('id, name, code').in('id', languageIds) : { data: [] },
    ]);

    const moduleMap   = Object.fromEntries((modulesRes.data   ?? []).map((m: any) => [m.id, { id: m.id, name: m.module_name }]));
    const languageMap = Object.fromEntries((languagesRes.data ?? []).map((l: any) => [l.id, { id: l.id, name: l.name, code: l.code }]));

    return records.map(r => ({
      ...r,
      images:   this.parseImages(r.images),
      module:   r.module_id   ? (moduleMap[r.module_id]     ?? null) : null,
      language: r.language_id ? (languageMap[r.language_id] ?? null) : null,
    }));
  }
}
