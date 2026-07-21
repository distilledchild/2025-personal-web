# 프로덕션 배포 가이드 - Google Cloud Storage 설정

## 개요
백엔드와 프론트엔드를 프로덕션 환경에 배포할 때 Google Cloud Storage를 위한 설정입니다.

---

## 1. 백엔드 서버 설정 (Node.js)

### A. 필수 환경 변수

프로덕션 서버의 환경 변수에 다음을 추가:

```bash
# Google Cloud Storage 설정
GCS_BUCKET_URL=https://storage.googleapis.com/distilledchild-art-images
GCS_BUCKET_NAME=distilledchild-art-images

# Google Cloud Project ID (선택사항)
GCP_PROJECT_ID=your-project-id
```

### B. Google Cloud 인증 설정

#### **방법 1: Service Account 사용 (권장)**

1. **Service Account 생성**:
```bash
# GCP Console에서
# IAM & Admin > Service Accounts > Create Service Account
# 이름: art-images-reader
```

2. **권한 부여**:
   - Role: **Storage Object Viewer**
   - Bucket: `distilledchild-art-images`

3. **키 생성 및 다운로드**:
   - Actions > Manage Keys > Add Key > Create New Key
   - Type: JSON
   - 파일 다운로드: `service-account-key.json`

4. **서버에 키 배포**:
```bash
# 서버에 키 파일 업로드
scp service-account-key.json user@your-server:/etc/secrets/

# 환경 변수 설정
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/service-account-key.json
```

#### **방법 2: Compute Engine/Cloud Run에서 실행 시**

Google Cloud 플랫폼에서 실행하는 경우:

1. **Default Service Account 사용**:
```bash
# VM 또는 Cloud Run에 Storage Object Viewer 권한 부여
gcloud compute instances set-service-account INSTANCE_NAME \
    --service-account SERVICE_ACCOUNT_EMAIL \
    --scopes storage-ro
```

2. **환경 변수 필요 없음**: 자동으로 인증됨

---

## 2. 프론트엔드 설정 (React/Vite)

### 환경 변수 필요 없음 ✅

프론트엔드는 백엔드 API를 통해 이미지 URL을 받아오므로:
- **Google Cloud 인증 불필요**
- **추가 설정 불필요**
- 백엔드가 이미 공개 URL을 반환: `https://storage.googleapis.com/distilledchild-art-images/...`

---

## 3. 배포 플랫폼별 설정

### A. **Railway / Render / Heroku**

Dashboard에서 환경 변수 추가:
```
GCS_BUCKET_URL=https://storage.googleapis.com/distilledchild-art-images
GCS_BUCKET_NAME=distilledchild-art-images
```

Service Account JSON을 환경 변수로 설정:
```bash
# JSON 내용을 한 줄로 변환
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account","project_id":"..."}'
```

코드 수정 (server/index.js):
```javascript
// JSON 문자열에서 credentials 파싱
const storage = new Storage({
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
        ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
        : undefined
});
```

### B. **Google Cloud Run**

1. **Service Account 설정**:
```bash
gcloud run deploy your-service \
    --service-account art-images-reader@project-id.iam.gserviceaccount.com \
    --set-env-vars GCS_BUCKET_URL=https://storage.googleapis.com/distilledchild-art-images,GCS_BUCKET_NAME=distilledchild-art-images
```

2. **자동 인증**: Default credentials 사용

### C. **AWS EC2 / DigitalOcean Droplet**

1. **Service Account 키 파일 업로드**:
```bash
scp service-account-key.json user@server:/home/app/secrets/
```

2. **환경 변수 설정** (`/etc/environment` 또는 `.env`):
```bash
GOOGLE_APPLICATION_CREDENTIALS=/home/app/secrets/service-account-key.json
GCS_BUCKET_URL=https://storage.googleapis.com/distilledchild-art-images
GCS_BUCKET_NAME=distilledchild-art-images
```

3. **PM2 사용 시**:
```bash
# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'api',
    script: './server/index.js',
    env: {
      GOOGLE_APPLICATION_CREDENTIALS: '/home/app/secrets/service-account-key.json',
      GCS_BUCKET_URL: 'https://storage.googleapis.com/distilledchild-art-images',
      GCS_BUCKET_NAME: 'distilledchild-art-images'
    }
  }]
}
```

---

## 4. 보안 체크리스트

### ✅ Bucket 권한 확인
```bash
# Bucket이 공개 읽기인지 확인
gcloud storage buckets get-iam-policy gs://distilledchild-art-images

# allUsers에 objectViewer 권한이 있어야 함
```

### ✅ CORS 설정 확인
```bash
# CORS 설정 확인
gcloud storage buckets describe gs://distilledchild-art-images --format="default(cors_config)"

# 웹사이트에서 이미지 로드를 위한 CORS 필요
```

### ✅ Service Account 최소 권한
- **Storage Object Viewer** 권한만 부여 (읽기 전용)
- **Storage Admin** 권한은 부여하지 말 것

### ✅ 키 파일 보안
```bash
# 키 파일 권한 설정 (EC2/Droplet)
chmod 600 /path/to/service-account-key.json
chown app:app /path/to/service-account-key.json

# Git에 커밋하지 말것
echo "service-account-key.json" >> .gitignore
```

---

## 5. 테스트

### 백엔드 API 테스트
```bash
# 프로덕션 서버에서
curl https://your-api-domain.com/api/interests/art-museums | jq '.[0].artworks[0]'

# 결과: "https://storage.googleapis.com/distilledchild-art-images/..."
```

### 이미지 로드 테스트
```bash
# 브라우저에서 직접 접근
curl -I https://storage.googleapis.com/distilledchild-art-images/PhAM/PhMA1.JPG

# 200 OK 응답이 와야 함
```

### 웹사이트 테스트
1. 프로덕션 웹사이트 열기
2. Interests > Art 메뉴 이동
3. 미술관 핀 클릭
4. 이미지가 정상적으로 표시되는지 확인

---

## 6. 문제 해결

### "403 Forbidden" 에러
```bash
# Service Account 권한 확인
gcloud projects get-iam-policy YOUR_PROJECT_ID \
    --flatten="bindings[].members" \
    --filter="bindings.members:serviceAccount:YOUR_SERVICE_ACCOUNT"

# Bucket 권한 확인
gcloud storage buckets get-iam-policy gs://distilledchild-art-images
```

### "Could not load the default credentials" 에러
```bash
# 환경 변수 확인
echo $GOOGLE_APPLICATION_CREDENTIALS

# 파일 존재 확인
ls -la $GOOGLE_APPLICATION_CREDENTIALS

# 서버 재시작
pm2 restart api
```

### CORS 에러
```bash
# CORS 재설정
cat > cors.json << EOF
[{
  "origin": ["*"],
  "method": ["GET"],
  "maxAgeSeconds": 3600
}]
EOF

gcloud storage buckets update gs://distilledchild-art-images --cors-file=cors.json
```

---

## 7. 모니터링

### 사용량 확인
```bash
# Storage 사용량
gcloud storage du --summarize gs://distilledchild-art-images

# 네트워크 트래픽 (GCP Console)
# Cloud Storage > Metrics > Network Egress
```

### 비용 모니터링
- GCP Console > Billing > Reports
- Storage 및 Network Egress 비용 확인

---

## 요약

### 백엔드 필수 설정:
1. 환경 변수: `GCS_BUCKET_URL`, `GCS_BUCKET_NAME`
2. Google 인증: Service Account 또는 Default Credentials
3. 패키지: `@google-cloud/storage` (이미 설치됨)

### 프론트엔드:
- **설정 불필요** ✅

### 보안:
- Service Account는 읽기 전용 권한만
- 키 파일은 Git에 커밋하지 말 것
- 파일 권한 600으로 설정
