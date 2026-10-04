# AI와 함께 공부하기 — 대학생 설문

대학생의 생성형 AI 활용 경험과 학습 인식을 알아보는 익명 설문 웹페이지입니다. 응답은 Firebase Cloud Firestore의 `responses` 컬렉션에 저장하고, Firestore 실시간 구독으로 전체 응답자에게 결과를 갱신합니다.

## 기능

- 학교(자유 입력), 학년, 전공 계열(기타 직접 입력) 응답자 정보
- 5점 리커트 척도 12문항
- 응답 제출 후 전체 평균 및 학교별·학년별·전공 계열별 평균 비교
- 학년·학교·전공 계열별 응답자 구성 도넛 그래프(인원 및 비율)
- 제출한 내 응답과 전체 평균 비교(활용 경험 및 학습 도움·효율)
- 문항 선정 이유와 추가 기능 이유를 설명하는 “이 설문에 대하여” 섹션
- 이름과 학번은 수집하지 않음

## 1. Firebase 웹 앱 설정

Firebase Console에서 `hranalytics-temporary` 프로젝트를 열고 웹 앱을 등록합니다. **프로젝트 설정 → 일반 → 내 앱 → SDK 설정 및 구성 → 구성**의 공개 웹 설정을 `firebase-config.js`에 입력합니다. 현재 받은 웹 앱 설정은 이미 이 파일에 반영되어 있습니다.

```js
window.PEOPLELENS_FIREBASE_CONFIG = {
  apiKey: '실제 웹 API 키',
  authDomain: 'hranalytics-temporary.firebaseapp.com',
  projectId: 'hranalytics-temporary',
  storageBucket: 'hranalytics-temporary.firebasestorage.app',
  messagingSenderId: '실제 발신자 ID',
  appId: '실제 앱 ID'
};
```

웹 앱 설정에는 비밀 서비스 계정 키를 넣지 않습니다. `firebase-config.js`는 Hosting에 공개되므로 서비스 계정 JSON을 절대 업로드하면 안 됩니다.

## 2. Firestore 설정 및 배포

먼저 Firebase Console에서 Firestore Database를 만들고, Node.js LTS를 설치합니다. 새 터미널에서 프로젝트 폴더로 이동해 Firebase CLI를 실행합니다. 이 저장소에는 이미 `.firebaserc`, `firebase.json`, `firestore.rules`가 준비되어 있으므로 `firebase init`을 다시 실행할 필요가 없습니다. 초기화를 반복하면 Hosting 설정이나 기존 보안 규칙을 덮어쓸 수 있습니다.

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,hosting
```

배포 후 출력되는 `https://<프로젝트 ID>.web.app` 주소를 공유하면 누구나 설문에 응답할 수 있습니다. Firebase Hosting 기본 도메인은 Firebase Console의 Hosting 메뉴에서도 확인할 수 있습니다.

## 로컬 확인

실제 데이터베이스를 변경하지 않는 집계·제출 흐름 검사는 `node scripts/check-survey.cjs`로 실행합니다. 이 검사는 실제 Firebase 서버 접근과 브라우저 화면 검사를 대체하지 않습니다.

정적 파일 서버에서 실행해야 ES 모듈과 Firebase CDN 모듈이 정상 동작합니다.

```bash
npx serve .
```

Firebase 설정 전에는 응답 저장과 결과 조회가 비활성화되며, 설정 누락 안내가 표시됩니다.

## 응답 데이터

`responses` 문서에는 다음 항목이 저장됩니다.

- `school`: 학교 자유 입력값
- `year`: `1학년`, `2학년`, `3학년`, `4학년 이상`
- `major`: 전공 계열 선택값 또는 기타 직접 입력값
- `answers`: Q1 ~ Q12의 1 ~ 5 정수 배열
- `createdAt`: 서버 생성 시각

현재 공개 설문이므로 누구나 익명 응답을 추가할 수 있고, 결과를 실시간 계산하기 위해 모든 응답 문서를 읽을 수 있습니다. 응답 문서 수정 및 삭제는 허용하지 않습니다. 공개 URL을 배포하기 전 Firebase Console의 Firestore 사용량과 응답 데이터를 확인하세요.
