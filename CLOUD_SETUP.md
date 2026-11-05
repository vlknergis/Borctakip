# BorçTakip – Güvenli Bulut Yedekleme Hazırlığı

Bu belge, BorçTakip'in mevcut cihaz içi kayıt sistemini bozmadan Supabase Auth + PostgreSQL + Row Level Security (RLS) ile hesap ve bulut yedekleme altyapısına geçiş planını açıklar.

## Mevcut durum

- Borç, ödeme, gelir ve gider kayıtları şu anda cihazın localStorage alanında tutulur.
- Bu dosyadaki SQL kurulmadan ve uygulamaya proje bağlantısı eklenmeden bulut yedekleme çalışmaz.
- Mevcut cihaz içi kayıt sistemi korunacaktır.
- Supabase bağlantısı yokken uygulama buluta kayıt yapıyormuş gibi gösterilmemelidir.

## 1. Supabase projesi oluşturma

1. https://supabase.com adresinden hesap açıp yeni bir proje oluşturun.
2. Proje bölgesi olarak Türkiye'ye makul gecikme sunan Avrupa bölgesini seçin.
3. Güçlü bir veritabanı parolası belirleyin ve güvenli yerde saklayın.
4. Proje hazır olunca Dashboard > SQL Editor bölümünü açın.

## 2. SQL Editor'de çalıştırılacak şema

Aşağıdaki SQL, her kullanıcı için tek bir güncel yedek satırı oluşturur. RLS politikaları sayesinde oturum açmış kullanıcı yalnızca kendi satırını okuyabilir, ekleyebilir, güncelleyebilir veya silebilir.

```sql
create table if not exists public.user_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  schema_version integer not null default 2,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.user_backups enable row level security;

grant select, insert, update, delete
on public.user_backups to authenticated;

drop policy if exists "Users can read own backup" on public.user_backups;
create policy "Users can read own backup"
on public.user_backups for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own backup" on public.user_backups;
create policy "Users can insert own backup"
on public.user_backups for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own backup" on public.user_backups;
create policy "Users can update own backup"
on public.user_backups for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own backup" on public.user_backups;
create policy "Users can delete own backup"
on public.user_backups for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.bump_user_backup_revision()
returns trigger
language plpgsql
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_backup_revision_trigger on public.user_backups;
create trigger user_backup_revision_trigger
before update on public.user_backups
for each row execute function public.bump_user_backup_revision();
```

## 3. Kimlik doğrulama ayarları

1. Authentication > Providers bölümünden Email sağlayıcısını etkin bırakın.
2. Authentication > URL Configuration bölümüne uygulamanın gerçek HTTPS adresini ekleyin:
   - Site URL: uygulamanın Netlify adresi.
   - Redirect URLs: aynı alan adının giriş dönüş adresi.
3. E-posta doğrulama / OTP ayarlarını kontrol edin.

## 4. Uygulama bağlantısı için gereken iki değer

Supabase Dashboard > Project Settings > API bölümünden:
- Project URL
- Publishable key (eski arayüzlerde anon/public key)

Bu iki değer tarayıcı uygulamasında kullanılmak üzere tasarlanmış herkese açık istemci bilgileridir; yine de RLS mutlaka açık olmalıdır.

**Asla paylaşmayın ve index.html içine koymayın:**
- service_role key / secret key
- Veritabanı parolası
- SMTP parolası veya özel erişim anahtarları

Bu sırlar tarayıcıya konursa herkes tarafından alınabilir.

## 5. Senkronizasyon güvenliği

- İlk sürümde buluta yalnızca kullanıcı oturumu doğrulandıktan sonra erişilmelidir.
- Kayıt yüklemeden önce mevcut cihaz verisi için güvenlik yedeği alınmalıdır.
- İndirme sırasında mevcut cihaz verisi otomatik olarak üzerine yazılmamalı; tarih, kayıt sayısı ve kullanıcı onayı gösterilmelidir.
- Birden fazla cihaz aynı anda kullanılırsa eski yedek yeni veriyi ezebilir. Bu nedenle revision kontrolüyle çakışma tespiti yapılmadan otomatik arka plan eşitlemesi açılmamalıdır.
- Bulut yedekleme, uygulamanın cihaz içi yedekleme/geri yükleme özelliğinin yerine geçmemelidir.

## 6. Kurulum sonrası test listesi

- İki ayrı kullanıcı hesabı birbirinin yedeğini okuyamamalı.
- Oturum kapatılınca bulut verisi görüntülenememeli.
- Aynı kullanıcı giriş yaptığında kendi yedeğini görebilmeli.
- Hatalı veya eski şema sürümü reddedilmeli.
- Ağ kesilirse cihaz içi kayıt ve JSON yedekleme çalışmaya devam etmeli.
- Çakışan revision durumunda sessizce üzerine yazmak yerine kullanıcı uyarılmalı.

## Önemli

Bu dosya kurulum tarifidir; tek başına bulut bağlantısını etkinleştirmez. Supabase projesi oluşturulup SQL çalıştırıldıktan ve Project URL + Publishable key uygulamaya güvenli biçimde tanımlandıktan sonra istemci entegrasyonu yapılmalıdır.
