/**
 * js/services/clientService.js
 * 
 * 목적: 고객 관련 비즈니스 로직을 한곳에서 관리
 * 
 * 현재 문제점:
 * - 고객 관련 함수가 10개 이상 흩어져있음
 * - addClientModal(), createNewClient(), addClientToAppsScript() 등이 서로 호출
 * - 데이터 검증 로직이 여러 곳에 있음
 * 
 * 개선점:
 * - ClientService 클래스로 통합
 * - 메서드별 역할 분명함
 * - 재사용 가능한 로직들 (검증, 필터링 등)
 */

class ClientService {
  /**
   * @param {AppsScriptAPI} api - API 인스턴스
   */
  constructor(api) {
    this.api = api;
    this.clients = []; // 메모리 캐시
    this.isLoading = false;
  }

  // ============ 데이터 로드 ============

  /**
   * 모든 고객 데이터를 로드하고 메모리에 저장
   * @returns {Promise<Array>} 고객 배열
   */
  async loadAll() {
    try {
      this.isLoading = true;
      const result = await this.api.getClients();

      if (!result.clients || !Array.isArray(result.clients)) {
        throw new Error('잘못된 응답 형식');
      }

      this.clients = result.clients;
      console.log(`📥 ${this.clients.length}명의 고객 로드됨`);
      return this.clients;

    } catch (err) {
      console.error('고객 로드 실패:', err);
      throw new Error(`고객 데이터를 불러올 수 없습니다: ${err.message}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 메모리에 있는 고객 반환 (로드 없이 접근)
   */
  getAllSync() {
    return this.clients;
  }

  /**
   * 특정 고객 찾기
   */
  getById(rowIdx) {
    return this.clients.find(c => c.rowIdx === rowIdx);
  }

  getByName(name) {
    return this.clients.find(c => c.name === name);
  }

  // ============ 생성/수정/삭제 ============

  /**
   * 새 고객 추가
   * @param {object} clientData - 고객 데이터
   * @returns {Promise<boolean>} 성공 여부
   */
  async create(clientData) {
    try {
      // 1. 데이터 검증
      const validated = this._validateClientData(clientData, 'create');

      // 2. API 호출
      const result = await this.api.addClient(validated);

      if (!result.ok) {
        throw new Error(result.error || '추가 실패');
      }

      // 3. 메모리 업데이트 (선택: API에서 새 데이터를 받거나 다시 로드)
      await this.loadAll();

      console.log('✅ 고객 추가 성공:', validated.name);
      return true;

    } catch (err) {
      console.error('고객 추가 실패:', err);
      throw err;
    }
  }

  /**
   * 고객 정보 수정
   */
  async update(clientData) {
    try {
      // 1. rowIdx 필수 확인
      if (!clientData.rowIdx) {
        throw new Error('수정할 고객을 선택해주세요');
      }

      // 2. 데이터 검증
      const validated = this._validateClientData(clientData, 'update');

      // 3. API 호출
      const result = await this.api.updateClient(validated);

      if (!result.ok) {
        throw new Error(result.error || '수정 실패');
      }

      // 4. 메모리 업데이트
      await this.loadAll();

      console.log('✅ 고객 정보 수정 성공:', validated.name);
      return true;

    } catch (err) {
      console.error('고객 수정 실패:', err);
      throw err;
    }
  }

  /**
   * 고객 삭제
   */
  async delete(rowIdx) {
    try {
      if (!rowIdx) {
        throw new Error('삭제할 고객을 선택해주세요');
      }

      // 2단계 확인 (사용자 실수 방지)
      const client = this.getById(rowIdx);
      const confirmed = confirm(
        `"${client?.name || '이 고객'}"을 정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
      );

      if (!confirmed) {
        return false;
      }

      // API 호출
      const result = await this.api.deleteClient(rowIdx);

      if (!result.ok) {
        throw new Error(result.error || '삭제 실패');
      }

      // 메모리 업데이트
      await this.loadAll();

      console.log('✅ 고객 삭제 성공');
      return true;

    } catch (err) {
      console.error('고객 삭제 실패:', err);
      throw err;
    }
  }

  // ============ 검색 & 필터링 ============

  /**
   * 키워드로 고객 검색
   * @param {string} keyword - 검색어
   * @returns {Array} 매칭된 고객들
   */
  search(keyword) {
    if (!keyword || keyword.trim() === '') {
      return this.clients;
    }

    const query = keyword.toLowerCase();
    return this.clients.filter(client =>
      client.name.toLowerCase().includes(query) ||
      client.phone.includes(query) ||
      client.email.toLowerCase().includes(query) ||
      client.biz.toLowerCase().includes(query)
    );
  }

  /**
   * 플랜으로 필터링
   */
  filterByPlan(plan) {
    if (!plan) return this.clients;
    return this.clients.filter(c => c.plan === plan);
  }

  /**
   * 에이전트 리퍼 여부로 필터링
   */
  filterByReferral(isReferral) {
    return this.clients.filter(c => 
      isReferral ? c.ref === 'TRUE' : c.ref !== 'TRUE'
    );
  }

  /**
   * 다음 연락일이 N일 이내인 고객
   */
  getDueForFollowup(daysAhead = 7) {
    const today = new Date();
    const cutoff = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    return this.clients.filter(client => {
      if (!client.next) return false;
      const nextDate = new Date(client.next);
      return nextDate <= cutoff && nextDate >= today;
    });
  }

  // ============ 통계 ============

  /**
   * 플랜별 고객 수
   */
  getStatsByPlan() {
    const stats = {};
    this.clients.forEach(c => {
      stats[c.plan] = (stats[c.plan] || 0) + 1;
    });
    return stats;
  }

  /**
   * 전체 고객 수
   */
  getTotal() {
    return this.clients.length;
  }

  /**
   * 에이전트 리퍼 비율
   */
  getReferralRate() {
    const referralCount = this.clients.filter(c => c.ref === 'TRUE').length;
    return this.clients.length ? 
      ((referralCount / this.clients.length) * 100).toFixed(1) : 
      0;
  }

  // ============ 데이터 검증 (내부) ============

  /**
   * 고객 데이터 검증
   * @param {object} data - 검증할 데이터
   * @param {string} mode - 'create' 또는 'update'
   */
  _validateClientData(data, mode = 'create') {
    // 필수값 검증
    if (!data.name || data.name.trim() === '') {
      throw new Error('고객명은 필수입니다');
    }

    if (!data.phone || data.phone.trim() === '') {
      throw new Error('연락처는 필수입니다');
    }

    // 전화번호 형식 검증 (간단한 예)
    if (!this._isValidPhone(data.phone)) {
      throw new Error('올바른 전화번호가 아닙니다');
    }

    // 이메일 형식 검증 (이메일이 있으면)
    if (data.email && !this._isValidEmail(data.email)) {
      throw new Error('올바른 이메일이 아닙니다');
    }

    // 정제된 데이터 반환
    return {
      rowIdx: data.rowIdx || null,
      no: data.no || '',
      name: data.name.trim(),
      biz: (data.biz || '').trim(),
      phone: (data.phone || '').trim(),
      email: (data.email || '').toLowerCase().trim(),
      plan: data.plan || '',
      prod: (data.prod || '').trim(),
      memo: (data.memo || '').trim(),
      next: data.next || '',
      ref: data.ref === 'TRUE' || data.ref === true ? 'TRUE' : 'FALSE',
      durl: (data.durl || '').trim(),
    };
  }

  /**
   * 전화번호 검증
   */
  _isValidPhone(phone) {
    // 숫자, 하이픈, +, 공백만 허용
    return /^[\d\-\+\s()]+$/.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  /**
   * 이메일 검증
   */
  _isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  /**
   * 다음 연락일 검증
   */
  _isValidDate(dateStr) {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }
}

// ============ 사용 예시 ============

/*
// 1. 초기화
const clientService = new ClientService(api);

// 2. 모든 고객 로드
await clientService.loadAll();

// 3. 고객 추가
await clientService.create({
  name: '김철수',
  phone: '010-1234-5678',
  email: 'kim@example.com',
  plan: 'Pro',
  biz: '대표이사',
  prod: 'Premium Package',
  memo: '20년 고객',
  next: '2024-12-15',
  ref: 'TRUE',
});

// 4. 검색
const results = clientService.search('김');
console.log(results);

// 5. 통계
console.log('플랜별:', clientService.getStatsByPlan());
console.log('전체:', clientService.getTotal());
console.log('리퍼율:', clientService.getReferralRate() + '%');

// 6. 팔로업 대상
const dueSoon = clientService.getDueForFollowup(7);
console.log('다음 1주일 내:', dueSoon);

// 7. 고객 수정
await clientService.update({
  rowIdx: 2,
  name: '김철수',
  phone: '010-9999-8888',
  email: 'kim.new@example.com',
  // ... 나머지 필드
});

// 8. 고객 삭제
await clientService.delete(2);
*/
