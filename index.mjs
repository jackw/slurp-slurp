import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import axios from "axios";
import jszip from "jszip";

const apiUrl =
  "https://grafana.com/api/plugins?orderBy=popularity&direction=desc&typeCodeIn[]=panel";
const downloadDir = path.resolve(os.tmpdir(), "plugin-slurper");
const pluginBlackList = [
  "alertlist",
  "annolist",
  "barchart",
  "bargauge",
  "candlestick",
  "canvas",
  "dashlist",
  "debug",
  "gauge",
  "geomap",
  "graph",
  "heatmap-new",
  "histogram",
  "stat",
  "table",
  "text",
  "timeseries",
  "xychart",
];

const res = await axios.get(apiUrl);
const panelPlugins = res.data;
const filteredPlugins = panelPlugins.items.filter(
  (plugin) => !pluginBlackList.includes(plugin.slug)
);

if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir);
}

for await (const plugin of filteredPlugins) {
  let downloadUrl;
  if (Object.keys(plugin.packages).length == 0) {
    const downloadLink = plugin.links.filter((link) => link.rel === "download");
    downloadUrl = downloadLink.length
      ? `https://grafana.com/api${downloadLink[0].href}`
      : "";
  } else {
    downloadUrl = `https://grafana.com${plugin.packages.any.downloadUrl}`;
  }
  if (downloadUrl) {
    const fileName = `${plugin.slug}-${plugin.version}.zip`;
    const location = path.resolve(downloadDir, fileName);
    await downloadZip(downloadUrl, location);
    await sleep(500);
    await extractPlugin(fileName, plugin.slug, plugin.version);
  }
}

console.log(`Downloads can be found in: ${downloadDir}`);

async function downloadZip(downloadUrl, location) {
  const writer = fs.createWriteStream(location);
  const res = await axios({
    url: downloadUrl,
    method: "GET",
    responseType: "stream",
  });

  res.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve), writer.on("error", reject);
  });
}

async function extractPlugin(zipFileName, slug, version) {
  // `tmp/${slug}/${version}/public/plugins/${slug}`;
  const fileContent = fs.readFileSync(path.join(downloadDir, zipFileName));
  const zip = new jszip();
  const result = await zip.loadAsync(fileContent);

  fs.mkdirSync(
    path.join(downloadDir, slug, version, "public", "plugins", slug),
    { recursive: true }
  );

  for (const key of Object.keys(result.files)) {
    const item = result.files[key];
    const itemLocation = path.join(
      downloadDir,
      slug,
      version,
      "public",
      "plugins",
      item.name
    );
    if (item.dir) {
      fs.mkdirSync(itemLocation, { recursive: true });
    } else {
      fs.writeFileSync(
        itemLocation,
        Buffer.from(await item.async("arraybuffer"))
      );
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
