# Google Cloud Storage 설정 가이드

## 개요
art-images 폴더(2GB+)를 Google Cloud Storage bucket에 업로드하고 웹사이트에서 서비스하는 방법입니다.

> **CLI 안내 (2026-07-21 기록)**: Google Cloud CLI는 2027년 3월부터 `gsutil`을 기본 설치 패키지에서 제외합니다. 이 문서는 장기 지원되는 `gcloud storage` 명령을 사용하도록 작성되어 있습니다. Google은 `gcloud storage`로의 전환을 권장합니다.

## 1단계: Google Cloud SDK 설치 및 설정

```bash
# macOS에서 Google Cloud SDK 설치
brew install google-cloud-sdk

# Google 계정으로 로그인
gcloud auth login

# 프로젝트 목록 확인
gcloud projects list

# 사용할 프로젝트 설정
gcloud config set project YOUR_PROJECT_ID
```

## 2단계: Cloud Storage Bucket 생성

```bash
# Bucket 생성 (전역적으로 고유한 이름 필요)
# 예: distilledchild-art-images
gcloud storage buckets create gs://distilledchild-art-images --location=us-central1

# Bucket을 공개 읽기로 설정 (모든 사용자가 이미지를 볼 수 있도록)
gcloud storage buckets add-iam-policy-binding gs://distilledchild-art-images \
  --member=allUsers --role=roles/storage.objectViewer

# CORS 설정 (웹사이트에서 이미지를 로드할 수 있도록)
echo '[{"origin": ["*"], "method": ["GET"], "maxAgeSeconds": 3600}]' > cors.json
gcloud storage buckets update gs://distilledchild-art-images --cors-file=cors.json
rm cors.json
```

## 3단계: art-images 폴더 업로드

```bash
# 프로젝트 루트 디렉토리에서 실행
cd /Users/pete/Desktop/playground/personal-web-2025

# 모든 art-images를 bucket에 업로드 (-m은 멀티스레드 업로드)
gcloud storage cp --recursive public/art-images/* gs://distilledchild-art-images/

# 업로드 확인
gcloud storage ls --recursive gs://distilledchild-art-images/

# 특정 미술관 폴더 확인 (예: PhAM)
gcloud storage ls gs://distilledchild-art-images/PhAM/
```

## 4단계: .env 파일에 Bucket URL 추가

.env 파일에 다음 줄을 추가하세요:

```bash
# Google Cloud Storage Bucket URL (공개 접근용)
GCS_BUCKET_URL=https://storage.googleapis.com/distilledchild-art-images
```

**중요**: bucket 이름을 실제로 생성한 이름으로 바꾸세요!

## 5단계: 서버 재시작

```bash
# 기존 서버 중지
lsof -ti:4000 | xargs kill -9

# 서버 재시작
npm run server
```

## 6단계: 테스트

브라우저에서 다음 URL을 열어서 이미지가 로드되는지 확인:

```
https://storage.googleapis.com/distilledchild-art-images/PhAM/PhMA1.JPG
```

웹사이트에서 Interests > Art 메뉴로 가서 미술관 핀을 클릭하여 이미지가 정상적으로 표시되는지 확인합니다.

## 7단계: (선택사항) 로컬 art-images 폴더 삭제

GCS에서 정상적으로 작동하는 것을 확인한 후:

```bash
# 백업 생성 (안전을 위해)
tar -czf art-images-backup.tar.gz public/art-images/

# 로컬 폴더 삭제하여 용량 절약
rm -rf public/art-images/

# 나중에 필요하면 복원 가능
# tar -xzf art-images-backup.tar.gz
```

## Bucket URL 구조

- **Bucket 이름**: distilledchild-art-images
- **공개 URL**: `https://storage.googleapis.com/distilledchild-art-images`
- **이미지 URL 예시**: `https://storage.googleapis.com/distilledchild-art-images/PhAM/PhMA1.JPG`

## 비용 정보

Google Cloud Storage 요금:
- **저장 용량**: Standard Storage는 GB당 약 $0.020/월
- **네트워크 트래픽**:
  - 북미/유럽: 처음 1TB는 무료, 그 다음 GB당 $0.12
  - 아시아: GB당 $0.12
- **2GB 예상 비용**:
  - 저장: 약 $0.04/월
  - 트래픽: 사용량에 따라 다름 (방문자가 적으면 무료 범위 내)

## 문제 해결

### 이미지가 로드되지 않는 경우:

1. **Bucket 권한 확인**:
```bash
gcloud storage buckets get-iam-policy gs://distilledchild-art-images
```

2. **CORS 설정 확인**:
```bash
gcloud storage buckets describe gs://distilledchild-art-images --format="default(cors_config)"
```

3. **파일 존재 확인**:
```bash
gcloud storage ls gs://distilledchild-art-images/PhAM/
```

4. **.env 파일 확인**: GCS_BUCKET_URL이 올바르게 설정되었는지 확인

5. **브라우저 콘솔 확인**: 개발자 도구에서 네트워크 탭을 열어 이미지 요청 상태 확인

## CDN 추가 (선택사항)

더 빠른 로딩을 원한다면 Cloud CDN을 추가할 수 있습니다:

```bash
# Load Balancer와 함께 CDN 설정
# 자세한 내용은 Google Cloud 문서 참조
# https://cloud.google.com/cdn/docs/setting-up-cdn-with-bucket
```

## 환경별 설정

### 개발 환경 (로컬)
- `.env` 파일에 GCS_BUCKET_URL을 **설정하지 않으면** 로컬 폴더 사용
- 로컬 테스트 시 편리

### 프로덕션 환경
- `.env` 파일에 GCS_BUCKET_URL 설정
- 서버는 자동으로 GCS에서 이미지 로드

## 자동화 스크립트

미래에 이미지 업데이트 시 사용할 스크립트:

```bash
#!/bin/bash
# upload-to-gcs.sh

BUCKET="gs://distilledchild-art-images"
SOURCE="public/art-images"

echo "Uploading art-images to GCS bucket..."
gcloud storage rsync --recursive --delete-unmatched-destination "$SOURCE" "$BUCKET"

echo "Upload complete!"
gcloud storage du --summarize "$BUCKET"
```

사용법:
```bash
chmod +x upload-to-gcs.sh
./upload-to-gcs.sh
```
