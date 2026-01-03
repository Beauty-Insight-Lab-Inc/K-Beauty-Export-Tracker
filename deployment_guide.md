# 🌐 Vercel Custom Domain Deployment Guide

## 1. Vercel Project Setup
1.  **Vercel 로그인**: [Vercel Dashboard](https://vercel.com/dashboard)에 접속합니다.
2.  **Add New Project**: `Add New...` > `Project`를 클릭합니다.
3.  **Import Git Repository**: 방금 업로드한 `Beauty-Insight-Lab-Inc/K-Beauty-Export-Tracker` 저장소를 Import 합니다.
4.  **Environment Variables**: `.env.local`의 내용을 복사하여 Vercel 환경 변수에 추가합니다.
    *   `GEMINI_API_KEY`
    *   `KOREA_CUSTOMS_API_KEY`
    *   `UPSTASH_REDIS_REST_URL`
    *   `UPSTASH_REDIS_REST_TOKEN`
5.  **Deploy**: `Deploy` 버튼을 눌러 초기 배포를 시작합니다.

## 2. Connect Custom Domain (`www.beautyinsightlab.com`)
1.  배포가 완료되면, 해당 프로젝트의 **Settings** > **Domains** 탭으로 이동합니다.
2.  입력창에 `www.beautyinsightlab.com`을 입력하고 `Add`를 클릭합니다.
3.  Vercel이 제공하는 **DNS 설정 값** (CNAME 또는 A Record)을 확인합니다.
    *   보통 `CNAME` 레코드로 `cname.vercel-dns.com`을 설정하라고 나옵니다.

## 3. DNS Configuration (Domain Registrar)
도메인을 구매한 사이트(가비아, 후이즈, AWS Route53 등)의 관리 페이지로 이동합니다.

1.  **DNS 설정** 메뉴를 찾습니다.
2.  **CNAME 레코드 추가**:
    *   **Host (Name)**: `www`
    *   **Value (Target)**: `cname.vercel-dns.com` (또는 Vercel에서 제공한 값)
    *   **TTL**: 기본값 (예: 3600)
3.  **(선택) Root Domain 설정** (`beautyinsightlab.com`):
    *   Vercel은 보통 Root Domain도 함께 설정하길 권장합니다.
    *   **A Record** 추가: Host `@`, Value `76.76.21.21` (Vercel IP)

## 4. Verification
1.  Vercel Domains 페이지로 돌아와서 `Refresh` 또는 `Verify`를 클릭합니다.
2.  DNS 전파에는 최대 24시간이 걸릴 수 있으나, 보통 수 분 내에 완료됩니다.
3.  `Valid Configuration` (초록색 체크)이 뜨면 설정 완료!

이제 `https://www.beautyinsightlab.com`으로 접속하면 K-Beauty Export Tracker를 볼 수 있습니다.
