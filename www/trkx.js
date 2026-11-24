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
    const act = (a, names) => { if (!Array.isArray(a)) return 0; for (const n of names) for (const x of a) if (x && x.action_type === n) return num(x.value); return 0; };
    async function metaRows(tok, acct, from, to, ver, level) {
      const id = String(acct).replace(/\D/g, ''), L = level == 's' ? 'adset' : level == 'a' ? 'ad' : 'campaign';
      const f = { campaign: 'campaign_id,campaign_name', adset: 'adset_id,adset_name,campaign_id', ad: 'ad_id,ad_name,adset_id,campaign_id' }[L] + ',spend,impressions,clicks,inline_link_clicks,actions,account_currency';
      const q = new URLSearchParams({ level: L, fields: f, time_range: JSON.stringify({ since: from, until: to }), time_increment: '1', limit: '500', access_token: tok });
      let url = FB + '/' + (ver ? ver + '/' : '') + 'act_' + id + '/insights?' + q, pages = 0; const out = [];
      while (url && pages++ < 100) {
        const j = await jf(url);
        for (const r of j.data || []) out.push({ date: r.date_start, cid: r[L + '_id'], name: r[L + '_name'], spend: num(r.spend), imps: num(r.impressions), clicks: num(r.inline_link_clicks || r.clicks), ic: act(r.actions, ['omni_initiated_checkout', 'initiate_checkout', 'offsite_conversion.fb_pixel_initiate_checkout']), lpv: act(r.actions, ['landing_page_view', 'omni_landing_page_view']), cur: r.account_currency || '', plat: 'fb', acc: id, par: r.campaign_id || '' });
        url = (j.paging && j.paging.next) || null;
      }
      return out;
    }
    const issTxt = r => { try { const a = Array.isArray(r.issues_info) ? r.issues_info : []; const t = []; for (const x of a) { const s = String((x && (x.error_summary || x.error_message)) || '').trim(); if (s && !t.includes(s)) t.push(s) } return t.join(' · ').slice(0, 240) } catch (e) { return '' } };
    async function metaList(tok, acct, ver, level) {
      const id = String(acct).replace(/\D/g, ''), E = level == 's' ? 'adsets' : level == 'a' ? 'ads' : 'campaigns';
      const mk = wi => new URLSearchParams({ fields: 'id,name,status,effective_status,created_time' + (level == 'c' ? '' : level == 's' ? ',campaign_id' : ',adset_id') + (level == 'a' ? '' : ',daily_budget,lifetime_budget') + (wi ? ',issues_info' : ''), limit: '500', access_token: tok });
      const run = async wi => {
        let url = FB + '/' + (ver ? ver + '/' : '') + 'act_' + id + '/' + E + '?' + mk(wi), pages = 0; const out = {};
        while (url && pages++ < 60) {
          const j = await jf(url);
          for (const r of j.data || []) out[r.id] = { ct: r.created_time || '', name: r.name || '', par: r.campaign_id || r.adset_id || '', st: r.status, eff: r.effective_status, db: r.daily_budget ? num(r.daily_budget) / 100 : 0, lb: r.lifetime_budget ? num(r.lifetime_budget) / 100 : 0, iss: issTxt(r) };
          url = (j.paging && j.paging.next) || null;
        }
        return out;
      };
      try { return await run(true) } catch (e) { return await run(false) }
    }
    async function metaSet(tok, ver, id, ch) {
      const b = new URLSearchParams({ access_token: tok });
      if (ch.status) b.set('status', ch.status);
      if (ch.daily != null) b.set('daily_budget', String(Math.round(ch.daily * 100)));
      const j = await jf(FB + '/' + (ver ? ver + '/' : '') + encodeURIComponent(id), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: b.toString() });
      return !!(j && (j.success || j.id));
    }
    async function metaCopy(tok, ver, id, level) {
      const b = new URLSearchParams({ access_token: tok, status_option: 'PAUSED' });
      if (level != 'a') b.set('deep_copy', 'true');
      const j = await jf(FB + '/' + (ver ? ver + '/' : '') + encodeURIComponent(id) + '/copies', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: b.toString() });
      return (j && (j.copied_campaign_id || j.copied_adset_id || j.copied_ad_id || j.id || (j.success && 'ok'))) || '';
    }
    /* Meta: alcance e frequencia do periodo inteiro (nao da pra somar dia a dia) */
    async function metaReach(tok, acct, from, to, ver, level) {
      const id = String(acct).replace(/\D/g, ''), L = level == 's' ? 'adset' : level == 'a' ? 'ad' : 'campaign';
      const q = new URLSearchParams({ level: L, fields: L + '_id,reach,frequency', time_range: JSON.stringify({ since: from, until: to }), limit: '500', access_token: tok });
      let url = FB + '/' + (ver ? ver + '/' : '') + 'act_' + id + '/insights?' + q, pages = 0; const out = {};
      while (url && pages++ < 60) {
        const j = await jf(url);
        for (const r of j.data || []) out[r[L + '_id']] = { reach: num(r.reach), freq: num(r.frequency) };
        url = (j.paging && j.paging.next) || null;
      }
      return out;
    }
    /* Meta: status de itens que nao vieram na lista (arquivados, excluidos) */
    async function metaInfo(tok, ver, ids) {
      const out = {}, list = (ids || []).filter(x => /^\d{5,25}$/.test(String(x))).slice(0, 40);
      const fields = 'id,name,status,effective_status,created_time,campaign_id,adset_id,daily_budget,lifetime_budget';
      let i = 0;
      const get = async id => { try { return await jf(FB + '/' + (ver ? ver + '/' : '') + id + '?' + new URLSearchParams({ fields: fields + ',issues_info', access_token: tok })) } catch (e) { return await jf(FB + '/' + (ver ? ver + '/' : '') + id + '?' + new URLSearchParams({ fields, access_token: tok })) } };
      const run = async () => { while (i < list.length) { const id = list[i++]; try { const r = await get(id); if (r && r.id) out[r.id] = { iss: issTxt(r),  ct: r.created_time || '', name: r.name || '', par: r.campaign_id || r.adset_id || '', st: r.status, eff: r.effective_status, db: r.daily_budget ? num(r.daily_budget) / 100 : 0, lb: r.lifetime_budget ? num(r.lifetime_budget) / 100 : 0 }; } catch (e) { } } };
      await Promise.all([run(), run(), run(), run()]);
      return out;
    }
    return { tiktokRows, taboolaRows, googleRows, trkReport, metaRows, metaList, metaSet, metaCopy, metaReach, metaInfo };
  }
  if (typeof module != 'undefined' && module.exports) module.exports = SLX; else g.SLX = SLX;
})(typeof window != 'undefined' ? window : globalThis);
