import wordfilter from "wordfilter";
import request from "request";
import rita from "rita";
import { createCanvas } from "canvas";
import fs from "fs";
import bsky from "@atproto/api";
import * as dotenv from "dotenv";

dotenv.config();
const { BskyAgent, RichText } = bsky;
const r = rita.RiTa;
const width = 3072;
const height = 1500;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");

const pick = (arr) => {
  return arr[Math.floor(Math.random() * arr.length)];
};

const pickRemove = (arr) => {
  const index = Math.floor(Math.random() * arr.length);
  return arr.splice(index, 1)[0];
};

const generate = () => {
  return new Promise((resolve, reject) => {
    const term = r.randomWord("nn").substr(0, 3);
    console.log(term);
    const categoryUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=allcategories&acprefix=${term}&acmin=16&acprop=size&aclimit=500`;
    request(categoryUrl, (err, resp, body) => {
      let result = JSON.parse(body).query.allcategories;
      result = result.filter((el) => {
        const title = el["*"];
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
      result = pick(result);
      const category = result["*"];
      console.log(category);

      const listOfCategoryMembersUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=categorymembers&cmtitle=${
        "Category:" + category
      }&cmnamespace=0&cmlimit=500`;
      console.log(listOfCategoryMembersUrl);

      request(listOfCategoryMembersUrl, (err, resp, body) => {
        let result = JSON.parse(body).query.categorymembers;
        result = result.map((el) => el.title.replace(/\s\(.*/, ""));
        let betterResult = result.filter(
          (item) => item.length <= 32 && !item.includes("List"),
        );

        let results = [];
        for (let i = 0; i < 4; i++) {
          results.push(pickRemove(betterResult));
        }
        console.log(results, results.length);

        if (results.includes(undefined)) {
          console.log("BAD RESULT, ABORT");
          process.exit(0);
        }

        makeImage(results, category, function () {
          resolve({ category, results });
        });
      });
    });
  }).catch((e) => console.log(e));
};

const colorSchemes = [
  { bg: "#ffffff", fg: "#181818" },
  { bg: "#181818", fg: "#ffffff" },
  { bg: "#1899d5", fg: "#ffffff" },
  { bg: "#f76720", fg: "#ffffff" },
  { bg: "#de3d83", fg: "#ffffff" },
  { bg: "#f54123", fg: "#ffffff" },
  { bg: "#fee94e", fg: "#181818" },
];

const makeImage = (names, category, cb) => {
  let colorScheme = pick(colorSchemes);
  ctx.fillStyle = colorScheme.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = "left";
  ctx.fillStyle = colorScheme.fg;
  ctx.font = "bold 150px Helvetica";
  ctx.fillText(names[0] + "&", width / 8, 532);
  ctx.fillText(names[1] + "&", width / 8, 692);
  ctx.fillText(names[2] + "&", width / 8, 842);
  ctx.fillText(names[3] + ".", width / 8, 992);

  const stream = canvas
    .createPNGStream()
    .pipe(fs.createWriteStream(process.cwd() + "/out.png"));
  stream.on("close", function () {
    console.log("saved png");
    cb();
  });
};

const start = async ({ category, results }) => {
  if (!wordfilter.blacklisted(category)) {
    /* initialize BskyAgent and login  */
    const agent = new BskyAgent({
      service: "https://bsky.social",
    });
    await agent.login({
      identifier: process.env.BLUESKY_USERNAME,
      password: process.env.BLUESKY_PASSWORD,
    });

    const file = fs.readFileSync("out.png");

    const response = await agent.uploadBlob(file, {
      encoding: "image/jpeg",
    });

    if (!response.success) {
      const msg = `Unable to upload image ${imageUrl}`;
      console.error(msg, response);
      throw new Error(msg);
    }

    const {
      data: { blob: image },
    } = response;

    const rt = new RichText({ text: `${category}` });
    await rt.detectFacets(agent);

    /* create a post with Rich Text and generated image */
    return agent.post({
      text: rt.text,
      facets: rt.facets,
      embed: {
        $type: "app.bsky.embed.images",
        images: [
          {
            image: image,
            alt: `${results[0]} & ${results[1]} & ${results[2]} & ${results[3]}`,
          },
        ],
      },
    });
  } else {
    console.log("Word was not approved");
  }
};

generate().then(({ category, results }) => start({ category, results }));
