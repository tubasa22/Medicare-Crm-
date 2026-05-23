/**
 * js/ui/renderer.js
 * 
 * 목적: 모든 HTML 렌더링과 DOM 조작을 한곳에서 관리
 * 
 * 현재 문제점:
 * - HTML 생성 코드가 여러 함수에 흩어져있음
 * - 같은 UI를 여러 곳에서 다르게 생성
 * - 페이지 전환 로직이 명확하지 않음
 * 
 * 개선점:
 * - render*() 메서드들로 통합
 * - 일관된 마크업 생성
 * - 재사용 가능한 HTML 생성 함수들
 */

class UIRenderer {
  constructor() {
    this.currentPage = 'clientListPage';
  }

  // ============ 페이지 전환 ============

  /**
   * 특정 페이지로 이동
   * @param {string} pageName - 페이지 ID
   */
  showPage(pageName) {
    // 기존 페이지 숨김
    document.querySelectorAll('.pg').forEach(page => {
      page.classList.remove('on');
    });

    // 새 페이지 표시
    const newPage = document.getElementById(pageName);
    if (newPage) {
      newPage.classList.add('on');
    }

    // 탭 활성화
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.remove('on');
    });
    document.querySelector(`[data-page="${pageName}"]`)?.classList.add('on');

    this.currentPage = pageName;
    console.log(`📄 페이지 전환: ${pageName}`);
  }

  // ============ 테이블 렌더링 ============

  /**
   * 고객 목록 테이블 렌더링
   * @param {Array} clients - 고객 배열
   * @param {Function} onRowClick - 행 클릭 핸들러
   */
  renderClientTable(clients, onRowClick) {
    const tbody = document.querySelector('#clientTable tbody');
    
    if (!tbody) {
      console.warn('❌ #clientTable tbody 요소를 찾을 수 없습니다');
      return;
    }

    // 빈 경우
    if (!clients || clients.length === 0) {
      tbody.innerHTML = `
        <tr class="empty">
          <td colspan="5">등록된 고객이 없습니다</td>
        </tr>
      `;
      return;
    }

    // 테이블 행 렌더링
    tbody.innerHTML = clients.map(client => `
      <tr class="click" data-row-idx="${client.rowIdx}" onclick="onClientRowClick(${client.rowIdx})">
        <td>${client.no}</td>
        <td class="nc">
          <div class="av" style="background:var(--blue)">${this._getInitials(client.name)}</div>
          ${client.name}
        </td>
        <td>${client.phone}</td>
        <td>
          <span class="badge bgr">${client.plan || '-'}</span>
        </td>
        <td>${this._formatDate(client.next)}</td>
      </tr>
    `).join('');

    console.log(`✅ 테이블 렌더링: ${clients.length}명`);
  }

  /**
   * 메모 목록 렌더링
   */
  renderMemoList(memos, clientName = null) {
    const container = document.querySelector('#memoContainer');
    
    if (!container) {
      console.warn('❌ #memoContainer 요소를 찾을 수 없습니다');
      return;
    }

    if (!memos || memos.length === 0) {
      container.innerHTML = '<p style="color:var(--text3); padding:20px;">등록된 메모가 없습니다</p>';
      return;
    }

    container.innerHTML = memos.map(memo => `
      <div class="mi">
        <div class="mi-d">${memo.type} • ${this._formatDate(memo.date)}</div>
        <div class="mi-t">${this._escapeHtml(memo.text)}</div>
      </div>
    `).join('');

    console.log(`✅ 메모 렌더링: ${memos.length}개`);
  }

  /**
   * 팔로업 목록 렌더링
   */
  renderFollowupList(followups) {
    const container = document.querySelector('#followupContainer');
    
    if (!container) {
      console.warn('❌ #followupContainer 요소를 찾을 수 없습니다');
      return;
    }

    if (!followups || followups.length === 0) {
      container.innerHTML = '<p style="color:var(--text3); padding:20px;">팔로업 대상이 없습니다</p>';
      return;
    }

    container.innerHTML = followups.map(fu => {
      const daysUntil = this._getDaysUntil(fu.nextDate);
      let urgency = 'fine'; // 기본값
      let urgencyText = '예정된';

      if (daysUntil < 0) {
        urgency = 'urgent';
        urgencyText = '긴급';
      } else if (daysUntil <= 3) {
        urgency = 'soon';
        urgencyText = '곧';
      }

      return `
        <div class="fu">
          <div class="fu-bar ${urgency}"></div>
          <div class="fu-meta" onclick="onFollowupClick(${fu.rowIdx})">
            <div class="fu-name">${this._escapeHtml(fu.name)}</div>
            <div class="fu-sub">${this._escapeHtml(fu.memo || 'メモなし')}</div>
          </div>
          <div class="fu-acts">
            <button class="ib" title="완료" onclick="markFollowupDone(${fu.rowIdx})">✓</button>
            <button class="ib" title="편집" onclick="editFollowup(${fu.rowIdx})">✎</button>
            <button class="ib del" title="삭제" onclick="deleteFollowup(${fu.rowIdx})">✕</button>
          </div>
          <div class="fu-dd">${urgencyText}</div>
        </div>
      `;
    }).join('');

    console.log(`✅ 팔로업 렌더링: ${followups.length}개`);
  }

  // ============ 고객 상세 페이지 ============

  /**
   * 고객 상세 정보 렌더링
   */
  renderClientDetail(client) {
    if (!client) {
      console.warn('❌ 고객 정보가 없습니다');
      return;
    }

    // 헤더
    const headerHtml = `
      <div class="dh">
        <div class="dh-av" style="background:var(--blue)">${this._getInitials(client.name)}</div>
        <div class="dh-info">
          <h2>${this._escapeHtml(client.name)}</h2>
          <p>${this._escapeHtml(client.biz || '직책 미정')}</p>
        </div>
        <div class="dh-right">
          <button class="btn pri" onclick="editClient(${client.rowIdx})">
            <i class="ti ti-edit"></i> 수정
          </button>
          <button class="btn red" onclick="deleteClient(${client.rowIdx})">
            <i class="ti ti-trash"></i> 삭제
          </button>
        </div>
      </div>
    `;

    // 기본 정보 카드들
    const infoHtml = `
      <div class="dc">
        <h4>연락처</h4>
        <div class="dr">
          <span class="dr-l">전화</span>
          <span class="dr-v">${this._escapeHtml(client.phone)}</span>
        </div>
        <div class="dr">
          <span class="dr-l">이메일</span>
          <span class="dr-v">${this._escapeHtml(client.email || '-')}</span>
        </div>
      </div>

      <div class="dc">
        <h4>상품 정보</h4>
        <div class="dr">
          <span class="dr-l">플랜</span>
          <span class="dr-v">${this._escapeHtml(client.plan || '-')}</span>
        </div>
        <div class="dr">
          <span class="dr-l">가입 상품</span>
          <span class="dr-v">${this._escapeHtml(client.prod || '-')}</span>
        </div>
      </div>

      <div class="dc">
        <h4>다음 연락</h4>
        <div class="dr">
          <span class="dr-l">예정일</span>
          <span class="dr-v">${this._formatDate(client.next)}</span>
        </div>
        <div class="dr">
          <span class="dr-l">에이전트 리퍼</span>
          <span class="dr-v">
            <span class="badge ${client.ref === 'TRUE' ? 'bgr' : 'bgy'}">
              ${client.ref === 'TRUE' ? '예' : '아니오'}
            </span>
          </span>
        </div>
      </div>

      <div class="dc full">
        <h4>메모</h4>
        <div class="dr" style="border:none;padding:0;">
          <span class="dr-v" style="text-align:left;">
            ${this._escapeHtml(client.memo || '메모 없음')}
          </span>
        </div>
      </div>
    `;

    // DOM 업데이트
    const detailPage = document.getElementById('clientDetailPage');
    if (detailPage) {
      detailPage.innerHTML = headerHtml + '<div class="dgrid">' + infoHtml + '</div>';
    }

    console.log(`✅ 고객 상세 페이지 렌더링: ${client.name}`);
  }

  // ============ 모달 제어 ============

  /**
   * 모달 열기
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('on');
      console.log(`📂 모달 열음: ${modalId}`);
    }
  }

  /**
   * 모달 닫기
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('on');
      console.log(`📁 모달 닫음: ${modalId}`);
    }
  }

  /**
   * 모든 모달 닫기
   */
  closeAllModals() {
    document.querySelectorAll('.ov.on').forEach(modal => {
      modal.classList.remove('on');
    });
  }

  // ============ 알림 ============

  /**
   * 토스트 알림 표시
   * @param {string} message - 메시지
   * @param {number} duration - 지속 시간 (ms)
   */
  showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    
    if (!toast) {
      console.warn('❌ #toast 요소를 찾을 수 없습니다');
      return;
    }

    toast.textContent = message;
    toast.classList.add('on');

    setTimeout(() => {
      toast.classList.remove('on');
    }, duration);

    console.log(`🔔 토스트: ${message}`);
  }

  /**
   * 로딩 표시
   */
  showLoading(show = true) {
    const spinner = document.querySelector('.spin');
    if (spinner) {
      spinner.parentElement.style.display = show ? 'block' : 'none';
    }
  }

  // ============ 상태 표시 ============

  /**
   * 연결 상태 표시
   */
  setConnectionStatus(isConnected) {
    const pill = document.querySelector('#connectionStatus');
    
    if (pill) {
      if (isConnected) {
        pill.className = 'pill ok';
        pill.innerHTML = '<div class="dot ok"></div> 연결됨';
      } else {
        pill.className = 'pill err';
        pill.innerHTML = '<div class="dot err"></div> 연결 끊김';
      }
    }
  }

  /**
   * 사용자 정보 표시
   */
  setUserInfo(user) {
    const logo = document.querySelector('.logo');
    const userElement = document.querySelector('#userInfo');

    if (logo) {
      logo.textContent = 'FinCRM';
    }

    if (userElement && user) {
      userElement.innerHTML = `
        <img class="user-av" src="${user.photoUrl}" alt="${user.name}">
        <span>${user.name}</span>
      `;
    }
  }

  // ============ 유틸리티 ============

  /**
   * 날짜 포맷팅 (YYYY-MM-DD)
   */
  _formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date)) return '-';
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return '-';
    }
  }

  /**
   * 이름에서 이니셜 추출
   */
  _getInitials(name) {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  /**
   * HTML 이스케이프 (XSS 방지)
   */
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * D-Day 계산
   */
  _getDaysUntil(dateStr) {
    if (!dateStr) return Infinity;
    const targetDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = targetDate - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * 숫자 포맷팅 (1,000 형식)
   */
  formatNumber(num) {
    return Number(num).toLocaleString('ko-KR');
  }
}

// ============ 사용 예시 ============

/*
// 1. 초기화
const ui = new UIRenderer();

// 2. 페이지 전환
ui.showPage('clientListPage');

// 3. 테이블 렌더링
ui.renderClientTable(clients, (rowIdx) => {
  console.log('클릭됨:', rowIdx);
});

// 4. 상세 페이지
ui.renderClientDetail(selectedClient);

// 5. 모달
ui.openModal('addClientModal');
// ... 사용자 입력 후
ui.closeModal('addClientModal');

// 6. 알림
ui.showToast('✅ 고객이 추가되었습니다');

// 7. 상태
ui.setConnectionStatus(true);
ui.setUserInfo({
  name: 'John Doe',
  photoUrl: 'https://...'
});
*/
