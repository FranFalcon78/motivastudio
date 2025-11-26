(function(global){
  'use strict';

  const STORAGE_KEY = 'memodance_state_v1';

  function todayIso(){
    const d = new Date();
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
  }

  function parseDate(str){
    if(!str) return null;
    const parts = str.split('-');
    if(parts.length !== 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if(isNaN(y) || isNaN(m) || isNaN(d)) return null;
    const dt = new Date(y, m, d);
    dt.setHours(0,0,0,0);
    return dt;
  }

  function isoFromDate(dateObj){
    if(!(dateObj instanceof Date)) return null;
    const d = new Date(dateObj.getTime());
    d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
  }

  function loadState(){
    try{
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if(!raw){
        return { items: [], last_opened: null, version: 1 };
      }
      const state = JSON.parse(raw);
      if(!Array.isArray(state.items)){
        state.items = [];
      }
      if(typeof state.last_opened !== 'string'){
        state.last_opened = null;
      }
      return state;
    }catch(e){
      console.error('Error cargando estado MemoDance:', e);
      return { items: [], last_opened: null, version: 1 };
    }
  }

  function saveState(state){
    try{
      const copy = Object.assign({}, state);
      copy.last_opened = todayIso();
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
    }catch(e){
      console.error('Error guardando estado MemoDance:', e);
    }
  }

  function ruleMatches(level, d){
    const day = d.getDate();
    switch(Number(level)){
      case 1: return true;
      case 2: return day % 3 === 0;
      case 3: return day % 5 === 0;
      case 4: return day === 10 || day === 20 || day === 30;
      case 5: return day === 30;
      case 6: return day === 31;
      default: return false;
    }
  }

  function previousDueDate(level, today){
    const probe = new Date(today.getTime());
    probe.setHours(0,0,0,0);
    for(let i = 0; i < 370; i++){
      if(ruleMatches(level, probe)){
        return new Date(probe.getTime());
      }
      probe.setDate(probe.getDate() - 1);
    }
    return new Date(today.getTime());
  }

  function nextDueDate(level, after){
    const probe = new Date(after.getTime());
    probe.setHours(0,0,0,0);
    probe.setDate(probe.getDate() + 1);
    for(let i = 0; i < 370; i++){
      if(ruleMatches(level, probe)){
        return new Date(probe.getTime());
      }
      probe.setDate(probe.getDate() + 1);
    }
    return new Date(after.getTime());
  }

  function sameDay(a, b){
    return a && b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function computePriorityFlags(state, today){
    const t = new Date(today.getTime());
    t.setHours(0,0,0,0);
    state.items.forEach(it => {
      const level = Number(it.level) || 1;
      const lastDone = parseDate(it.last_done);
      const lastDue = previousDueDate(level, t);
      if(lastDue && lastDue <= t){
        if(!lastDone || lastDone < lastDue){
          it.priority = lastDue < t;
        }else{
          it.priority = false;
        }
      }else{
        it.priority = false;
      }
    });
  }

  function itemsDueToday(state, today){
    const t = new Date(today.getTime());
    t.setHours(0,0,0,0);
    const due = [];
    state.items.forEach(it => {
      const level = Number(it.level) || 1;
      const lastDone = parseDate(it.last_done);
      const isDueToday = ruleMatches(level, t);
      if(isDueToday || it.priority){
        if(lastDone && sameDay(lastDone, t)){
          return;
        }
        due.push(it);
      }
    });
    due.sort((a, b) => {
      const pa = a.priority ? 0 : 1;
      const pb = b.priority ? 0 : 1;
      if(pa !== pb) return pa - pb;
      const la = Number(a.level) || 1;
      const lb = Number(b.level) || 1;
      if(la !== lb) return la - lb;
      const na = (a.name || '').toLowerCase();
      const nb = (b.name || '').toLowerCase();
      if(na < nb) return -1;
      if(na > nb) return 1;
      return 0;
    });
    return due;
  }

  function addItem(state, name, level, link, notes){
    const today = new Date();
    today.setHours(0,0,0,0);
    state.items.push({
      id: Date.now() + Math.floor(Math.random() * 100000),
      name: (name || '').trim(),
      level: Number(level) || 1,
      link: (link || '').trim(),
      last_done: null,
      created_at: isoFromDate(today),
      priority: false,
      notes: (notes || '').trim()
    });
    saveState(state);
  }

  function markDoneToday(state, id){
    const today = new Date();
    today.setHours(0,0,0,0);
    const iso = isoFromDate(today);
    state.items.forEach(it => {
      if(String(it.id) === String(id)){
        it.last_done = iso;
        it.priority = false;
      }
    });
    saveState(state);
  }

  function changeLevel(state, id, newLevel){
    state.items.forEach(it => {
      if(String(it.id) === String(id)){
        it.level = Number(newLevel) || 1;
      }
    });
    saveState(state);
  }

  function editLink(state, id, newLink){
    state.items.forEach(it => {
      if(String(it.id) === String(id)){
        it.link = (newLink || '').trim();
      }
    });
    saveState(state);
  }

  function editNotes(state, id, newNotes){
    state.items.forEach(it => {
      if(String(it.id) === String(id)){
        it.notes = (newNotes || '').trim();
      }
    });
    saveState(state);
  }

  function deleteItem(state, id){
    state.items = state.items.filter(it => String(it.id) !== String(id));
    saveState(state);
  }

  function formatDateISO(dateObj){
    return isoFromDate(dateObj);
  }

  const api = {
    todayIso,
    parseDate,
    isoFromDate,
    loadState,
    saveState,
    ruleMatches,
    previousDueDate,
    nextDueDate,
    computePriorityFlags,
    itemsDueToday,
    addItem,
    markDoneToday,
    changeLevel,
    editLink,
    editNotes,
    deleteItem,
    formatDateISO,
    STORAGE_KEY
  };

  global.MemoDance = api;

})(window);