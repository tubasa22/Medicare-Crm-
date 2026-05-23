/**
 * js/app.js
 * 메인 앱 로직
 */

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
  
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  
  loadClientsData();
}

function demoMode() {
  console.log('데모 모드 시작');
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  loadClientsData();
}

async function loadClientsData() {
  try {
   const url = 'https://script.google.com/macros/d/AKfycbwgeemOwnUD4XGioeI6wWoXsMdH_17z9VReQn8As3nZ5flkHXQCy-MI6Vlx5p9dpmJdIg/usercontent?action=getClients';
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('고객 데이터:', data);
    
    if (data.ok && data.clients) {
      renderClientsTable(data.clients);
    } else {
      console.error('에러:', data.error);
    }
  } catch(err) {
    console.error('데이터 로드 실패:', err);
    alert('데이터 로드 실패: ' + err.message);
  }
}
function renderClientsTable(clients) {
  const tbody = document.getElementById('clientTable');
  if (!tbody) return;
  
  if (clients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999">고객 데이터가 없습니다</td></tr>';
    return;
  }
  
  tbody.innerHTML = clients.map(c => `
    <tr>
      <td>${c.name || '-'}</td>
      <td>${c.phone || '-'}</td>
      <td>${c.plan || '-'}</td>
      <td>${c.lastContact || '-'}</td>
      <td>
        <button onclick="alert('편집 기능 준비 중')" style="font-size:12px;padding:4px 8px;">편집</button>
      </td>
    </tr>
  `).join('');
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
  loadClientsData();
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