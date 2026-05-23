/**
 * js/app.js
 * 
 * 목적: 앱 전체의 초기화, 이벤트 관리, 상태 조율
 * 
 * 현재 문제점:
 * - 초기화 코드가 index.html 내에 흩어져있음
 * - 어떤 순서로 초기화하는지 불명확
 * - 전역 변수들이 많음
 * 
 * 개선점:
 * - App 클래스로 중앙집중식 관리
 * - 초기화 순서가 명확함
 * - 모든 서비스에 접근할 수 있는 진입점
 */

class App {
  constructor() {
    // 상태
    this.isLoggedIn = false;
    this.currentUser = null;
    this.isOnline = navigator.onLine;

    // 서비스들
    this.api = null;
    this.clientService = null;
    this.memoService = null;
    this.followupService = null;

    // UI
    this.ui = new UIRenderer();

    // 설정
    this.config = {
      appScriptUrlKey: 'fcrm_apps_script_url',
      userKey: 'fcrm_user',
      autoSyncInterval: 60000, // 60초마다 자동 동기화
    };

    // 타이머
    this.syncTimer = null;
    this.healthCheckTimer = null;
  }

  /**
   * 앱 시작
   */
  async init() {
    try {
      console.log('🚀 앱 초기화 시작...');

      // 1단계: 로그인 확인
      if (!this._checkLogin()) {
        console.log('❌ 로그인 필요');
        this.ui.showPage('loginScreen');
        return;
      }

      // 2단계: 설정 확인 (Apps Script URL)
      const appsScriptUrl = this._getAppsScriptUrl();
      if (!appsScriptUrl) {
        console.log('⚠️ Apps Script URL 설정 필요');
        this.ui.showToast('Settings 탭에서 Apps Script URL을 설정해주세요');
        this.ui.showPage('settingsPage');
        return;
      }

      // 3단계: API 초기화
      console.log('📡 API 초기화 중...');
      this.api = new AppsScriptAPI(appsScriptUrl);

      // 4단계: 서비스 초기화
      console.log('⚙️ 서비스 초기화 중...');
      this.clientService = new ClientService(this.api);
      this.memoService = new MemoService(this.api);
      this.followupService = new FollowupService(this.api);

      // 5단계: 서버 상태 확인
      console.log('🔍 서버 연결 확인 중...');
      const isHealthy = await this._checkHealth();
      if (!isHealthy) {
        this.ui.showToast('❌ 서버에 연결할 수 없습니다. 나중에 다시 시도해주세요.');
        this.ui.setConnectionStatus(false);
        // 오프라인 모드로 계속 진행하도록 허용
      } else {
        this.ui.setConnectionStatus(true);
      }

      // 6단계: 초기 데이터 로드
      console.log('📥 데이터 로드 중...');
      this.ui.showLoading(true);
      await this._loadInitialData();
      this.ui.showLoading(false);

      // 7단계: UI 표시
      console.log('🎨 UI 렌더링 중...');
      this._renderMainUI();

      // 8단계: 이벤트 리스너 등록
      console.log('👂 이벤트 리스너 등록 중...');
      this._attachEventListeners();

      // 9단계: 자동 동기화 시작
      console.log('⏰ 자동 동기화 시작...');
      this._startAutoSync();

      // 10단계: 온라인/오프라인 감지
      this._watchConnectionStatus();

      console.log('✅ 앱 초기화 완료!');
      this.ui.showToast('✅ 앱이 준비되었습니다');

    } catch (err) {
      console.error('❌ 앱 초기화 실패:', err);
      this.ui.showToast(`❌ 오류: ${err.message}`);
      this._showErrorScreen(err);
    }
  }

  // ============ 로그인/인증 ============

  /**
   * 구글 로그인
   */
  async signInWithGoogle() {
    try {
      // 실제 구현에서는 Google Sign-In SDK 사용
      // 여기는 예시코드
      const result = await new Promise((resolve) => {
        // Google Sign-In 팝업 또는 Firebase 인증
        // ...
        resolve({
          name: 'John Doe',
          email: 'john@example.com',
          photoUrl: 'https://example.com/photo.jpg',
        });
      });

      this._setUser(result);
      await this.init(); // 앱 초기화 시작

    } catch (err) {
      this.ui.showToast('❌ 로그인 실패: ' + err.message);
    }
  }

  /**
   * 로그아웃
   */
  logout() {
    localStorage.removeItem(this.config.userKey);
    this.isLoggedIn = false;
    this.currentUser = null;

    // 타이머 정리
    this._stopAutoSync();

    this.ui.showToast('로그아웃되었습니다');
    location.reload();
  }

  /**
   * 로그인 확인
   */
  _checkLogin() {
    const userJson = localStorage.getItem(this.config.userKey);
    if (!userJson) return false;

    try {
      this.currentUser = JSON.parse(userJson);
      this.isLoggedIn = true;
      this.ui.setUserInfo(this.currentUser);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 사용자 정보 저장
   */
  _setUser(user) {
    this.currentUser = user;
    this.isLoggedIn = true;
    localStorage.setItem(this.config.userKey, JSON.stringify(user));
    this.ui.setUserInfo(user);
  }

  // ============ 설정 ============

  /**
   * Apps Script URL 가져오기
   */
  _getAppsScriptUrl() {
    return localStorage.getItem(this.config.appScriptUrlKey);
  }

  /**
   * Apps Script URL 설정
   */
  setAppsScriptUrl(url) {
    if (!url || url.trim() === '') {
      throw new Error('URL을 입력해주세요');
    }

    localStorage.setItem(this.config.appScriptUrlKey, url.trim());
    this.ui.showToast('✅ URL이 저장되었습니다');

    // API 재초기화
    if (this.api) {
      this.api.setBaseUrl(url.trim());
    }
  }

  // ============ 데이터 로드 ============

  /**
   * 초기 데이터 로드
   */
  async _loadInitialData() {
    try {
      const promises = [
        this.clientService.loadAll(),
        this.memoService.loadAll(),
        this.followupService.loadAll(),
      ];

      const [clients, memos, followups] = await Promise.all(promises);

      console.log(
        `✅ 데이터 로드 완료: ${clients.length}명, ${memos.length}개 메모, ${followups.length}개 팔로업`
      );

      return { clients, memos, followups };

    } catch (err) {
      console.error('데이터 로드 실패:', err);
      throw new Error('데이터를 불러올 수 없습니다: ' + err.message);
    }
  }

  /**
   * 데이터 새로고침 (수동)
   */
  async refreshData() {
    try {
      this.ui.showLoading(true);
      await this._loadInitialData();
      this._renderMainUI();
      this.ui.showToast('✅ 새로고침 완료');
    } catch (err) {
      this.ui.showToast('❌ 새로고침 실패: ' + err.message);
    } finally {
      this.ui.showLoading(false);
    }
  }

  // ============ 서버 상태 확인 ============

  /**
   * 서버 헬스 체크
   */
  async _checkHealth() {
    try {
      const result = await this.api.health();
      return result.ok === true;
    } catch (err) {
      console.warn('헬스 체크 실패:', err.message);
      return false;
    }
  }

  /**
   * 정기적 헬스 체크 시작
   */
  _startHealthCheck() {
    this.healthCheckTimer = setInterval(async () => {
      const isHealthy = await this._checkHealth();
      this.ui.setConnectionStatus(isHealthy);
    }, 30000); // 30초마다
  }

  /**
   * 온라인/오프라인 상태 감시
   */
  _watchConnectionStatus() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.ui.setConnectionStatus(true);
      this.ui.showToast('✅ 인터넷 연결됨');
      this._startAutoSync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.ui.setConnectionStatus(false);
      this.ui.showToast('⚠️ 인터넷 연결 끊김');
      this._stopAutoSync();
    });
  }

  // ============ 자동 동기화 ============

  /**
   * 자동 동기화 시작
   */
  _startAutoSync() {
    if (this.syncTimer) return; // 이미 실행 중

    console.log('⏰ 자동 동기화 시작');

    this.syncTimer = setInterval(async () => {
      if (!this.isOnline) {
        console.warn('오프라인 상태: 동기화 스킵');
        return;
      }

      try {
        console.log('🔄 자동 동기화 중...');
        await this._loadInitialData();
        this._renderMainUI();
        console.log('✅ 자동 동기화 완료');
      } catch (err) {
        console.error('자동 동기화 실패:', err);
      }
    }, this.config.autoSyncInterval);
  }

  /**
   * 자동 동기화 중지
   */
  _stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('⏹️ 자동 동기화 중지');
    }
  }

  // ============ UI 렌더링 ============

  /**
   * 메인 UI 렌더링
   */
  _renderMainUI() {
    // 홈 페이지 렌더링
    const clients = this.clientService.getAllSync();
    this.ui.renderClientTable(clients);

    // 통계 업데이트
    this._updateDashboardStats();

    // 팔로업 렌더링
    const followups = this.followupService.getAllSync();
    this.ui.renderFollowupList(followups);
  }

  /**
   * 대시보드 통계 업데이트
   */
  _updateDashboardStats() {
    const total = this.clientService.getTotal();
    const referralRate = this.clientService.getReferralRate();
    const statsByPlan = this.clientService.getStatsByPlan();

    // KPI 카드 업데이트
    document.querySelectorAll('[data-stat]').forEach(el => {
      const stat = el.dataset.stat;
      let value = '-';

      if (stat === 'total') value = total;
      else if (stat === 'referral-rate') value = referralRate + '%';
      else if (stat === 'plan-pro') value = statsByPlan['Pro'] || 0;
      else if (stat === 'plan-basic') value = statsByPlan['Basic'] || 0;

      el.textContent = value;
    });
  }

  // ============ 이벤트 리스너 ============

  /**
   * 이벤트 리스너 등록
   */
  _attachEventListeners() {
    // 탭 전환
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const pageName = e.currentTarget.dataset.page;
        if (pageName) {
          this.ui.showPage(pageName);
        }
      });
    });

    // 모달 닫기 (Escape 키)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.ui.closeAllModals();
      }
    });

    // 모달 배경 클릭으로 닫기
    document.querySelectorAll('.ov').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('on');
        }
      });
    });

    // 새로고침 버튼
    document.querySelector('#refreshBtn')?.addEventListener('click', () => {
      this.refreshData();
    });

    // 로그아웃 버튼
    document.querySelector('#logoutBtn')?.addEventListener('click', () => {
      this.logout();
    });
  }

  // ============ 에러 처리 ============

  /**
   * 에러 화면 표시
   */
  _showErrorScreen(error) {
    const errorPage = document.getElementById('errorPage');
    if (errorPage) {
      errorPage.innerHTML = `
        <div style="text-align:center;padding:40px;">
          <h2>⚠️ 오류 발생</h2>
          <p>${this.ui._escapeHtml(error.message)}</p>
          <button class="btn pri" onclick="location.reload()">
            다시 시도
          </button>
        </div>
      `;
      this.ui.showPage('errorPage');
    }
  }

  // ============ 정리 ============

  /**
   * 앱 종료 시 정리
   */
  destroy() {
    this._stopAutoSync();
    clearInterval(this.healthCheckTimer);
    console.log('🛑 앱 종료');
  }
}

// ============ 전역 앱 인스턴스 ============

let app = null;

/**
 * 앱 시작 (DOM 로드 후)
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOM 로드 완료');
  
  app = new App();
  app.init();
});

/**
 * 창 닫기 시 정리
 */
window.addEventListener('beforeunload', () => {
  if (app) {
    app.destroy();
  }
});

// ============ 전역 헬퍼 함수들 (HTML에서 onclick으로 호출) ============

/**
 * 고객 행 클릭
 */
async function onClientRowClick(rowIdx) {
  if (!app || !app.clientService) return;

  const client = app.clientService.getById(rowIdx);
  if (client) {
    app.ui.renderClientDetail(client);
    app.ui.showPage('clientDetailPage');
  }
}

/**
 * 팔로업 클릭
 */
async function onFollowupClick(rowIdx) {
  if (!app) return;
  // 상세 페이지로 이동 또는 편집
}

/**
 * 고객 추가 모달 열기
 */
function openAddClientModal() {
  if (app) {
    app.ui.openModal('addClientModal');
  }
}

/**
 * 고객 추가 저장
 */
async function saveNewClient() {
  if (!app) return;

  try {
    const formData = new FormData(document.querySelector('#addClientForm'));
    const clientData = Object.fromEntries(formData);

    await app.clientService.create(clientData);
    app.ui.showToast('✅ 고객이 추가되었습니다');
    app.ui.closeModal('addClientModal');
    app.refreshData();

  } catch (err) {
    app.ui.showToast('❌ 오류: ' + err.message);
  }
}

// 유사하게 editClient(), deleteClient() 등을 구현...
// 전역 함수들 (HTML onclick에서 호출)
function signInClick() {
  console.log('Google 로그인 클릭');
  // 실제 Google 로그인은 나중에 구현
  alert('Google 로그인 기능은 준비 중입니다.');
}

function demoMode() {
  console.log('데모 모드 시작');
  alert('데모 모드는 준비 중입니다.');
}

function showPanel(panelId) {
  // 모든 패널 숨기기
  document.getElementById('lp_main').style.display = 'none';
  document.getElementById('lp_apply').style.display = 'none';
  document.getElementById('lp_applied').style.display = 'none';
  
  // 선택된 패널 보기
  document.getElementById(panelId).style.display = 'block';
}

function submitApply() {
  const name = document.getElementById('ap_name').value;
  const email = document.getElementById('ap_email').value;
  
  if (!name || !email) {
    alert('이름과 이메일을 입력하세요.');
    return;
  }
  
  document.getElementById('ap_name_confirm').textContent = name;
  document.getElementById('ap_email_confirm').textContent = email;
  showPanel('lp_applied');
}

function signOut() {
  console.log('로그아웃');
  location.reload();
}

function showTab(tabName, element) {
  // 모든 페이지 숨기기
  document.querySelectorAll('.pg').forEach(el => el.classList.remove('on'));
  // 모든 탭 비활성화
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('on'));
  
  // 선택된 것만 활성화
  document.getElementById('pg-' + tabName).classList.add('on');
  element.classList.add('on');
}

function openAddClientModal() {
  document.getElementById('addClientModal').classList.add('on');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('on');
}

function saveClient(event) {
  event.preventDefault();
  alert('고객 추가 기능은 준비 중입니다.');
  closeModal('addClientModal');
}

function filterClients() {
  console.log('고객 필터링');
}

function loadAll() {
  console.log('데이터 새로고침');
}

function openFeedback() {
  alert('피드백 기능은 준비 중입니다.');
}

function globalSearchFn() {
  console.log('전역 검색');
}

function closeGlobalSearch() {
  document.getElementById('gsResults').classList.remove('on');
}

function toggleNotif() {
  const panel = document.getElementById('notifPanel');
  panel.classList.toggle('on');
}

function clearNotifs() {
  console.log('알림 모두 읽음');
}

// ============ 전역 함수들 (HTML onclick에서 호출) ============

function signInClick() {
  google.accounts.id.initialize({
    client_id: '1064406898241-m6s99ikhrjivp1b4lk77ukfrpurldgo7.apps.googleusercontent.com',
    callback: handleCredentialResponse
  });
  
  google.accounts.id.renderButton(
    document.getElementById('signInBtn'),
    { theme: 'outline', size: 'large' }
  );
  
  google.accounts.id.prompt();
}

function handleCredentialResponse(response) {
  console.log('로그인 성공:', response);
  const token = response.credential;
  
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  
  const userData = JSON.parse(jsonPayload);
  console.log('사용자:', userData);
  
  alert('로그인 성공: ' + userData.name);
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
}

function demoMode() {
  console.log('데모 모드 시작');
  alert('데모 모드는 준비 중입니다.');
}

function showPanel(panelId) {
  document.getElementById('lp_main').style.display = 'none';
  document.getElementById('lp_apply').style.display = 'none';
  document.getElementById('lp_applied').style.display = 'none';
  document.getElementById(panelId).style.display = 'block';
}

function submitApply() {
  const name = document.getElementById('ap_name').value;
  const email = document.getElementById('ap_email').value;
  if (!name || !email) {
    alert('이름과 이메일을 입력하세요.');
    return;
  }
  document.getElementById('ap_name_confirm').textContent = name;
  showPanel('lp_applied');
}

function signOut() {
  location.reload();
}

function showTab(tabName, element) {
  document.querySelectorAll('.pg').forEach(el => el.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('on'));
  document.getElementById('pg-' + tabName).classList.add('on');
  element.classList.add('on');
}

function openAddClientModal() {
  document.getElementById('addClientModal').classList.add('on');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('on');
}

function saveClient(event) {
  event.preventDefault();
  alert('고객 추가 기능은 준비 중입니다.');
  closeModal('addClientModal');
}

function filterClients() {
  console.log('고객 필터링');
}

function loadAll() {
  console.log('데이터 새로고침');
}

function openFeedback() {
  alert('피드백 기능은 준비 중입니다.');
}

function globalSearchFn() {
  console.log('전역 검색');
}

function closeGlobalSearch() {
  const el = document.getElementById('gsResults');
  if (el) el.style.display = 'none';
}

function toggleNotif() {
  const panel = document.getElementById('notifPanel');
  if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function clearNotifs() {
  console.log('알림 모두 읽음');
}