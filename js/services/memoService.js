class MemoService {
  constructor(api) {
    this.api = api;
    this.memos = [];
    this.loaded = false;
  }

  async loadAll(clientName = null) {
    try {
      const result = await this.api.getMemos(clientName);
      this.memos = result.memos || [];
      this.loaded = true;
      return this.memos;
    } catch (err) {
      console.error('메모 로드 실패:', err);
      throw err;
    }
  }

  getAllSync() {
    return this.memos;
  }

  getByClient(clientName) {
    return this.memos.filter(m => m.clientName === clientName);
  }

  async create(clientName, memoType, memoText) {
    if (!clientName || !memoText) {
      throw new Error('고객명과 메모 내용은 필수입니다.');
    }

    try {
      const result = await this.api.addMemo(clientName, memoType, memoText);
      if (result.ok) {
        await this.loadAll();
        return true;
      }
      return false;
    } catch (err) {
      console.error('메모 추가 실패:', err);
      throw err;
    }
  }

  getStatsByType() {
    const stats = {};
    this.memos.forEach(memo => {
      const type = memo.memoType || '기타';
      stats[type] = (stats[type] || 0) + 1;
    });
    return stats;
  }

  getRecent(limit = 10) {
    return this.memos
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }
}