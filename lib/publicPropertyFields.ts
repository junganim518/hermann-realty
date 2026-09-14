/**
 * 손님(비로그인 포함)이 접근하는 공개 페이지에서 properties 테이블을 조회할 때 사용하는 컬럼 목록.
 * 임대인/임차인 개인정보(landlord_name, landlord_phone, tenant_name, tenant_phone, extra_contacts)와
 * 내부 메모(admin_memo)는 절대 포함하지 않는다 — select('*') 대신 반드시 이 상수를 사용할 것.
 */
export const PUBLIC_PROPERTY_COLUMNS =
  'id, property_number, title, description, address, building_name, unit_number, ' +
  'transaction_type, property_type, theme_type, deposit, monthly_rent, sale_price, ' +
  'maintenance_fee, premium, current_deposit, current_rent, supply_area, exclusive_area, ' +
  'land_area, total_floor_area, building_area, floor_area_ratio, building_coverage_ratio, ' +
  'current_floor, total_floor, direction, parking, elevator, total_parking, room_count, ' +
  'bathroom_count, land_number, available_date, approval_date, usage_type, is_recommended, ' +
  'is_new, is_sold, status, business_name, business_name_public, agent_id, view_count, ' +
  'latitude, longitude, created_at, updated_at';
