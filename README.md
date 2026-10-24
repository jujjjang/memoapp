# 생각의 방

방 안의 서랍, 상자, 코르크보드, 쓰레기통에 아이디어를 넣어 정리하는 메모 웹앱이에요.

## 파일

| 파일 | 하는 일 |
| --- | --- |
| `index.html` | 앱 전체 |
| `config.js` | Supabase 연결 정보 (공개돼도 되는 값만) |
| `schema.sql` | Supabase에서 한 번 실행할 SQL |
| `manifest.webmanifest`, `icon-*.png` | 홈 화면에 추가할 때 쓰는 이름과 아이콘 |

`config.js`를 비워두면 그 브라우저에만 저장하는 모드로 열려요. 폰과 PC에서 같은 메모를 보려면 아래처럼 Supabase를 연결하세요.

## 설정 순서

1. **GitHub Pages 켜기**
   레포 Settings → Pages → Source: *Deploy from a branch* → Branch: `main`, 폴더 `/ (root)` → Save.
   몇 분 뒤 `https://jujjjang.github.io/memoapp/` 에서 열려요.

2. **Supabase 프로젝트 만들기**
   [supabase.com](https://supabase.com) → New project. Region은 *Northeast Asia (Seoul)*.
   데이터베이스 비밀번호는 아무거나 정해서 따로 저장해 두세요. 앱에는 안 들어가요.

3. **SQL 한 번 실행**
   왼쪽 메뉴 SQL Editor → New query → `schema.sql` 내용을 통째로 붙여넣고 Run.
   메모 표, 서랍 칸 이름 표, 사진 저장소가 만들어지고 "본인만 읽고 쓰기" 규칙이 켜져요.

4. **config.js에 두 값 넣기**
   프로젝트 화면 위쪽 **Connect** 버튼(또는 Project Settings → API Keys)에서
   - Project URL (`https://xxxx.supabase.co`)
   - Publishable key (`sb_publishable_...`, 없으면 legacy `anon` key)

   를 복사해서 `config.js`에 넣고 커밋하세요.
   **Secret key / `service_role` key는 절대 넣으면 안 돼요.** 이 키는 보안 규칙을 무시해요.

5. **로그인 주소 등록**
   Authentication → URL Configuration → Site URL에 `https://jujjjang.github.io/memoapp/` 을 넣고, Redirect URLs에도 같은 주소를 추가하세요. 가입 확인 메일의 링크가 이 주소로 돌아와요.

6. **계정 만들기**
   앱을 열고 "처음이에요 · 계정 만들기" → 이메일과 비밀번호 → 메일함의 확인 링크 누르기 → 앱에서 로그인.

7. **(선택) 다른 사람 가입 막기**
   내 계정을 만든 뒤 Authentication → Sign In / Providers에서 새 가입 허용(Allow new users to sign up)을 끄세요.
   켜져 있어도 남의 메모는 볼 수 없지만, 모르는 사람이 내 저장 공간을 쓰는 걸 막을 수 있어요.

8. **홈 화면에 추가**
   아이폰 Safari에서 공유 버튼 → 홈 화면에 추가. 앱처럼 전체 화면으로 열려요.

## 보안

- 레포가 public이어도 메모와 사진은 레포에 없어요. Supabase에 저장되고, `schema.sql`이 켠 규칙(RLS) 때문에 로그인한 본인만 읽고 쓸 수 있어요.
- 사진은 비공개 저장소에 두고, 볼 때마다 몇 시간짜리 임시 링크로 불러와요.
- `config.js`의 URL과 publishable key는 원래 공개용이에요.

## 폰트 바꾸기

`index.html` 위쪽 `:root`의 `--font-title`(제목·라벨)과 `--font-ko`(본문) 값을 바꾸고, 바로 위 Google Fonts 링크의 `family=`도 같이 바꾸면 돼요. 지금은 Jua + 고운돋움, 코르크보드 사진 밑 한 줄은 개구예요.
