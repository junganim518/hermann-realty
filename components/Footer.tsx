export default function Footer() {
  return (
    <footer className="bg-[#111111] text-white py-12 px-8">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src="/logo.png" alt="헤르만부동산 로고" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
              <h3 className="text-xl font-bold">헤르만부동산</h3>
            </div>
            <div className="text-[13px] text-gray-300" style={{ lineHeight: 1.8 }}>
              <p>상호: 헤르만공인중개사사무소</p>
              <p>대표자: 황정아</p>
              <p>주소: 경기도 부천시 신흥로 223 신중동역 랜드마크 푸르지오시티 101동 712호</p>
              <p>등록번호: 제41192-2024-00113호</p>
              <p>전화: 010-8680-8151</p>
              <p>이메일: hermann2024@naver.com</p>
            </div>
          </div>
          <div className="lg:text-right">
            <h4 className="text-lg font-bold mb-4">대표전화 CALL CENTER</h4>
            <p className="text-3xl font-bold text-[#e2a06e]">010-8680-8151</p>
            <p className="text-[13px] text-gray-300 mt-2" style={{ lineHeight: 1.8 }}>평일 10:00 - 19:00 (토요일 10:00 - 19:00)</p>
          </div>
        </div>
        <div className="border-t border-gray-600 pt-6 text-center">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-300 mb-4">
            <a href="#" className="hover:text-white transition">회사소개</a>
            <a href="#" className="hover:text-white transition">매물 의뢰하기</a>
            <a href="#" className="hover:text-white transition">부동산 소식</a>
            <a href="#" className="hover:text-white transition">공지사항</a>
          </div>
          <p className="text-xs text-gray-400">
            Powered by HERMANN © 2026 헤르만부동산. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
