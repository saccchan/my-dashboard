const https = require('https');
const fs = require('fs');

const API_KEY = process.env.CHATWORK_API_KEY;
if (!API_KEY) {
  console.error('ERROR: CHATWORK_API_KEY is not set');
  process.exit(1);
}
console.log('API_KEY length:', API_KEY.length);

const ROOMS = {
  'ferret One 検証部屋': '285643264',
  '社内マーケティング': '59937652',
  'SBクリエイティブ様': '405463196',
  'Cursor勉強部屋': '402020025'
};

function cw(path) {
  return new Promise(function(resolve, reject) {
    var options = {
      hostname: 'api.chatwork.com',
      path: '/v2' + path,
      method: 'GET',
      headers: { 'X-ChatWorkToken': API_KEY }
    };
    var req = https.request(options, function(res) {
      var d = '';
      res.on('data', function(chunk) { d += chunk; });
      res.on('end', function() {
        console.log('  status:', res.statusCode, 'body length:', d.length);
        try {
          resolve(JSON.parse(d));
        } catch(e) {
          console.error('  JSON parse error, body:', d.substring(0, 100));
          resolve([]);
        }
      });
    });
    req.on('error', function(e) {
      console.error('  request error:', e.message);
      reject(e);
    });
    req.end();
  });
}

async function main() {
  var todos = [];
  var threads = [];
  var minutes = [];
  var roomNames = Object.keys(ROOMS);

  for (var i = 0; i < roomNames.length; i++) {
    var name = roomNames[i];
    var id = ROOMS[name];
    console.log('Processing room:', name, id);

    try {
      var tasks = await cw('/rooms/' + id + '/tasks?status=open');
      if (Array.isArray(tasks)) {
        for (var j = 0; j < Math.min(tasks.length, 10); j++) {
          todos.push({
            id: tasks[j].task_id,
            room_id: id,
            text: tasks[j].body,
            room: name,
            priority: 'normal',
            done: false
          });
        }
      }
    } catch(e) {
      console.error('tasks error:', name, e.message);
    }

    try {
      // Cursor勉強部屋は200件取得して過去のNotionリンクを全部拾う
      var limit = (id === '402020025') ? 200 : 30;
      var msgs = await cw('/rooms/' + id + '/messages?force=1&limit=' + limit);
      if (Array.isArray(msgs) && msgs.length > 0) {
        var recent = msgs.slice(-limit);

        if (id === '402020025') {
          var links = [];
          var seenUrls = {};
          for (var k = 0; k < recent.length; k++) {
            var m = recent[k];
            var matches = m.body.match(/https:\/\/www\.notion\.so\/[^\s)"<\]]+/g);
            if (matches) {
              for (var l = 0; l < matches.length; l++) {
                var url = matches[l].replace(/[.,;]+$/, '');
                if (!seenUrls[url]) {
                  seenUrls[url] = true;
                  links.push({
                    url: url,
                    sender: m.account.name,
                    date: new Date(m.send_time * 1000).toLocaleDateString('ja-JP'),
                    body: m.body.substring(0, 60).replace(/\n/g, ' ')
                  });
                }
              }
            }
          }
          if (links.length > 0) {
            minutes.push({
              id: Date.now(),
              room: name,
              links: links,
              date: new Date().toLocaleDateString('ja-JP'),
              title: 'Cursor勉強部屋 Notionリンク一覧',
              body: links.length + '件のNotionリンクが見つかりました',
              tags: ['Notion', '学習', 'Cursor']
            });
          }
        }

        var roomTasks = [];
        for (var n = 0; n < todos.length; n++) {
          if (todos[n].room_id === id) {
            roomTasks.push(todos[n].text.substring(0, 40));
          }
        }
        threads.push({
          id: parseInt(id),
          room: name,
          time: '更新: ' + new Date().toLocaleString('ja-JP'),
          summary: '最新' + recent.length + '件のメッセージ',
          decisions: [],
          tasks: roomTasks
        });
      }
    } catch(e) {
      console.error('msgs error:', name, e.message);
    }
  }

  var updatedAt = new Date().toLocaleString('ja-JP');
  var inject = '<script id="cw-data">' +
    'window.CW_TODOS=' + JSON.stringify(todos) + ';' +
    'window.CW_THREADS=' + JSON.stringify(threads) + ';' +
    'window.CW_MINUTES=' + JSON.stringify(minutes) + ';' +
    'window.CW_UPDATED="' + updatedAt + '";' +
    '<\/script>';
  var block = '<!-- CW_AUTO_START -->\n' + inject + '\n<!-- CW_AUTO_END -->';

  var html = fs.readFileSync('index.html', 'utf8');
  if (html.includes('<!-- CW_AUTO_START -->')) {
    html = html.replace(/<!-- CW_AUTO_START -->[\s\S]*?<!-- CW_AUTO_END -->/, block);
  } else {
    html = html.replace('</head>', block + '\n</head>');
  }
  fs.writeFileSync('index.html', html);
  console.log('Done! todos:' + todos.length + ' threads:' + threads.length + ' minutes:' + minutes.length);
}

main();
