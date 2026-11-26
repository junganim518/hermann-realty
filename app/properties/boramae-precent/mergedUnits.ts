// 서버 컴포넌트(page.tsx)와 클라이언트 컴포넌트(FloorPlan.tsx) 양쪽에서 쓰는 공용 타입/로직.
// 'use client' 모듈(FloorPlan.tsx)에서 직접 export하면 서버 컴포넌트가 그 함수를 import할 때
// 실제 함수가 아니라 클라이언트 레퍼런스로 받아져 호출이 깨지므로, 이 파일은 별도로 둔다.

export type PublicUnit = {
  unit_no: string;
  floor: string;
  zone: string;
  exclusive_area_py: number;
  contract_area_py: number;
  status: string;
  memo?: string | null;
};

// 도면에서 칸 하나로 보여주는 "합쳐진 호실" ↔ DB 호실 두 개의 대응표.
// DB가 합쳐진 상태(단일 행 '103-104'/'301-302')여도, 나뉜 상태(103+104, 301+302 두 행)여도
// 도면·집계 화면이 똑같이 동작하도록 이 표를 기준으로 합쳐서 읍는다.
export const MERGED_UNIT_PAIRS: Record<string, [string, string]> = {
  '103-104': ['103', '104'],
  '301-302': ['301', '302'],
};

// 방문자 화면(평면도 unitMap, page.tsx의 존별 집계)에서 쓸 "표시용" 유닛 목록을 만든다.
// - DB가 아직 합쳐진 상태면 그 행을 그대로 쓴다(추가 작업 없음).
// - DB가 나뉜 상태면 두 호실을 하나의 가상 유닛으로 합친다 — 면적은 합계, 상태·업종(memo)·존은
//   첫 번째 호실(103/301) 값을 그대로 쓴다.
// - 둘 중 하나만 있는 예외 상황이면 손대지 않고 원본 그대로 둔다(화면이 깨지는 것보다 안전).
export function buildDisplayUnits(units: PublicUnit[]): PublicUnit[] {
  const byNo = new Map(units.map(u => [u.unit_no, u]));
  const skip = new Set<string>();
  const merged: PublicUnit[] = [];

  for (const [mergedNo, [firstNo, secondNo]] of Object.entries(MERGED_UNIT_PAIRS)) {
    if (byNo.has(mergedNo)) continue; // 이미 합쳐진 행 — 그대로 사용
    const first = byNo.get(firstNo);
    const second = byNo.get(secondNo);
    if (!first || !second) continue; // 둘 다 있어야 묶음 처리
    skip.add(firstNo);
    skip.add(secondNo);
    merged.push({
      ...first,
      unit_no: mergedNo,
      exclusive_area_py: first.exclusive_area_py + second.exclusive_area_py,
      contract_area_py: first.contract_area_py + second.contract_area_py,
    });
  }

  return [...units.filter(u => !skip.has(u.unit_no)), ...merged];
}
