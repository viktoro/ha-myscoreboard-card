class MyScoreboardCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  setConfig(config) {
    this._config = { ...config };
    // Normalize: migrate single entity -> entities array (deep copy to avoid frozen arrays)
    if (this._config.entity && !this._config.entities) {
      this._config.entities = [this._config.entity];
      delete this._config.entity;
    }
    this._config.entities = [...(this._config.entities || [])];
    this._render();
  }

  _getScoreboardEntities() {
    if (!this._hass) return [];
    return Object.keys(this._hass.states)
      .filter(e => e.startsWith('sensor.myscoreboard') || (this._hass.states[e].attributes && this._hass.states[e].attributes.league))
      .sort();
  }

  _render() {
    if (!this._hass) return;

    const allEntities = this._getScoreboardEntities();
    const selected = this._config.entities || [];
    const title = this._config.title || '';
    const showBroadcasts = this._config.show_broadcasts || false;

    const entityRows = selected.map((eid, idx) => `
      <div class="entity-row">
        <select data-idx="${idx}">
          <option value="">-- Select entity --</option>
          ${allEntities.map(e => `<option value="${e}" ${e === eid ? 'selected' : ''}>${this._hass.states[e].attributes.friendly_name || e}</option>`).join('')}
        </select>
        <button class="remove-btn" data-idx="${idx}" title="Remove">✕</button>
      </div>
    `).join('');

    this.shadowRoot.innerHTML = `
      <style>
        .editor { padding: 8px 0; }
        .row { display: flex; flex-direction: column; margin-bottom: 12px; }
        .row label { font-weight: 500; margin-bottom: 4px; font-size: 0.9em; }
        .row select, .row input[type="text"] { padding: 8px; border: 1px solid var(--divider-color, #ccc); border-radius: 4px; background: var(--card-background-color, #fff); color: var(--primary-text-color, #000); font-size: 0.95em; }
        .row-check { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .row-check label { font-weight: 500; font-size: 0.9em; }
        .entity-row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
        .entity-row select { flex: 1; padding: 8px; border: 1px solid var(--divider-color, #ccc); border-radius: 4px; background: var(--card-background-color, #fff); color: var(--primary-text-color, #000); font-size: 0.95em; }
        .remove-btn { border: none; background: none; color: var(--error-color, #db4437); cursor: pointer; font-size: 1.1em; padding: 4px 8px; border-radius: 4px; }
        .remove-btn:hover { background: rgba(219,68,55,0.1); }
        .add-btn { border: 1px solid var(--divider-color, #ccc); background: none; color: var(--primary-text-color, #000); cursor: pointer; padding: 6px 12px; border-radius: 4px; font-size: 0.9em; margin-top: 2px; }
        .add-btn:hover { background: var(--secondary-background-color, #f5f5f5); }
      </style>
      <div class="editor">
        <div class="row">
          <label>Entities</label>
          ${entityRows}
          <button class="add-btn" id="add-entity">+ Add league</button>
        </div>
        <div class="row">
          <label for="title">Title (optional)</label>
          <input id="title" type="text" value="${title}" placeholder="Auto from entity names" />
        </div>
        <div class="row-check">
          <input id="show_broadcasts" type="checkbox" ${showBroadcasts ? 'checked' : ''} />
          <label for="show_broadcasts">Show broadcast channels</label>
        </div>
      </div>
    `;

    // Entity select change
    this.shadowRoot.querySelectorAll('.entity-row select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        this._config.entities[idx] = e.target.value;
        this._fireChanged();
      });
    });

    // Remove buttons
    this.shadowRoot.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        this._config.entities.splice(idx, 1);
        this._fireChanged();
        this._render();
      });
    });

    // Add button
    this.shadowRoot.getElementById('add-entity').addEventListener('click', () => {
      this._config.entities.push('');
      this._fireChanged();
      this._render();
    });

    this.shadowRoot.getElementById('title').addEventListener('input', (e) => {
      if (e.target.value) {
        this._config.title = e.target.value;
      } else {
        delete this._config.title;
      }
      this._fireChanged();
    });

    this.shadowRoot.getElementById('show_broadcasts').addEventListener('change', (e) => {
      if (e.target.checked) {
        this._config.show_broadcasts = true;
      } else {
        delete this._config.show_broadcasts;
      }
      this._fireChanged();
    });
  }

  _fireChanged() {
    const config = { ...this._config };
    // Clean out empty entity strings
    config.entities = (config.entities || []).filter(e => e);
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config } }));
  }
}

customElements.define('myscoreboard-card-editor', MyScoreboardCardEditor);

class MyScoreboardCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static getConfigElement() {
    return document.createElement('myscoreboard-card-editor');
  }

  static getStubConfig() {
    return { entities: [], show_broadcasts: false };
  }

  _getEntities() {
    // Support both `entities: [...]` and legacy `entity: "..."
    if (this.config.entities && this.config.entities.length > 0) {
      return this.config.entities;
    }
    if (this.config.entity) {
      return [this.config.entity];
    }
    return [];
  }

  set hass(hass) {
    const entityIds = this._getEntities();
    const showBroadcasts = this.config.show_broadcasts || false;

    if (entityIds.length === 0) {
      this.shadowRoot.innerHTML = `<ha-card><div style="padding:16px;opacity:0.5">No entities configured</div></ha-card>`;
      return;
    }

    let html = `<style>${MyScoreboardCard.CSS}</style>`;
    html += `<ha-card>`;

    // Card-level title (if set, show once at top)
    if (this.config.title) {
      html += `<div class="msb-header"><span class="msb-title">${this.config.title}</span></div>`;
    }

    for (const entityId of entityIds) {
      const stateObj = hass.states[entityId];
      if (!stateObj) {
        html += `<div class="msb-section-header"><span class="msb-league">?</span></div>`;
        html += `<div class="msb-empty" style="color:var(--error-color)">Entity ${entityId} not found</div>`;
        continue;
      }

      const games = stateObj.attributes.games || [];
      const league = stateObj.attributes.league || '';
      const leagueLabel = stateObj.attributes.friendly_name || league;

      // Per-league header (always shown when multiple, or when no card title)
      if (entityIds.length > 1 || !this.config.title) {
        html += `<div class="msb-section-header"><span class="msb-league">${leagueLabel}</span></div>`;
      }

      if (games.length === 0) {
        html += `<div class="msb-empty">No games today</div>`;
      } else {
        html += `<table class="msb-table">`;
        for (const g of games) {
          html += this._renderGame(g, showBroadcasts);
        }
        html += `</table>`;
      }
    }

    html += `</ha-card>`;
    this.shadowRoot.innerHTML = html;
  }

  _formatLocalTime(isoDate) {
    if (!isoDate) return null;
    try {
      const d = new Date(isoDate);
      if (isNaN(d)) return null;
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      return null;
    }
  }

  _renderGame(g, showBroadcasts) {
    const stateClass = g.game_state === 1 ? 'live' : g.game_state === 2 ? 'final' : 'pre';
    const awayScore = g.away_score != null ? g.away_score : '';
    const homeScore = g.home_score != null ? g.home_score : '';
    const hasScores = g.game_state >= 1;

    // For pre-game, show local time from start_time if status is TBD/Scheduled
    let statusText = g.status || '';
    if (g.game_state === 0 && g.start_time) {
      const localTime = this._formatLocalTime(g.start_time);
      if (localTime && (statusText === 'TBD' || statusText === 'Scheduled')) {
        statusText = localTime;
      }
    }

    let html = `<tr class="msb-row msb-${stateClass}">`;
    html += `<td class="msb-logo-cell">${g.home_logo ? `<img class="msb-logo" src="${g.home_logo}" alt="" onerror="this.style.display='none'">` : ''}</td>`;
    html += `<td class="msb-abbr-cell">${g.home_abbr || ''}</td>`;
    html += `<td class="msb-score-cell${g.game_state === 2 && g.home_score > g.away_score ? ' msb-winner' : ''}">${hasScores ? homeScore : ''}</td>`;
    html += `<td class="msb-logo-cell">${g.away_logo ? `<img class="msb-logo" src="${g.away_logo}" alt="" onerror="this.style.display='none'">` : ''}</td>`;
    html += `<td class="msb-abbr-cell">${g.away_abbr || ''}</td>`;
    html += `<td class="msb-score-cell${g.game_state === 2 && g.away_score > g.home_score ? ' msb-winner' : ''}">${hasScores ? awayScore : ''}</td>`;
    html += `<td class="msb-info">`;
    if (showBroadcasts && g.broadcasts && g.broadcasts.length > 0) {
      html += `<span class="msb-broadcast">${g.broadcasts[0]}</span> `;
    }
    html += `<span class="msb-status msb-status-${stateClass}">${statusText}</span>`;
    html += `</td>`;
    html += `</tr>`;

    if (g.playoff_status) {
      html += `<tr class="msb-subrow"><td colspan="7" class="msb-playoff">${g.playoff_status}</td></tr>`;
    }

    return html;
  }

  setConfig(config) {
    this.config = config;
  }

  getCardSize() {
    if (!this.config) return 3;
    const entities = this.config.entities || (this.config.entity ? [this.config.entity] : []);
    return Math.max(2, entities.length * 3);
  }
}

MyScoreboardCard.CSS = `
  ha-card {
    overflow: hidden;
    padding: 0;
  }
  .msb-header {
    padding: 10px 16px 2px;
  }
  .msb-title {
    font-size: 1em;
    font-weight: bold;
  }
  .msb-section-header {
    padding: 8px 16px 4px;
  }
  .msb-league {
    display: inline-block;
    font-size: 0.85em;
    font-weight: bold;
    text-transform: uppercase;
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
    padding: 2px 8px;
    border-radius: 3px;
  }
  .msb-empty {
    padding: 6px 16px 10px;
    opacity: 0.5;
    font-size: 0.9em;
  }
  .msb-table {
    width: 100%;
    border-collapse: collapse;
    padding: 0 8px 8px;
  }
  .msb-row {
    height: 36px;
  }
  .msb-row td {
    padding: 4px 4px;
    white-space: nowrap;
    vertical-align: middle;
  }
  .msb-logo-cell {
    width: 22px;
    padding-left: 8px !important;
    padding-right: 2px !important;
  }
  .msb-logo {
    width: 22px;
    height: 22px;
    object-fit: contain;
    vertical-align: middle;
    display: block;
  }
  .msb-abbr-cell {
    font-weight: bold;
    font-size: 0.95em;
    padding-left: 4px !important;
    padding-right: 4px !important;
  }
  .msb-score-cell {
    font-weight: bold;
    font-size: 1.05em;
    text-align: center;
    min-width: 24px;
  }
  .msb-winner {
    color: var(--success-color, #4caf50);
  }
  .msb-info {
    text-align: right;
    padding-right: 12px !important;
    font-size: 0.85em;
  }
  .msb-broadcast {
    opacity: 0.5;
    font-size: 0.9em;
  }
  .msb-status-live {
    color: var(--error-color, #db4437);
    font-weight: 600;
  }
  .msb-status-pre {
    opacity: 0.7;
  }
  .msb-status-final {
    opacity: 0.5;
  }
  .msb-subrow td {
    padding: 0 12px 4px 40px;
    font-size: 0.75em;
    opacity: 0.5;
  }
  .msb-live {
    background: rgba(219, 68, 55, 0.08);
  }
`;

customElements.define('myscoreboard-card', MyScoreboardCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'myscoreboard-card',
  name: 'MyScoreboard Card',
  description: 'Displays live sports scores from ESPN',
});
