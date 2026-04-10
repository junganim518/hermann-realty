import { NextRequest, NextResponse } from 'next/server';

type Cat = { name: string; count: number };
type CompetitionLevel = '낮음' | '보통' | '높음';

const LEVEL_COLOR: Record<CompetitionLevel, string> = {
  '높음': '#ef5350',
  '보통': '#e2a06e',
  '낮음': '#66bb6a',
};

function getBusinessCategory(businessType: string): string {
  if (['카페/디저트', '베이커리'].some(k => businessType.includes(k.split('/')[0]))) return 'cafe';
  if (['한식', '중식', '일식', '양식', '분식', '치킨', '피자', '이자카야', '샐러드', '국수', '해산물', '보쌈'].some(k => businessType.includes(k))) return 'food';
  if (['편의점', '슈퍼', '반찬', '꽃집'].some(k => businessType.includes(k))) return 'retail';
  if (['미용실', '네일', '피부', '필라테스', '헬스', '세탁', '사진'].some(k => businessType.includes(k))) return 'beauty';
  if (['동물병원', '치과', '피부과', '한의원', '약국', '안과', '정형', '소아'].some(k => businessType.includes(k))) return 'medical';
  if (['어린이집', '유치원', '학원', '영어', '코딩', '독서실'].some(k => businessType.includes(k))) return 'education';
  if (['반려동물'].some(k => businessType.includes(k))) return 'pet';
  return 'general';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const categories: Cat[] = body.categories || [];
    const topSubCategories: Cat[] = body.topSubCategories || [];
    const total: number = body.total || 0;
    const businessType: string = body.businessType || '';

    // ── 카운트 헬퍼 ──
    const sumCat = (...keywords: string[]): number =>
      categories.filter(c => keywords.some(k => c.name.includes(k))).reduce((s, c) => s + c.count, 0);
    const sumSub = (...keywords: string[]): number =>
      topSubCategories.filter(c => keywords.some(k => c.name.includes(k))).reduce((s, c) => s + c.count, 0);
    const ratio = (n: number) => (total > 0 ? (n / total) * 100 : 0);

    // 대분류 카운트
    const foodCount = sumCat('음식');
    const retailCount = sumCat('소매');
    const realtyCount = sumCat('부동산');
    const financeCount = sumCat('금융');
    const medicalCount = sumCat('의료', '보건');
    const educationCount = sumCat('교육', '학문');
    const lodgingCount = sumCat('숙박');
    const leisureCount = sumCat('여가', '오락', '스포츠');

    // 세부 업종 카운트
    const cafeSub = sumSub('카페', '커피', '디저트', '제과');
    const pharmacySub = sumSub('약국');
    const lawSub = sumSub('법무', '세무', '회계');
    const stationerySub = sumSub('문구', '서점');
    const laundrySub = sumSub('세탁');
    const petSub = sumSub('애완', '반려동물', '펫');
    const healthFoodSub = sumSub('샐러드', '건강식', '비건');
    const beautySub = sumSub('미용', '네일', '피부');

    // 선택업종 토큰 매칭 헬퍼
    const typeMatchedCount = (): number => {
      if (!businessType) return 0;
      const tokens = businessType.split(/[·\s/()]/).filter(t => t.length >= 2);
      return topSubCategories
        .filter(s => tokens.some(t => s.name.includes(t)))
        .reduce((s, c) => s + c.count, 0);
    };

    // ── 분기: businessType 카테고리별 분석 ────────────────────
    let flow: Record<string, string> = {};
    let sparseList: { name: string; reason: string }[] = [];
    let recommendTable: { 배후수요: string; 타겟: string; 상권특징: string; 추천업종: string }[] = [];

    const businessCategory = businessType ? getBusinessCategory(businessType) : 'general';

    if (businessCategory === 'cafe') {
      flow = {
        점심: foodCount > 50
          ? '점심 후 카페 수요 높음. 식당 밀집 지역이라 디저트 연계 가능'
          : '점심 유동 보통. 테이크아웃 커피 수요 위주',
        저녁: '퇴근 후 카공족·모임 수요. 19~22시 체류형 고객 비율 높음',
        주말: retailCount > 50
          ? '주말 쇼핑 후 카페 방문 패턴. 체류 시간 길어 매출 유리'
          : '주말 주거민 중심 브런치 카페 수요',
      };
      const reason = cafeSub < 5
        ? '반경 내 카페 수가 적어 희소성 높음. 진입 적기'
        : cafeSub <= 15
          ? '카페 수 보통 수준. 콘셉트 차별화 필요'
          : '카페 경쟁 강함. 스페셜티·공간형 등 특화 필수';
      sparseList.push({ name: businessType, reason });
      recommendTable.push({
        배후수요: foodCount > 80 ? '외식 후 카페 연계 수요' : '주거민·직장인 혼재',
        타겟: '2030 직장인·카공족',
        상권특징: cafeSub > 15 ? '카페 경쟁 심화 지역' : '카페 희소 지역',
        추천업종: cafeSub > 15 ? '스페셜티·공간형 카페' : '테이크아웃·동네 카페',
      });
    }

    else if (businessCategory === 'food') {
      const typeFoodSub = typeMatchedCount();
      flow = {
        점심: foodCount > 100
          ? '경쟁 강함. 점심 피크 확보 필수. 회전율 높은 메뉴 구성 필요'
          : '점심 수요 안정적. 주변 직장인·주거민 타겟 가능',
        저녁: foodCount > 80
          ? '저녁 외식 경쟁 치열. 차별화된 메뉴·인테리어 필수'
          : '저녁 외식 수요 대비 공급 적음. 진입 유리',
        주말: '주말 가족 단위 외식 수요. 단체석·주차 여부가 매출 좌우',
      };
      const reason = typeFoodSub < 5
        ? `반경 내 ${businessType} 동종 점포가 거의 없어 희소성 매우 높음`
        : typeFoodSub <= 15
          ? `${businessType} 점포 보통 수준. 메뉴·콘셉트 차별화 필요`
          : `${businessType} 경쟁 강함. 차별화 포지셔닝 필수`;
      sparseList.push({ name: businessType, reason });
      recommendTable.push({
        배후수요: foodCount > 100 ? '대형 외식 상권' : '근린 외식 수요',
        타겟: '2040 직장인·인근 거주민',
        상권특징: foodCount > 100 ? '경쟁 치열, 차별화 필수' : '외식 수요 대비 공급 적음',
        추천업종: businessType,
      });
    }

    else if (businessCategory === 'retail') {
      flow = {
        점심: '점심 시간 편의 구매 수요. 직장인 간편식·음료 구매 패턴',
        저녁: '퇴근길 장보기 수요. 18~20시 피크',
        주말: '주말 주거민 생활 소비 집중. 주말 매출 비중 높음',
      };
      const typeRetailSub = typeMatchedCount();
      const reason = typeRetailSub < 5
        ? `반경 내 ${businessType} 점포가 부족해 신규 진입 기회`
        : typeRetailSub <= 15
          ? `${businessType} 보통 수준. 입지·서비스 차별화 필요`
          : `${businessType} 경쟁 심화. 가격·구색 경쟁력 필수`;
      sparseList.push({ name: businessType, reason });
      recommendTable.push({
        배후수요: retailCount > 50 ? '주거 밀집 생활형 상권' : '인근 주거·통행 수요',
        타겟: '전 연령 거주민',
        상권특징: retailCount > 50 ? '근린 소매 활발 지역' : '소매 진입 여지 있음',
        추천업종: businessType,
      });
    }

    else if (businessCategory === 'beauty') {
      flow = {
        오전: '오전 예약 고객 중심. 주부·재택근무자 비율 높음',
        점심: '직장인 점심시간 네일·피부 예약 수요',
        주말: '주말 예약 집중. 사전 예약 시스템 필수',
      };
      const reason = beautySub < 5
        ? `반경 내 ${businessType} 관련 업종 적음. 신규 진입 기회 큼`
        : beautySub <= 15
          ? `${businessType} 보통 수준. 시술·인테리어 차별화 필요`
          : `${businessType} 경쟁 강함. 멤버십·전문성 차별화 필수`;
      sparseList.push({ name: businessType, reason });
      recommendTable.push({
        배후수요: '2040 여성 인근 거주·직장인',
        타겟: '2040 여성',
        상권특징: beautySub > 15 ? '뷰티 경쟁 강한 지역' : '뷰티 수요 대비 공급 부족',
        추천업종: businessType,
      });
    }

    else if (businessCategory === 'medical') {
      flow = {
        오전: medicalCount > 20
          ? '의료 클러스터 형성. 오전 환자 집중되나 경쟁 심함'
          : '오전 내원 수요 안정적. 경쟁 낮아 진입 유리',
        오후: '오후 재진·처방 환자 유입. 14~17시 피크',
        주말: '주말 휴진 여부에 따라 차별화 가능. 주말 진료 시 경쟁 우위',
      };
      const typeMedSub = typeMatchedCount();
      const reason = typeMedSub < 3
        ? `반경 내 ${businessType} 부족. 신규 개원 기회`
        : typeMedSub <= 8
          ? `${businessType} 적정 수준. 진료 영역 차별화 필요`
          : `${businessType} 포화. 전문의·시설 차별화 필수`;
      sparseList.push({ name: businessType, reason });
      recommendTable.push({
        배후수요: medicalCount > 20 ? '의료 클러스터 환자군' : '주거 인근 환자 수요',
        타겟: '4060 거주민·환자',
        상권특징: medicalCount > 20 ? '의료기관 밀집 지역' : '의료 진입 여지 있음',
        추천업종: businessType,
      });
    }

    else if (businessCategory === 'education') {
      flow = {
        오후: educationCount > 15
          ? '학원가 포화. 차별화된 커리큘럼 필수'
          : '학원 수요 대비 공급 부족. 진입 적기',
        저녁: '하원 후 저녁 학원 수요. 17~21시 집중',
        주말: '주말 특강·보충 수요 존재. 주말반 운영 시 추가 수익 가능',
      };
      const reason = educationCount < 5
        ? `반경 내 ${businessType} 거의 없음. 선점 기회`
        : educationCount <= 15
          ? `${businessType} 보통 수준. 커리큘럼 차별화 필요`
          : `${businessType} 경쟁 치열. 결과·실적 중심 마케팅 필수`;
      sparseList.push({ name: businessType, reason });
      recommendTable.push({
        배후수요: educationCount > 15 ? '학원가 학생·학부모' : '학령기 자녀 가구',
        타겟: '학생·학부모',
        상권특징: educationCount > 15 ? '학원가 포화' : '학원 수요 미충족',
        추천업종: businessType,
      });
    }

    else if (businessCategory === 'pet') {
      flow = {
        오전: '오전 산책 후 방문 패턴. 주거 밀집 지역일수록 유리',
        저녁: '퇴근 후 펫샵 방문. 1인 가구 반려동물 증가 추세',
        주말: '주말 반려동물 용품·미용 수요 집중',
      };
      const reason = petSub < 3
        ? `반경 내 ${businessType} 거의 없음. 반려인 유입 선점 가능`
        : petSub <= 8
          ? `${businessType} 보통 수준. 차별화된 서비스 필요`
          : `${businessType} 경쟁 심화. 프리미엄·전문성 강조 필요`;
      sparseList.push({ name: businessType, reason });
      recommendTable.push({
        배후수요: '주거 밀집 반려인 가구',
        타겟: '2040 반려인',
        상권특징: petSub > 8 ? '반려동물 시장 활성' : '반려 시장 진입 여지',
        추천업종: businessType,
      });
    }

    else {
      // ── general (기존 일반 로직) ──────────────────────────
      let lunchMsg: string;
      if (foodCount > 150) lunchMsg = '대형 외식 상권, 점심 피크 시 인파 집중. 테이크아웃·배달 수요 매우 높음';
      else if (foodCount > 80) lunchMsg = '음식점 밀집 지역, 직장인 점심 수요 활발. 회전율 높은 업종 유리';
      else if (foodCount > 30) lunchMsg = '근린 외식 수요 존재, 점심 유동 보통 수준';
      else lunchMsg = '외식 업종 적음, 점심 유동 낮음. 배달 의존도 높은 지역 가능성';

      let dinnerMsg: string;
      if (foodCount > 100 && cafeSub > 20) dinnerMsg = '저녁 외식+카페 수요 모두 활발. 퇴근 후 체류형 소비 패턴';
      else if (foodCount > 100) dinnerMsg = '저녁 외식 수요 강함. 1인·2인 소규모 외식 위주';
      else if ((lodgingCount + leisureCount) > 10) dinnerMsg = '저녁~심야 여가 소비 활발. 주류·엔터테인먼트 업종 유망';
      else if (retailCount > 100) dinnerMsg = '저녁 생활형 소비 패턴. 마트·편의점·생활잡화 수요 높음';
      else dinnerMsg = '저녁 유동 낮은 편. 주간 중심 상권';

      let weekendMsg: string;
      if ((lodgingCount + leisureCount) > 20) weekendMsg = '주말 외부 유입 관광·여가객 비율 높음. 체험형·카페형 업종 유망';
      else if (educationCount > 30) weekendMsg = '주말에도 학원가 유동 유지. 학부모 동반 방문 많음';
      else if (foodCount > 150 && retailCount > 100) weekendMsg = '주말 생활 소비 집중. 가족 단위 방문객 多';
      else if (realtyCount > 50) weekendMsg = '주말 부동산 탐방객 유입. 신규 이주 수요 지역';
      else weekendMsg = '주말 유동 평일 대비 낮음. 주거 중심 조용한 상권';

      flow = { 점심: lunchMsg, 저녁: dinnerMsg, 주말: weekendMsg };
      if (realtyCount > 20 || financeCount > 20) flow.오전 = '업무 목적 방문객 집중, 평일 오전 피크';
      if (medicalCount > 20) flow.오후 = '중장년층 방문 비율 높음, 오후 2~4시 피크';

      // 일반 추천 테이블
      if (ratio(foodCount) > 25) recommendTable.push({ 배후수요: '직장인·거주민 혼재', 타겟: '2030 직장인', 상권특징: '점심·저녁 외식 수요 높음', 추천업종: '전문 식당·이자카야·샐러드바' });
      if (medicalCount > 15) recommendTable.push({ 배후수요: '중장년 거주민', 타겟: '4050 지역 주민', 상권특징: '의료 클러스터 형성', 추천업종: '약국·건강기능식품·한의원' });
      if (educationCount > 10) recommendTable.push({ 배후수요: '학부모·학생', 타겟: '초중고 학생', 상권특징: '학원가 배후 상권', 추천업종: '분식·카페·문구점' });
      if (realtyCount > 20) recommendTable.push({ 배후수요: '신규 이주민·투자자', 타겟: '3040 실수요자', 상권특징: '부동산 거래 활발', 추천업종: '법무사·이사업체·인테리어' });
      if (retailCount > 30) recommendTable.push({ 배후수요: '인근 거주민', 타겟: '전 연령', 상권특징: '생활형 근린상권', 추천업종: '편의점·세탁소·미용실' });
    }

    // ── 일반 희소업종 보강 (모든 카테고리 공통) ───────────────
    const sparseGeneral: { name: string; reason: string }[] = [];
    if (ratio(foodCount) > 30 && cafeSub < 10) sparseGeneral.push({ name: '프리미엄 카페', reason: '식사 후 카페 수요 대비 공급 부족' });
    if (medicalCount > 20 && pharmacySub < 5) sparseGeneral.push({ name: '약국', reason: '의원 밀집 대비 약국 절대 부족' });
    if (realtyCount > 30 && lawSub < 3) sparseGeneral.push({ name: '법무·세무사무소', reason: '부동산 거래 관련 전문직 수요 높음' });
    if (educationCount > 15 && stationerySub < 3) sparseGeneral.push({ name: '문구·서점', reason: '학원가 밀집 대비 학용품 구매처 부족' });
    if (foodCount > 50 && laundrySub < 5) sparseGeneral.push({ name: '세탁소', reason: '직장인·1인가구 밀집 지역 생활 편의 수요' });
    if (retailCount > 30 && petSub < 3) sparseGeneral.push({ name: '반려동물샵', reason: '주거 밀집 지역 펫 관련 수요 증가 추세' });
    if (foodCount > 40 && healthFoodSub < 3) sparseGeneral.push({ name: '샐러드·건강식', reason: '외식 수요 높은 지역, 건강식 대안 부족' });

    sparseList = [...sparseList, ...sparseGeneral].slice(0, 3);

    // ── 추천테이블 보강 (선택업종 카테고리에서 1행만 채운 경우) ──
    if (businessCategory !== 'general') {
      if (ratio(foodCount) > 25) recommendTable.push({ 배후수요: '직장인·거주민 혼재', 타겟: '2030 직장인', 상권특징: '점심·저녁 외식 수요 높음', 추천업종: '전문 식당·이자카야·샐러드바' });
      if (medicalCount > 15) recommendTable.push({ 배후수요: '중장년 거주민', 타겟: '4050 지역 주민', 상권특징: '의료 클러스터 형성', 추천업종: '약국·건강기능식품·한의원' });
      if (educationCount > 10) recommendTable.push({ 배후수요: '학부모·학생', 타겟: '초중고 학생', 상권특징: '학원가 배후 상권', 추천업종: '분식·카페·문구점' });
      if (retailCount > 30) recommendTable.push({ 배후수요: '인근 거주민', 타겟: '전 연령', 상권특징: '생활형 근린상권', 추천업종: '편의점·세탁소·미용실' });
    }
    const recommendTableTop = recommendTable.slice(0, 3);

    // ── 경쟁 현황 (공통) ──────────────────────────────────────
    const compTargets = [...topSubCategories].sort((a, b) => b.count - a.count).slice(0, 8);
    const n = compTargets.length;
    const highCut = Math.ceil(n / 3);
    const midCut = Math.ceil((n * 2) / 3);
    const competition = compTargets.map((c, i) => {
      let level: CompetitionLevel;
      if (i < highCut) level = '높음';
      else if (i < midCut) level = '보통';
      else level = '낮음';
      return { name: c.name, level, color: LEVEL_COLOR[level] };
    });

    const report = {
      동선패턴: flow,
      희소업종: sparseList,
      경쟁현황: competition,
      추천테이블: recommendTableTop,
    };

    return NextResponse.json({ report });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '리포트 생성 실패' }, { status: 500 });
  }
}
