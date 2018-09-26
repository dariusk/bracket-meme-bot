var request = require("request");
var Twit = require("twit");
var express = require("express");
var app = express();
var T = new Twit(require("./config.js"));
var wordfilter = require("wordfilter");
var rita = require("rita");
var r = rita.RiTa;
let width = 3072;
let height = 1536;
var Canvas = require("canvas");
var canvas = new Canvas(width, height);
var ctx = canvas.getContext("2d");
var fs = require("fs");

app.use(express.static("public"));

Array.prototype.pick = function() {
  return this[Math.floor(Math.random() * this.length)];
};

Array.prototype.pickRemove = function() {
  var index = Math.floor(Math.random() * this.length);
  return this.splice(index, 1)[0];
};

function generate() {
  return new Promise((resolve, reject) => {
    var term = r.randomWord("nn").substr(0, 3);
    console.log(term);
    var url = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=allcategories&acprefix=${term}&acmin=16&acprop=size&aclimit=500`;
    request(url, (err, resp, body) => {
      let result = JSON.parse(body).query.allcategories;
      result = result.filter(el => {
        let title = el["*"];
        let pos = r.getPosTags(title);
        let hasBannedWord =
          title.includes(" of ") ||
          title.includes(" by ") ||
          title.includes(" articles") ||
          title.includes(" lists") ||
          title.includes("List");
        return (
          el.pages >= 4 &&
          (pos.includes("nns") || pos[0] === "nnps") &&
          !hasBannedWord
        );
      });
      result = result.pick();
      var category = result["*"];
      console.log(category);
      var url2 = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=categorymembers&cmtitle=${"Category:" +
        category}&cmnamespace=0&cmlimit=500`;
      console.log(url2);
      request(url2, (err, resp, body) => {
        let result = JSON.parse(body).query.categorymembers;
        result = result.map(el => el.title.replace(/\s\(.*/, ""));
        let betterResult = result.filter(
          item => item.length <= 32 && !item.includes("List")
        );

        // pick 16 results
        let results = [];
        for (var i = 0; i < 4; i++) {
          results.push(betterResult.pickRemove());
        }
        console.log(results, results.length);
        if (results.includes(undefined)) {
          console.log("BAD RESULT, ABORT");
          process.exit(0);
        }
        makeImage(results, category, function() {
          resolve(category);
        });
      });
    });
  }).catch(e => console.log(e));
}

let colorSchemes = [
  { bg: "#ffffff", fg: "#181818" },
  { bg: "#181818", fg: "#ffffff" },
  { bg: "#1899d5", fg: "#ffffff" },
  { bg: "#f76720", fg: "#ffffff" },
  { bg: "#de3d83", fg: "#ffffff" },
  { bg: "#f54123", fg: "#ffffff" },
  { bg: "#fee94e", fg: "#181818" }
];

function makeImage(names, title, cb) {
  let colorScheme = colorSchemes.pick();
  ctx.fillStyle = colorScheme.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = "left";
  ctx.fillStyle = colorScheme.fg;
  ctx.font = "bold 140px Helvetica";
  ctx.fillText(names[0] + "&", width / 8, 512);
  ctx.fillText(names[1] + "&", width / 8, 662);
  ctx.fillText(names[2] + "&", width / 8, 812);
  ctx.fillText(names[3] + ".", width / 8, 962);

  var stream = canvas
    .createPNGStream()
    .pipe(fs.createWriteStream(__dirname + "/out.png"));
  stream.on("close", function() {
    console.log("saved png");
    cb();
  });
}

function tweet() {
  generate()
    .then(title => {
      if (!wordfilter.blacklisted(title)) {
        let myTweet = `${title}.`;

        var b64content = fs.readFileSync("out.png", { encoding: "base64" });
        // first we must post the media to Twitter
        T.post("media/upload", { media_data: b64content }, function(
          err,
          data,
          response
        ) {
          console.log(err);

          // now we can reference the media and post a tweet (media will attach to the tweet)
          var mediaIdStr = data.media_id_string;
          var params = { status: myTweet, media_ids: [mediaIdStr] };

          T.post("statuses/update", params, function(err, data, response) {
            console.log(data);
          });
        });
      }
    })
    .catch(e => console.log(e));
}

app.all("/" + process.env.BOT_ENDPOINT, function(req, res) {
  tweet();
});
