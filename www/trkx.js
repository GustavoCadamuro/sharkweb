/* Shark Lab: gasto de anuncios (TikTok, Taboola, Google) e vendas por webhook. Usado no computador e no celular. */
(function (g) {
  function SLX(jf, opt) {
    const FB = (opt && opt.fb) || 'https://graph.facebook.com';
    const num = v => { const n = +v; return isFinite(n) ? n : 0 };
    const day = s => String(s || '').slice(0, 10);
    async function tiktokRows(tt, from, to) {
      const out = [], adv = String(tt.adv || '').replace(/\D/g, '');
      for (let page = 1; page <= 30; page++) {
        const q = new URLSearchParams({ advertiser_id: adv, report_type: 'BASIC', data_level: 'AUCTION_CAMPAIGN', dimensions: JSON.stringify(['campaign_id', 'stat_time_day']), metrics: JSON.stringify(['campaign_name', 'spend', 'impressions', 'clicks']), start_date: from, end_date: to, page_size: '1000', page: String(page) });
        const j = await jf('https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?' + q, { headers: { 'Access-Token': String(tt.tok || '').trim() } });
        if (j && j.code && j.code !== 0) { const e = new Error(j.message || ('código ' + j.code)); e.status = 401; throw e }
        const d = (j && j.data) || {};
        for (const r of d.list || []) { const m = r.metrics || {}, di = r.dimensions || {}; out.push({ date: day(di.stat_time_day), cid: String(di.campaign_id), name: m.campaign_name || ('Campanha ' + di.campaign_id), spend: num(m.spend), imps: num(m.impressions), clicks: num(m.clicks), cur: 'BRL', plat: 'tt' }) }
        const tp = (d.page_info && d.page_info.total_page) || 1; if (page >= tp) break;
      }
      return out;
    }
    async function taboolaRows(tb, from, to) {
      const t = await jf('https://backstage.taboola.com/backstage/oauth/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: String(tb.id || '').trim(), client_secret: String(tb.sec || '').trim(), grant_type: 'client_credentials' }).toString() });
      const acct = encodeURIComponent(String(tb.acct || '').trim());
      const j = await jf('https://backstage.taboola.com/backstage/api/1.0/' + acct + '/reports/campaign-summary/dimensions/campaign_day_breakdown?start_date=' + from + '&end_date=' + to, { headers: { Authorization: 'Bearer ' + t.access_token } });
      return (j.results || []).map(r => ({ date: day(r.date), cid: String(r.campaign), name: r.campaign_name || ('Campanha ' + r.campaign), spend: num(r.spent), imps: num(r.impressions), clicks: num(r.clicks), cur: r.currency || 'BRL', plat: 'tb' }));
    }
    async function googleRows(gg, from, to) {
      const t = await jf('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: String(gg.id || '').trim(), client_secret: String(gg.sec || '').trim(), refresh_token: String(gg.rt || '').trim(), grant_type: 'refresh_token' }).toString() });
      const cid = String(gg.cust || '').replace(/\D/g, ''), ver = String(gg.ver || 'v21').trim() || 'v21', out = [];
      const H = { Authorization: 'Bearer ' + t.access_token, 'developer-token': String(gg.dev || '').trim(), 'content-type': 'application/json' };
      if (gg.login) H['login-customer-id'] = String(gg.login).replace(/\D/g, '');
      let pt = '';
      for (let i = 0; i < 40; i++) {
        const body = { query: "SELECT campaign.id, campaign.name, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks FROM campaign WHERE segments.date BETWEEN '" + from + "' AND '" + to + "'", pageSize: 10000 }; if (pt) body.pageToken = pt;
        const j = await jf('https://googleads.googleapis.com/' + ver + '/customers/' + cid + '/googleAds:search', { method: 'POST', headers: H, body: JSON.stringify(body) });
        for (const r of j.results || []) { const m = r.metrics || {}; out.push({ date: day(r.segments && r.segments.date), cid: String(r.campaign.id), name: r.campaign.name, spend: num(m.costMicros) / 1e6, imps: num(m.impressions), clicks: num(m.clicks), cur: 'BRL', plat: 'gg' }) }
        pt = j.nextPageToken || ''; if (!pt) break;
      }
      return out;
    }
    async function trkReport(trk, from, to) {
      const u = (/^http:\/\//i.test(String(trk.dom)) ? 'http://' : 'https://') + String(trk.dom).replace(/^https?:\/\//, '').replace(/\/+$/, '') + '/_slt/r.php?t=' + encodeURIComponent(trk.tok) + '&from=' + from + '&to=' + to;
      const j = await jf(u);
      if (!j || !j.ok) throw new Error('O servidor de rastreamento não respondeu. Instale de novo em Configurações.');
      return j;
    }
    /* Meta: conjuntos e anuncios (gasto), lista de campanhas com status/orcamento, e alteracao */
    async function metaRows(tok, acct, from, to, ver, level) {
      const id = String(acct).replace(/\D/g, ''), L = level == 's' ? 'adset' : level == 'a' ? 'ad' : 'campaign';
      const f = { campaign: 'campaign_id,campaign_name', adset: 'adset_id,adset_name,campaign_id', ad: 'ad_id,ad_name,adset_id,campaign_id' }[L] + ',spend,impressions,clicks,inline_link_clicks,account_currency';
      const q = new URLSearchParams({ level: L, fields: f, time_range: JSON.stringify({ since: from, until: to }), time_increment: '1', limit: '500', access_token: tok });
      let url = FB + '/' + (ver ? ver + '/' : '') + 'act_' + id + '/insights?' + q, pages = 0; const out = [];
      while (url && pages++ < 100) {
        const j = await jf(url);
        for (const r of j.data || []) out.push({ date: r.date_start, cid: r[L + '_id'], name: r[L + '_name'], spend: num(r.spend), imps: num(r.impressions), clicks: num(r.inline_link_clicks || r.clicks), cur: r.account_currency || '', plat: 'fb', acc: id, par: r.campaign_id || '' });
        url = (j.paging && j.paging.next) || null;
      }
      return out;
    }
    async function metaList(tok, acct, ver, level) {
      const id = String(acct).replace(/\D/g, ''), E = level == 's' ? 'adsets' : level == 'a' ? 'ads' : 'campaigns';
      const q = new URLSearchParams({ fields: 'id,name,status,effective_status' + (level == 'a' ? '' : ',daily_budget,lifetime_budget'), limit: '500', access_token: tok });
      let url = FB + '/' + (ver ? ver + '/' : '') + 'act_' + id + '/' + E + '?' + q, pages = 0; const out = {};
      while (url && pages++ < 60) {
        const j = await jf(url);
        for (const r of j.data || []) out[r.id] = { st: r.status, eff: r.effective_status, db: r.daily_budget ? num(r.daily_budget) / 100 : 0, lb: r.lifetime_budget ? num(r.lifetime_budget) / 100 : 0 };
        url = (j.paging && j.paging.next) || null;
      }
      return out;
    }
    async function metaSet(tok, ver, id, ch) {
      const b = new URLSearchParams({ access_token: tok });
      if (ch.status) b.set('status', ch.status);
      if (ch.daily != null) b.set('daily_budget', String(Math.round(ch.daily * 100)));
      const j = await jf(FB + '/' + (ver ? ver + '/' : '') + encodeURIComponent(id), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: b.toString() });
      return !!(j && (j.success || j.id));
    }
    return { tiktokRows, taboolaRows, googleRows, trkReport, metaRows, metaList, metaSet };
  }
  if (typeof module != 'undefined' && module.exports) module.exports = SLX; else g.SLX = SLX;
})(typeof window != 'undefined' ? window : globalThis);
