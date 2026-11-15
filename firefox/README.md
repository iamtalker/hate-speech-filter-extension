# 혐오표현 필터 — Firefox (안드로이드 포함)

[크롬판](../chrome)을 파이어폭스용으로 포팅한 폴더입니다. 같은 저장소의 `chrome/`과 나란히 관리합니다.
동작 원리와 기능은 [루트 README](../README.md)를 참고하세요. 크롬판에서 단어·로직을 고치면 여기에도 직접 옮겨야 합니다.

## 현재 상태

- 데스크톱 Firefox와 안드로이드 Firefox에서 동작 확인 (v1.13.2)
- AMO(addons.mozilla.org)에 **자체 배포(비공개)** 로 제출·서명 완료. 스토어에는 노출되지 않음
- 크롬판 대비 변경: `manifest.json`(`background.scripts`, gecko 설정), `background.js`, 터치 기기용 CSS와 viewport 메타

## 로드맵

- [ ] **AMO 정식(공개) 등록** — 스토어 설명문·스크린샷·개인정보처리방침 URL 준비 후 공개 등록으로 제출, 스토어 노출과 자동 업데이트 확보
- [ ] 안드로이드 화면에서 팝업·설정 페이지 UI 다듬기
- [ ] 안드로이드에서 차단 페이지의 "현재 페이지 추가" 동작 점검
- [ ] 크롬판 변경 사항을 이쪽에 옮기는 방식 정리 (코드가 두 벌이라 수동 동기화 중)
- [ ] 최소 버전 상향 검토 (`data_collection_permissions`는 Firefox 140 / Android 142부터 지원, 현재 121로 두어 AMO 경고 2건)

## 설치

### 로컬 테스트
- 데스크톱: `about:debugging` → 이 Firefox → 임시 부가 기능 로드 → `manifest.json` 선택 (Firefox를 끄면 사라짐)
- 안드로이드: Firefox Nightly + USB 디버깅 + `web-ext run --target=firefox-android`

### 서명된 xpi 설치 (자체 배포)
1. AMO 개발자 허브 → 이 확장 → 상태 및 버전 관리 → 버전의 `.xpi` 파일 받기
2. 폰의 Firefox 설정 → Firefox 정보 → 로고 5번 누르기(디버그 메뉴) → "파일에서 확장 기능 설치"
3. 폰 Firefox에서 xpi를 링크로 바로 여는 방식은 "설치할 앱이 없다"며 막히므로 위 방법을 쓸 것

## 패키징

`powershell -File package.ps1` → `dist/`에 AMO 제출용 zip 생성. 새 버전을 올릴 때는 `manifest.json`의 `version`을 먼저 올려야 함(AMO는 같은 버전 번호를 다시 받지 않음).

## 변경 이력

### v1.13.2
- 크롬판 v1.13.2 기준 최초 Firefox 포팅
- 터치 기기용 CSS(`pointer: coarse`)와 viewport 메타 추가
- AMO 자체 배포로 제출·서명
