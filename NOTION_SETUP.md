# Notion 연동 설정 가이드

## 1. Notion Integration 생성

1. **Notion Integrations 페이지 접속**: https://www.notion.so/my-integrations
2. **"+ New integration" 클릭**
3. 정보 입력:
   - **Name**: 원하는 이름 (예: Blog CMS)
   - **Associated workspace**: 사용할 워크스페이스 선택
   - **Type**: Internal
4. **Submit** 클릭
5. **Internal Integration Token** 복사 (형식: `secret_...`)
   - ⚠️ 이 토큰이 **Notion API Key**입니다

## 2. Notion 데이터베이스 생성

1. Notion에서 새 페이지 생성
2. `/database` 입력하여 데이터베이스 생성
3. 데이터베이스 이름 설정 (예: "AI 블로그", "테크 블로그" 등)
4. **최소 필수 속성**:
   - **Name** (또는 **title**): 기본으로 있음 - 글 제목이 들어감

## 3. Integration을 데이터베이스에 연결

⚠️ **중요**: 이 단계를 빠뜨리면 "Could not find database" 오류가 발생합니다!

1. 데이터베이스 페이지 우측 상단 **...** (더보기) 클릭
2. **"Add connections"** 클릭
3. 1단계에서 만든 **Integration 선택**
4. **"Confirm"** 클릭

## 4. Database ID 확인

### 방법 1: URL에서 확인 (가장 쉬움)

데이터베이스를 전체 페이지로 열었을 때 URL:
```
https://www.notion.so/{workspace_name}/{database_id}?v=...
```

예시:
```
https://www.notion.so/myworkspace/2e2753ebc0138157bfded9fc33d6ea2d?v=abc123
                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                  이 부분이 Database ID입니다
```

### 방법 2: 공유 링크에서 확인

1. 데이터베이스 우측 상단 **Share** 클릭
2. **Copy link** 클릭
3. 링크 형식:
   ```
   https://www.notion.so/{database_id}?v=...
   ```

### Database ID 형식

- **32자리 16진수 문자열** (하이픈 없음)
- 예: `2e2753ebc0138157bfded9fc33d6ea2d`
- ⚠️ `?v=` 뒤의 부분은 **제외**해야 합니다

## 5. .env 파일에 입력

```bash
# AI 블로그
VITE_AI_NOTION_API_KEY=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_AI_NOTION_DATABASE_ID=2e2753ebc0138157bfded9fc33d6ea2d

# 테크/IT 리뷰
VITE_TECH_NOTION_API_KEY=secret_yyyyyyyyyyyyyyyyyyyyyyyyyyyyy
VITE_TECH_NOTION_DATABASE_ID=3f3864fdd1248268cgeea0ed44e7fb3e
```

## 6. 서버 재시작

환경 변수 변경 후 개발 서버를 재시작해야 합니다:

```bash
# 터미널에서 Ctrl+C로 서버 중단 후
npm run dev
```

## 문제 해결

### "Could not find database" 오류

✅ **해결 방법**:
1. Integration이 데이터베이스에 연결되었는지 확인 (3단계)
2. Database ID가 올바른지 확인 (32자리, `?v=` 제외)
3. API Key가 올바른지 확인 (secret_로 시작)

### "Unauthorized" 오류

✅ **해결 방법**:
1. Notion API Key가 올바른지 확인
2. Integration이 활성화되었는지 확인
3. 토큰을 다시 복사해서 입력

### "Invalid request" 오류

✅ **해결 방법**:
1. Database ID 형식 확인 (32자리 16진수)
2. 하이픈(-) 제거
3. ?v= 뒤의 부분 제거

## 테스트

모든 설정이 완료되면:

1. 앱에서 AI 초안 생성
2. "Notion 페이지 생성" 버튼 클릭
3. Notion 데이터베이스에서 새 페이지 확인

성공하면 앱에서 페이지 URL을 받을 수 있습니다! 🎉
