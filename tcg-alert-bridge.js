// TCG shared alert bridge for TEAMAPP / SOP Wizard / BOMAPP integration.
// Include this script in apps hosted under the same domain to read/write the same local alert queue.
(function(){
  const ALERT_KEY = 'tcg-internal-alerts-v1';
  window.TCGInternalAlerts = {
    key: ALERT_KEY,
    get(){
      try { return JSON.parse(localStorage.getItem(ALERT_KEY) || '[]'); } catch(e){ return []; }
    },
    set(alerts){ localStorage.setItem(ALERT_KEY, JSON.stringify(alerts || [])); },
    add(alert){ const alerts=this.get(); alerts.unshift({...alert, id: alert.id || ('alert-' + Date.now()), createdAt: alert.createdAt || new Date().toISOString()}); this.set(alerts); return alerts[0]; },
    count(filter){ return this.get().filter(a => !filter || filter(a)).length; },
    close(id){ const alerts=this.get(); const a=alerts.find(x=>x.id===id); if(a){ a.status='closed'; a.closedAt=new Date().toISOString(); this.set(alerts); } }
  };
})();
