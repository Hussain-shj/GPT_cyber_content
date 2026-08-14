import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {bundle} from "@remotion/bundler";
import {renderMedia, selectComposition} from "@remotion/renderer";

const [, , propsFile, outputFile] = process.argv;
if (!propsFile || !outputFile) throw new Error("Usage: node render.mjs props.json output.mp4");
const props = JSON.parse(fs.readFileSync(propsFile, "utf8"));
const wav = fs.readFileSync(props.audioPath);
const music = fs.readFileSync(props.musicPath);
const aiClipDataUris=(props.clipPaths||[]).map((clip)=>`data:video/mp4;base64,${fs.readFileSync(clip).toString("base64")}`);
const aiImageDataUris=(props.imagePaths||[]).map((image)=>`data:image/jpeg;base64,${fs.readFileSync(image).toString("base64")}`);
const inputProps = {script:props.script,audioDataUri:`data:audio/wav;base64,${wav.toString("base64")}`,musicDataUri:`data:audio/wav;base64,${music.toString("base64")}`,aiClipDataUris,aiImageDataUris};
const here = path.dirname(fileURLToPath(import.meta.url));
const serveUrl = await bundle({entryPoint:path.join(here,"index.jsx")});
const composition = await selectComposition({serveUrl,id:"CyberAlertVideo",inputProps});
await renderMedia({composition,serveUrl,codec:"h264",audioCodec:"aac",outputLocation:outputFile,inputProps,logLevel:"warn"});
