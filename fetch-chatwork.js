const https = require('https');
const fs = require('fs');

const ROOMS = {
  'ferret One 検証部屋': '285643264',
  '社内マーケティング':   '59937652',
  'SBクリエイティブ様':   '405463196',
  'Cursor勉強部屋':       '402020025',
};

function cw(path) {
  return new Promise((res, rej) => {
    const req = https.request({
      hostname: 'api.chatwork.com',
      path: '/v2' + path,
      headers: { 'X-ChatWorkToken': process.env.CHATWORK_API_KEY }
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(JSON.parse(d)));
    });
    req.on('error', rej);
    req.end();
  });
}

(async () => {
  const todos = [];
  const threads = [];
  const minutes = [];

  for (const [name, id] of Object.entries(ROOMS)) {
    try {
      const tasks = await cw('/rooms/' + id + '/tasks?status=open');
      if (Array.isArray(tasks)) {
        for (const t of tasks.slice(0, 10)) {
          todos.push({ id: t.task_id, room_id: done: false });
        }
      }
    } catch(e) { console.error('tasks error:', name, e.message); }

    try {
      const msgs = await cw('/rooms/' + id + '/messages?force=1');
      if (Array.isArray(msgs) && msgs.length > 0) {
        const recent = msgs.slice(-30);

        if (id === '402020025') {
          const links = [];
          for (const m of recent) {
            const matches = m.body.match(/https:\/\/www\.notion\.so\/[^\s\)"]+/g);
            if (matches) {
              for (const url of matches) {
                links.push({ url, sender: m.account.name, date: new Date(m.send_time*1000).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo'}) });
              }
            }
          }
          if (links.length > 0) {
            minutes.push({ id: Date.now(), room: name, links, date: new Date().toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo'}), title: 'Cursor勉強部屋 学習リンク', body: links.length + '件のNotionリンクが共有されています', tags: ['Notion','学習']           id: parseInt(id),
          room: name,
          time: '更新: ' + new Date().toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'}),
          summary: '最新' + recent.length + '件のメッセージ',
          decisions: [],
          tasks: todos.filter(t => t.room_id === id).map(t => t.text.substring(0,40))
        });
      }
    } catch(e) { console.error('msgs error:', name, e.message); }
  }

  const updatedAt = new Date().toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'});
  const block = '<!-- CW_AUTO_START -->\n<script id="cw-data">\nwindow.CW_TODOS=' + JSON.stringify(todos) + ';\nwindow.CW_THREADS=' + JSON.stringify(threads) + ';\nwindow.CW_MINUTES=' + JSON.stringify(minutes) + ';\nwindow.CW_UPDATED="' + updatedAt + '";\n<\/script>\n<!-- CW_AUTO_END -->';

  let html = fs.readFileSync('index.html', 'utf8');
  if (html.includes('<!-- CW_AUTO_START -->')) {
    html = html.replace(/<!-- CW_AUTO_START -->[\s\S]*?<!-- CW_AUTO_END -->/, block);
  } else {
    html = html.replace('</head>', block fs.writeFileSync('index.html', html);
  console.log('Done! todos:' + todos.length + ' threads:' + threads.length + ' minutes:' + minutes.length);
})();
