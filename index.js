var request = require('request');
var Twit = require('twit');
var T = new Twit(require('./config.js'));
var wordfilter = require('wordfilter');
var ent = require('ent');
var rita = require('rita');
var lexicon = new rita.RiLexicon();
var r = rita.RiTa;
let W = 3300, H = 2550;
var Canvas = require('canvas')
  , Image = Canvas.Image
  , canvas = new Canvas(W,H)
  , ctx = canvas.getContext('2d');
var fs = require('fs');

Array.prototype.pick = function() {
  return this[Math.floor(Math.random()*this.length)];
};

Array.prototype.pickRemove = function() {
  var index = Math.floor(Math.random()*this.length);
  return this.splice(index,1)[0];
};

function generate() { return new Promise((resolve, reject) => {
  var term = r.randomWord('nn').substr(0,3);
  console.log(term);
  var url = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=allcategories&acprefix=${term}&acmin=16&acprop=size&aclimit=500`;
  request(url, (err, resp, body) => {
    let result = JSON.parse(body).query.allcategories;
    result = result.filter(el => {
      let title = el['*'];
      let pos = r.getPosTags(title);
      let hasBannedWord = title.includes(' of ') || title.includes(' by ') || title.includes (' articles') || title.includes(' lists') || title.includes('List');
      return (el.pages >= 16) && ((pos.includes('nns')) || pos[0] === 'nnps') && !hasBannedWord;
    });
    result = result.pick();
    var category = result['*'];
    console.log(category)
    var url2 = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=categorymembers&cmtitle=${'Category:'+category}&cmnamespace=0&cmlimit=500`;
    console.log(url2);
    request(url2, (err, resp, body) => {
      let result = JSON.parse(body).query.categorymembers;
      result = result.map(el => el.title.replace(/\s\(.*/,''));

      // pick 16 results
      let results = [];
      for (var i=0; i<16; i++) {
        results.push(result.pickRemove());
      }
      console.log(results, results.length);
      if (results.includes(undefined)) {
        console.log('BAD RESULT, ABORT');
        process.exit(0);
      }
      makeImage(results, category, function() {
        resolve(category);
      });
    });
  });
}).catch((e) => console.log(e)); }

function makeImage(teams, title, cb) {
  var data = fs.readFileSync(__dirname + '/bracket.jpg');
  img = new Image;
  img.src = data;
  ctx.drawImage(img, 0, 0, img.width, img.height);
  ctx.font = '120px Impact';
  ctx.textAlign = 'center';
  ctx.fillText(title, W/2, 100);
  ctx.font = '60px Impact';
  ctx.textAlign = 'left';
  ctx.fillText(teams[0], 100, 163);
  ctx.fillText(teams[1], 100, 660);
  ctx.fillText(teams[2], 100, 770);
  ctx.fillText(teams[3], 100, 1250);
  ctx.fillText(teams[4], 100, 1355);
  ctx.fillText(teams[5], 100, 1850);
  ctx.fillText(teams[6], 100, 1950);
  ctx.fillText(teams[7], 100, 2440);

  ctx.textAlign = 'right';
  ctx.fillText(teams[8],  W-100, 163);
  ctx.fillText(teams[9],  W-100, 660);
  ctx.fillText(teams[10], W-100, 770);
  ctx.fillText(teams[11], W-100, 1250);
  ctx.fillText(teams[12], W-100, 1355);
  ctx.fillText(teams[13], W-100, 1850);
  ctx.fillText(teams[14], W-100, 1950);
  ctx.fillText(teams[15], W-100, 2440);
  var stream = canvas.createPNGStream().pipe(fs.createWriteStream(__dirname+'/out.png'));
  stream.on('close', function(){
    console.log('saved png');
    cb();
  });
}

function tweet() {
  generate().then(title => {
    if (!wordfilter.blacklisted(title)) {
      let thoughts = [
       'thoughts','feedback','what do you think'
      ].pick();
      let fightMe = [
       'fight me', 'ready to fight', 'argue away'
      ].pick();
      let heresMy = [
       'finished my', 'I made this', 'time for my', `here's my`, 'unveiling my'
      ].pick();
      let ok = [
       'ok','okay','phew','alright','k','yo','hey'
      ].pick();

      let myTweet = [
        `${heresMy} bracket of ${title}`,
        `${heresMy} ${title} bracket`,
        `${title}... ${thoughts}?`,
        `${heresMy} ${title} bracket. ${fightMe}.`,
        ].pick();
      let pre = [
        `${ok}. `,
        ``
      ].pick();
      myTweet = pre + myTweet;

      var b64content = fs.readFileSync('out.png', { encoding: 'base64' })
      // first we must post the media to Twitter 
      T.post('media/upload', { media_data: b64content }, function (err, data, response) {
        console.log(err);

        // now we can reference the media and post a tweet (media will attach to the tweet) 
        var mediaIdStr = data.media_id_string
        var params = { status: myTweet, media_ids: [mediaIdStr] }

        T.post('statuses/update', params, function (err, data, response) {
          console.log(data)
        })
      })
    }
  }).catch((e) => console.log(e));
}

// Tweet once on initialization
tweet();
