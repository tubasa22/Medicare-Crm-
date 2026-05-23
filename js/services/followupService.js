class FollowupService {
  constructor(api, clientService) {
    this.api = api;
    this.clientService = clientService;
    this.followups = [];
    this.loaded = false;
  }

  async loadAll(daysOverdue = 30) {
    try {
      const clients = await this.clientService.loadAll();
      
      const now = new Date();
      this.followups = clients.filter(client => {
        if (!client.lastContact) return true;
        
        const lastDate = new Date(client.lastContact);
        const daysAgo = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
        
        return daysAgo >= daysOverdue;
      }).map(client => ({
        ...client,
        daysOverdue: this._getDaysOverdue(client.lastContact),
        priority: this._getPriority(client.lastContact, daysOverdue)
      }));

      this.loaded = true;
      return this.followups;
    } catch (err) {
      console.error('팔로업 목록 로드 실패:', err);
      throw err;
    }
  }

  getAllSync() {
    return this.followups;
  }

  getByPriority(priority) {
    return this.followups.filter(f => f.priority === priority);
  }

  async markAsCompleted(clientName, note = '') {
    try {
      const result = await this.clientService.update({
        name: clientName,
        lastContact: new Date().toISOString(),
        notes: note
      });

      if (result) {
        this.followups = this.followups.filter(f => f.name !== clientName);
        return true;
      }
      return false;
    } catch (err) {
      console.error('팔로업 완료 처리 실패:', err);
      throw err;
    }
  }

  getStats() {
    return {
      total: this.followups.length,
      urgent: this.followups.filter(f => f.priority === 'urgent').length,
      soon: this.followups.filter(f => f.priority === 'soon').length,
      fine: this.followups.filter(f => f.priority === 'fine').length
    };
  }

  _getDaysOverdue(lastContact) {
    if (!lastContact) return 999;
    
    const now = new Date();
    const lastDate = new Date(lastContact);
    const daysAgo = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
    
    return daysAgo;
  }

  _getPriority(lastContact, threshold = 30) {
    const daysAgo = this._getDaysOverdue(lastContact);
    
    if (daysAgo >= threshold * 2) return 'urgent';
    if (daysAgo >= threshold) return 'soon';
    return 'fine';
  }
}