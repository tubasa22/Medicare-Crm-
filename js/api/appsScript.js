
/**
 * js/api/appsScript.js
 * 
 * 목적: Apps Script와의 모든 통신을 한 곳에서 관리
 * 
 * 현재 문제점:
 * - callAppsScript() 함수가 index.html에 있고 여러 곳에서 호출
 * - 각 함수마다 동일한 코드 반복
 * - 에러 처리가 일관성 없음
 * 
 * 개선점:
 * - AppsScriptAPI 클래스로 통합 관리
 * - 재시도 로직 추가 가능
 * - 응답 캐싱 가능
 */
const API_URL = "https://script.google.com/macros/d/AKfycbwIvJYqoMt9M7--jdwYytROTIMJmZTlnl7o88ZCEeJQbHcbtWtRRPk65TJL-3o61lbTQA/usercontent";

class AppsScriptAPI {
  constructor(baseUrl) {
    if (!baseUrl) {
      throw new Error('Apps Script URL이 필요합니다');
    }
    this.baseUrl = baseUrl;
    this.timeout = 10000; // 10초
    this.cache = new Map(); // 간단한 캐시
    this.retryCount = 2; // 재시도 횟수
  }

  /**
   * Apps Script 함수 호출 (내부 메서드)
   * @param {string} funcName - 호출할 함수명
   * @param {object} data - 전달할 데이터
   * @returns {Promise<object>} 응답 객체
   */
  async call(funcName, data = {}) {
    // 캐시 확인 (조회 성격의 함수만)
    const cacheKey = `${funcName}:${JSON.stringify(data)}`;
    if (this._isCacheable(funcName) && this.cache.has(cacheKey)) {
      console.log(`📦 캐시 사용: ${funcName}`);
      return this.cache.get(cacheKey);
    }

    let lastError;
    
    // 재시도 로직
    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(this.baseUrl, {
          method: 'POST',
          body: JSON.stringify({ funcName, data }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        // 에러 응답 확인
        if (result.error) {
          throw new Error(result.error);
        }

        // 캐시에 저장
        if (this._isCacheable(funcName)) {
          this.cache.set(cacheKey, result);
        }

        console.log(`✅ ${funcName} 성공:`, result);
        return result;

      } catch (err) {
        lastError = err;
        console.warn(`⚠️ 시도 ${attempt + 1}/${this.retryCount + 1} 실패:`, err.message);

        // 마지막 시도가 아니면 대기 후 재시도
        if (attempt < this.retryCount) {
          const waitMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s 지수백오프
          console.log(`⏳ ${waitMs}ms 후 재시도...`);
          await new Promise(r => setTimeout(r, waitMs));
        }
      }
    }

    // 모든 재시도 실패
    throw new Error(`API 호출 실패 (${funcName}): ${lastError?.message}`);
  }

  /**
   * 캐시 가능 여부 판단 (조회만 캐시)
   */
  _isCacheable(funcName) {
    const readOnlyFuncs = ['getClients', 'getMemos', 'health'];
    return readOnlyFuncs.includes(funcName);
  }

  /**
   * 캐시 초기화
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ 캐시 초기화됨');
  }

  // ============ 고객(Client) 관련 ============

  async getClients() {
    return this.call('getClients');
  }

  async addClient(clientData) {
    this.clearCache(); // 쓰기 작업이므로 캐시 초기화
    return this.call('addClient', clientData);
  }

  async updateClient(clientData) {
    this.clearCache();
    return this.call('updateClient', clientData);
  }

  async deleteClient(rowIdx) {
    this.clearCache();
    return this.call('deleteClient', { rowIdx });
  }

  // ============ 메모(Memo) 관련 ============

  async getMemos(clientName = null) {
    return this.call('getMemos', { name: clientName });
  }

  async addMemo(clientName, memoType, memoText) {
    this.clearCache();
    return this.call('addMemo', {
      name: clientName,
      type: memoType,
      text: memoText,
    });
  }

  // ============ 시스템 ============

  async health() {
    return this.call('health');
  }

  async initSheets() {
    return this.call('initSheets');
  }

  /**
   * URL 변경 (앱 실행 중 설정 변경 시)
   */
  setBaseUrl(newUrl) {
    if (!newUrl) {
      throw new Error('URL이 필요합니다');
    }
    this.baseUrl = newUrl;
    this.clearCache();
    console.log('🔄 API URL 변경됨:', newUrl);
  }
}

// 사용 예시:
/*
// 1. 초기화
const api = new AppsScriptAPI('https://script.google.com/...');

// 2. 간단한 호출
const clients = await api.getClients();

// 3. 데이터 추가
await api.addClient({
  name: '김철수',
  phone: '010-1234-5678',
  email: 'kim@example.com',
  plan: 'Pro',
  biz: '대표이사',
});

// 4. 메모 추가
await api.addMemo('김철수', 'FOLLOW', '다음 주 목요일 연락하기');

// 5. 에러 처리
try {
  await api.addClient({ name: '' }); // 필수값 없음
} catch (err) {
  console.error('실패:', err.message);
}
*/
